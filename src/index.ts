import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAuth } from "./auth";
import { executeQuery } from "./data";
import {
  slots,
  validSlot,
  transitionBooking,
  requestBooking,
  BookingError,
} from "./booking";
import { exportRecords, importRecords } from "./backup";
import workspace from "./workspace";
import { can, type Profile } from "./permissions";
import { availability, quarterSlots } from "./scheduling";

const app = new Hono<{ Bindings: Env; Variables: { profile: Profile } }>();
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(100),
});
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "Request too large" }, 413),
  }),
);
app.use("*", async (c, next) => {
  if (
    c.req.path.startsWith("/api/") &&
    !["GET", "HEAD"].includes(c.req.method) &&
    c.req.header("origin") !== c.env.APP_ORIGIN
  )
    return c.json({ error: "Invalid request origin" }, 403);
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "DENY");
  if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
});
async function consume(
  db: D1Database,
  key: string,
  maximum: number,
  window: number,
) {
  const bucket = Math.floor(Date.now() / 1000 / window);
  const row = await db
    .prepare(
      "INSERT INTO request_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(`${key}:${bucket}`, (bucket + 1) * window)
    .first<{ count: number }>();
  return (row?.count ?? maximum + 1) <= maximum;
}
app.get("/api/public/services", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,name,description,price_cents,duration_minutes,buffer_minutes FROM services WHERE active=1 ORDER BY name LIMIT 100",
      ).all()
    ).results,
  ),
);
app.get("/api/public/slots", async (c) => {
  return c.json(
    await availability(
      c.env.DB,
      c.req.query("date") ?? "",
      c.env.BUSINESS_TIMEZONE,
      c.req.query("serviceId"),
    ),
  );
});
app.post("/api/public/book", async (c) => {
  if (
    !(await consume(
      c.env.DB,
      "booking:" + (c.req.header("cf-connecting-ip") ?? "local"),
      10,
      3600,
    ))
  )
    return c.json(
      { error: "Too many booking requests. Please contact the salon." },
      429,
    );
  return c.json(
    await requestBooking(c.env.DB, c.env.BUSINESS_TIMEZONE, await c.req.json()),
    201,
  );
});
app.post("/api/setup", async (c) => {
  if (
    !(await consume(
      c.env.DB,
      "setup:" + (c.req.header("cf-connecting-ip") ?? "local"),
      5,
      900,
    ))
  )
    return c.json({ error: "Too many setup attempts. Try again later." }, 429);
  const input = z
    .object({ token: z.string().max(256), ...credentials.shape })
    .parse(await c.req.json());
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  if (
    !c.env.SETUP_TOKEN ||
    !timingSafeEqual(await hash(input.token), await hash(c.env.SETUP_TOKEN))
  )
    return c.json({ error: "Invalid setup token" }, 403);
  if (await c.env.DB.prepare("SELECT id FROM user LIMIT 1").first())
    return c.json({ error: "Setup already completed" }, 409);
  const lock = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO setup_lock (id) VALUES (1)",
  ).run();
  if (!lock.meta.changes)
    return c.json({ error: "Setup already started" }, 409);
  try {
    const result = await createAuth(c.env).api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: "admin",
      },
    });
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (id,role,full_name) VALUES (?, ?, ?)",
    )
      .bind(result.user.id, "admin", input.name)
      .run();
    return c.json({ success: true }, 201);
  } catch (error) {
    // If account creation succeeded but profile creation failed, fail closed for manual recovery.
    if (!(await c.env.DB.prepare("SELECT id FROM user LIMIT 1").first()))
      await c.env.DB.prepare("DELETE FROM setup_lock WHERE id=1").run();
    throw error;
  }
});
// Only login/session/password endpoints are public. Registration and plugin admin routes are blocked.
app.all("/api/auth/*", async (c) => {
  if (!["GET", "POST"].includes(c.req.method))
    return c.json({ error: "Method not allowed" }, 405);
  const endpoint = c.req.path.slice("/api/auth/".length);
  if (
    !["sign-in/email", "sign-out", "get-session", "change-password"].includes(
      endpoint,
    )
  )
    return c.json({ error: "Endpoint disabled" }, 404);
  return createAuth(c.env).handler(c.req.raw);
});
app.use("/api/*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.json({ error: "Please sign in" }, 401);
  const profile = await c.env.DB.prepare(
    "SELECT p.* FROM user_profiles p WHERE p.id=? AND p.is_active=1 AND (p.role='admin' OR EXISTS(SELECT 1 FROM customers c WHERE c.id=p.customer_id AND c.archived_at IS NULL))",
  )
    .bind(session.user.id)
    .first<Profile>();
  if (!profile) return c.json({ error: "Account unavailable" }, 403);
  c.set("profile", profile);
  await next();
});
app.post("/api/data", async (c) => {
  return c.json({
    data: await executeQuery(c.env.DB, c.get("profile"), await c.req.json()),
    error: null,
  });
});
app.route("/api/workspace", workspace);
app.use("/api/customer/*", async (c, next) => {
  const profile = c.get("profile");
  if (profile.role !== "customer" || !profile.customer_id)
    return c.json(
      {
        error:
          "A linked customer account is required. Please contact the salon.",
      },
      403,
    );
  await next();
});
app.get("/api/customer/home", async (c) => {
  const id = c.get("profile").customer_id!;
  const [customer, pets, visits, member, tiers, bookings, totals] =
    await Promise.all([
      c.env.DB.prepare("SELECT customer_name FROM customers WHERE id=?")
        .bind(id)
        .first(),
      c.env.DB.prepare(
        "SELECT id,pet_name,pet_type,breed,birthday,contact FROM pets WHERE customer_id=? ORDER BY pet_name",
      )
        .bind(id)
        .all(),
      c.env.DB.prepare(
        "SELECT a.id,a.pet_id,p.pet_name,a.date,a.type,a.groomer,a.price FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.customer_id=? ORDER BY a.date DESC LIMIT 1000",
      )
        .bind(id)
        .all(),
      c.env.DB.prepare(
        "SELECT email,date_of_birth,marketing_consent FROM members WHERE customer_id=?",
      )
        .bind(id)
        .first(),
      c.env.DB.prepare(
        "SELECT id,name,min_spend,discount_pct,perks FROM membership_tiers ORDER BY min_spend",
      ).all(),
      c.env.DB.prepare(
        "SELECT id,service_name,price_cents,date,slot,status,json_extract(details,'$.petName') AS pet_name FROM bookings WHERE customer_id=? ORDER BY date DESC,slot DESC LIMIT 100",
      )
        .bind(id)
        .all(),
      c.env.DB.prepare(
        "SELECT COALESCE(SUM(a.price),0) AS spend,COUNT(*) AS visits FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.customer_id=?",
      )
        .bind(id)
        .first(),
    ]);
  return c.json({
    customer,
    pets: pets.results,
    visits: visits.results,
    member,
    tiers: tiers.results,
    bookings: bookings.results,
    totals,
  });
});
app.post("/api/customer/book", async (c) => {
  const profile = c.get("profile");
  if (!(await consume(c.env.DB, "customer-book:" + profile.id, 10, 3600)))
    return c.json(
      { error: "Too many booking requests. Please contact the salon." },
      429,
    );
  return c.json(
    await requestBooking(
      c.env.DB,
      c.env.BUSINESS_TIMEZONE,
      await c.req.json(),
      profile.customer_id,
    ),
    201,
  );
});
app.use("/api/admin/*", async (c, next) => {
  const capability = /\/(bookings|booking-status)$/.test(c.req.path)
    ? "records"
    : "manage";
  if (!can(c.get("profile"), capability))
    return c.json({ error: "Admin access required" }, 403);
  await next();
});
app.get("/api/admin/users", async (c) => {
  return c.json(
    (
      await c.env.DB.prepare(
        "SELECT p.*,u.email FROM user_profiles p JOIN user u ON u.id=p.id ORDER BY p.created_at",
      ).all()
    ).results,
  );
});
app.get("/api/admin/backup", async (c) =>
  c.json(await exportRecords(c.env.DB)),
);
app.post("/api/admin/import", async (c) => {
  await importRecords(c.env.DB, c.get("profile").id, await c.req.json());
  return c.json({ success: true });
});
app.get("/api/admin/bookings", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT * FROM bookings ORDER BY date DESC,slot LIMIT 1000",
      ).all<{ details: string }>()
    ).results.map((b) => ({ ...b, details: JSON.parse(b.details) })),
  ),
);
app.post("/api/admin/booking-status", async (c) => {
  await transitionBooking(c.env.DB, c.get("profile").id, await c.req.json());
  return c.json({ success: true });
});
app.post("/api/admin/create-customer-account", async (c) => {
  const input = z
    .object({
      email: credentials.shape.email,
      password: credentials.shape.password,
      customerId: z.string().uuid(),
    })
    .parse(await c.req.json());
  const customer = await c.env.DB.prepare(
    "SELECT customer_name FROM customers WHERE id=?",
  )
    .bind(input.customerId)
    .first<{ customer_name: string }>();
  if (!customer) return c.json({ error: "Customer not found" }, 404);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM user_profiles WHERE customer_id=?",
  )
    .bind(input.customerId)
    .first();
  if (existing)
    return c.json({ error: "Customer already has an account" }, 409);
  const result = await createAuth(c.env).api.createUser({
    body: {
      email: input.email,
      password: input.password,
      name: customer.customer_name,
      role: "user",
    },
  });
  try {
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (id,role,customer_id,full_name) VALUES (?,?,?,?)",
    )
      .bind(
        result.user.id,
        "customer",
        input.customerId,
        customer.customer_name,
      )
      .run();
  } catch (error) {
    await c.env.DB.prepare("DELETE FROM user WHERE id=?")
      .bind(result.user.id)
      .run();
    throw error;
  }
  return c.json({ success: true }, 201);
});
app.post("/api/admin/create-staff", async (c) => {
  const input = credentials
    .extend({
      staffRole: z.enum(["owner", "receptionist", "groomer"]).default("owner"),
    })
    .parse(await c.req.json());
  const result = await createAuth(c.env).api.createUser({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.staffRole === "owner" ? "admin" : "user",
    },
  });
  try {
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (id,role,full_name,staff_role) VALUES (?,?,?,?)",
    )
      .bind(result.user.id, "admin", input.name, input.staffRole)
      .run();
  } catch (error) {
    await c.env.DB.prepare("DELETE FROM user WHERE id=?")
      .bind(result.user.id)
      .run();
    throw error;
  }
  return c.json({ success: true }, 201);
});
app.post("/api/admin/reset-customer-password", async (c) => {
  const input = z
    .object({
      userId: z.string().min(1),
      newPassword: credentials.shape.password,
    })
    .parse(await c.req.json());
  await createAuth(c.env).api.setUserPassword({
    body: input,
    headers: c.req.raw.headers,
  });
  await c.env.DB.prepare("DELETE FROM session WHERE userId=?")
    .bind(input.userId)
    .run();
  return c.json({ success: true });
});
app.post("/api/admin/toggle-user", async (c) => {
  const input = z
    .object({ userId: z.string().min(1), active: z.boolean() })
    .parse(await c.req.json());
  if (input.userId === c.get("profile").id)
    return c.json({ error: "You cannot disable your own account" }, 400);
  const changed = await c.env.DB.prepare(
    "UPDATE user_profiles SET is_active=? WHERE id=? AND (?=1 OR role!='admin' OR staff_role!='owner' OR (SELECT count(*) FROM user_profiles WHERE role='admin' AND staff_role='owner' AND is_active=1)>1) RETURNING id",
  )
    .bind(Number(input.active), input.userId, Number(input.active))
    .first();
  if (!changed)
    return c.json(
      {
        error: "Account not found or this would disable the last administrator",
      },
      409,
    );
  await c.env.DB.prepare("DELETE FROM session WHERE userId=?")
    .bind(input.userId)
    .run();
  return c.json({ success: true });
});
app.notFound((c) =>
  c.req.path.startsWith("/api/")
    ? c.json({ error: "Not found" }, 404)
    : c.env.ASSETS.fetch(c.req.raw),
);
app.onError((error, c) => {
  const readable = [
    "Payment exceeds balance",
    "Refund exceeds collected amount",
    "Invoice is void",
    "Discount exceeds subtotal",
    "Invoice total is too large",
    "Payment request ID already used",
    "Customer not found",
    "Pet does not belong to this customer",
    "Recovery record not found",
    "Customer is already active",
  ].find((message) => error.message.includes(message));
  if (readable) return c.json({ error: readable }, 400);
  if (error instanceof BookingError)
    return c.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  const safe = [
    "Unknown table",
    "Unknown field",
    "Invalid field value",
    "Read-only account",
    "Access denied",
    "Use the account management endpoints",
    "Mutation filter required",
    "Result too large; narrow the query",
    "Cannot change record identity",
  ];
  if (safe.includes(error.message))
    return c.json({ error: error.message }, 403);
  if (
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  )
    return c.json(
      { error: "Account operation failed. Check the details and try again." },
      400,
    );
  console.error(
    JSON.stringify({
      event: "request_failed",
      path: c.req.path,
      errorName: error.name,
    }),
  );
  return c.json(
    {
      error:
        "Unable to save or load records. Check required fields, duplicates and links.",
    },
    400,
  );
});
export default app;
