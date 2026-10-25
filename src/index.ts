import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAuth } from "./auth";
import { executeQuery } from "./data";
import { bookingSchema, slots, validSlot, transitionBooking } from "./booking";
import { exportRecords, importRecords } from "./backup";

type Profile = {
  id: string;
  role: "admin" | "customer";
  customer_id: string | null;
  is_active: number;
  full_name: string;
};
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
        "SELECT id,name,description,price_cents FROM services WHERE active=1 ORDER BY name LIMIT 100",
      ).all()
    ).results,
  ),
);
app.get("/api/public/slots", async (c) => {
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .parse(c.req.query("date"));
  const taken = (
    await c.env.DB.prepare(
      "SELECT slot FROM bookings WHERE date=? AND status!='cancelled'",
    )
      .bind(date)
      .all<{ slot: string }>()
  ).results;
  return c.json({
    timezone: c.env.BUSINESS_TIMEZONE,
    slots: slots.filter(
      (s) =>
        validSlot(date, s, c.env.BUSINESS_TIMEZONE) &&
        !taken.some((b) => b.slot === s),
    ),
  });
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
  const input = bookingSchema.parse(await c.req.json());
  if (!validSlot(input.date, input.slot, c.env.BUSINESS_TIMEZONE))
    return c.json({ error: "Choose a future slot within 90 days" }, 400);
  const service = await c.env.DB.prepare(
    "SELECT name,price_cents FROM services WHERE id=? AND active=1",
  )
    .bind(input.serviceId)
    .first<{ name: string; price_cents: number }>();
  if (!service) return c.json({ error: "Package unavailable" }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      "INSERT INTO bookings(id,service_id,service_name,price_cents,date,slot,details) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        input.serviceId,
        service.name,
        service.price_cents,
        input.date,
        input.slot,
        JSON.stringify(input),
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return c.json(
        { error: "That slot was just booked. Please choose another." },
        409,
      );
    throw error;
  }
  return c.json({ id, status: "pending" }, 201);
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
    "SELECT * FROM user_profiles WHERE id=? AND is_active=1",
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
app.use("/api/admin/*", async (c, next) => {
  if (c.get("profile").role !== "admin")
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
  const input = credentials.parse(await c.req.json());
  const result = await createAuth(c.env).api.createUser({
    body: { ...input, role: "admin" },
  });
  try {
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (id,role,full_name) VALUES (?,?,?)",
    )
      .bind(result.user.id, "admin", input.name)
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
    "UPDATE user_profiles SET is_active=? WHERE id=? AND (?=1 OR role!='admin' OR (SELECT count(*) FROM user_profiles WHERE role='admin' AND is_active=1)>1) RETURNING id",
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
