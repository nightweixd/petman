import { Hono } from "hono";
import { z } from "zod";
import { can, type Profile } from "./permissions";
import { archiveCustomer, restoreCustomer } from "./records";
import { calendarDate, createInvoice, recordPayment } from "./invoices";
const api = new Hono<{ Bindings: Env; Variables: { profile: Profile } }>();
const id = z.string().uuid();
const page = (raw: string | undefined) =>
  z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(raw ?? 0);
const audit = (db: D1Database, actor: string, action: string, target: string) =>
  db
    .prepare(
      "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
    )
    .bind(crypto.randomUUID(), actor, action, target);
const balances = `SELECT i.*,COALESCE((SELECT SUM(CASE WHEN p.kind='payment' THEN p.amount_cents ELSE -p.amount_cents END) FROM invoice_payments p WHERE p.invoice_id=i.id),0) AS collected_cents FROM invoices i`;
api.use("*", async (c, next) => {
  const p = c.get("profile"),
    path = c.req.path.split("/workspace/")[1] ?? "";
  if (path === "me") return next();
  const capability = /^(settings|groomers|closures)/.test(path)
    ? "manage"
    : /^(invoices|payments|finance)/.test(path)
      ? "finance"
      : /^(today|stage)/.test(path)
        ? "bookings"
        : /^(tasks|views|notes|message)/.test(path)
          ? "care"
          : "records";
  if (!can(p, capability)) return c.json({ error: "Access denied" }, 403);
  await next();
});
api.get("/me", (c) => c.json(c.get("profile")));
api.post("/new-customer", async (c) => {
  const v = z
    .object({
      customerName: z.string().trim().min(1).max(100),
      customerRef: z.string().trim().max(100),
      petName: z.string().trim().min(1).max(100),
      petType: z.string().max(50),
      phone: z.string().min(1).max(40),
    })
    .parse(await c.req.json());
  const customerId = crypto.randomUUID(),
    petId = crypto.randomUUID(),
    customerRef =
      v.customerRef || "CUST-" + crypto.randomUUID().slice(0, 12).toUpperCase();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO customers(id,customer_id,customer_name,phone) VALUES(?,?,?,?)",
    ).bind(customerId, customerRef, v.customerName, v.phone),
    c.env.DB.prepare(
      "INSERT INTO pets(id,customer_id,pet_name,pet_type,contact) VALUES(?,?,?,?,?)",
    ).bind(petId, customerId, v.petName, v.petType, v.phone),
    audit(c.env.DB, c.get("profile").id, "customer.create", customerId),
  ]);
  return c.json({ customerId, petId, customerRef }, 201);
});
api.get("/customers", async (c) => {
  const offset = page(c.req.query("offset")),
    search = (c.req.query("search") ?? "").slice(0, 200),
    filter = c.req.query("filter") ?? "all";
  const conditions = [
      "c.archived_at IS NULL",
      `(c.customer_name LIKE ? OR c.customer_id LIKE ? OR c.phone LIKE ? OR c.tags LIKE ? OR EXISTS(SELECT 1 FROM pets p WHERE p.customer_id=c.id AND (p.pet_name LIKE ? OR p.contact LIKE ?)))`,
    ],
    params: (string | number)[] = Array(6).fill("%" + search + "%");
  if (filter === "inactive")
    conditions.push(
      `(SELECT MAX(a.date) FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.customer_id=c.id)<date('now','-60 days')`,
    );
  if (filter === "birthday")
    conditions.push(
      `EXISTS(SELECT 1 FROM members m WHERE m.customer_id=c.id AND substr(m.date_of_birth,6,2)=strftime('%m','now','+8 hours'))`,
    );
  if (filter === "outstanding")
    conditions.push(
      `EXISTS(SELECT 1 FROM (${balances}) b WHERE b.customer_id=c.id AND b.status='issued' AND b.total_cents>b.collected_cents)`,
    );
  const where = conditions.join(" AND ");
  const [rows, count] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.*,(SELECT COUNT(*) FROM pets p WHERE p.customer_id=c.id) pet_count FROM customers c WHERE ${where} ORDER BY c.customer_name,c.id LIMIT 25 OFFSET ?`,
    )
      .bind(...params, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) total FROM customers c WHERE ${where}`)
      .bind(...params)
      .first(),
  ]);
  return c.json({ rows: rows.results, total: count?.total ?? 0 });
});
api.get("/customers/:id", async (c) => {
  const customerId = id.parse(c.req.param("id"));
  const customer = await c.env.DB.prepare(
    "SELECT * FROM customers WHERE id=? AND archived_at IS NULL",
  )
    .bind(customerId)
    .first();
  if (!customer) return c.json({ error: "Customer not found" }, 404);
  const queries = [
    ["pets", "SELECT * FROM pets WHERE customer_id=? ORDER BY pet_name"],
    [
      "appointments",
      "SELECT a.* FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.customer_id=? ORDER BY a.date DESC LIMIT 100",
    ],
    [
      "notes",
      "SELECT n.*,u.full_name actor FROM customer_notes n LEFT JOIN user_profiles u ON u.id=n.actor_id WHERE n.customer_id=? ORDER BY n.created_at DESC LIMIT 100",
    ],
    [
      "tasks",
      "SELECT * FROM care_tasks WHERE customer_id=? ORDER BY completed_at,due_date LIMIT 100",
    ],
    [
      "bookings",
      "SELECT * FROM bookings WHERE customer_id=? ORDER BY date DESC LIMIT 100",
    ],
    ["member", "SELECT * FROM members WHERE customer_id=?"],
    [
      "invoices",
      `${balances} WHERE i.customer_id=? ORDER BY i.number DESC LIMIT 100`,
    ],
  ];
  const result: Record<string, unknown> = { customer };
  await Promise.all(
    queries.map(async ([key, sql]) => {
      if (key === "invoices" && !can(c.get("profile"), "finance")) return;
      result[key] = (
        await c.env.DB.prepare(sql).bind(customerId).all()
      ).results;
    }),
  );
  return c.json(result);
});
api.post("/customers/:id/profile", async (c) => {
  const customerId = id.parse(c.req.param("id")),
    v = z
      .object({
        phone: z.string().max(40),
        address: z.string().max(500),
        tags: z.string().max(300),
      })
      .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE customers SET phone=?,address=?,tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL",
    ).bind(v.phone, v.address, v.tags, customerId),
    audit(c.env.DB, c.get("profile").id, "customer.profile", customerId),
  ]);
  return c.json({ success: true });
});
api.post("/customers/:id/archive", async (c) =>
  c.json(
    await archiveCustomer(
      c.env.DB,
      c.get("profile").id,
      id.parse(c.req.param("id")),
    ),
  ),
);
api.post("/restore", async (c) => {
  const v = z.object({ id }).parse(await c.req.json());
  return c.json(await restoreCustomer(c.env.DB, c.get("profile").id, v.id));
});
api.post("/notes", async (c) => {
  const v = z
    .object({ customerId: id, body: z.string().trim().min(1).max(4000) })
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO customer_notes(id,customer_id,body,actor_id) SELECT ?,id,?,? FROM customers WHERE id=? AND archived_at IS NULL",
    ).bind(crypto.randomUUID(), v.body, c.get("profile").id, v.customerId),
    audit(c.env.DB, c.get("profile").id, "customer.note", v.customerId),
  ]);
  return c.json({ success: true });
});
api.get("/tasks", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT t.*,c.customer_name,u.full_name assignee FROM care_tasks t LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN user_profiles u ON u.id=t.assigned_to ORDER BY t.completed_at,t.due_date LIMIT 500",
      ).all()
    ).results,
  ),
);
api.post("/tasks", async (c) => {
  const v = z
    .object({
      customerId: id.nullable().default(null),
      title: z.string().trim().min(1).max(300),
      dueDate: calendarDate,
      assignedTo: z.string().nullable().default(null),
    })
    .parse(await c.req.json());
  if (
    v.assignedTo &&
    !(await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE id=? AND role='admin' AND is_active=1",
    )
      .bind(v.assignedTo)
      .first())
  )
    return c.json({ error: "Choose an active staff member" }, 400);
  const taskId = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO care_tasks(id,customer_id,title,due_date,assigned_to,created_by) VALUES(?,?,?,?,?,?)",
    ).bind(
      taskId,
      v.customerId,
      v.title,
      v.dueDate,
      v.assignedTo,
      c.get("profile").id,
    ),
    audit(c.env.DB, c.get("profile").id, "task.create", taskId),
  ]);
  return c.json({ id: taskId }, 201);
});
api.post("/tasks/:id", async (c) => {
  const v = z.object({ completed: z.boolean() }).parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE care_tasks SET completed_at=? WHERE id=?").bind(
      v.completed ? new Date().toISOString() : null,
      id.parse(c.req.param("id")),
    ),
    audit(c.env.DB, c.get("profile").id, "task.update", c.req.param("id")),
  ]);
  return c.json({ success: true });
});
api.get("/staff", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,full_name,staff_role FROM user_profiles WHERE role='admin' AND is_active=1 ORDER BY full_name",
      ).all()
    ).results,
  ),
);
api.get("/views", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT * FROM saved_views WHERE owner_id=? ORDER BY name",
      )
        .bind(c.get("profile").id)
        .all()
    ).results,
  ),
);
api.post("/views", async (c) => {
  const v = z
    .object({
      name: z.string().trim().min(1).max(60),
      search: z.string().max(200),
      filter: z.enum(["all", "inactive", "birthday", "outstanding"]),
    })
    .parse(await c.req.json());
  await c.env.DB.prepare(
    "INSERT INTO saved_views(id,owner_id,name,query) VALUES(?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      c.get("profile").id,
      v.name,
      JSON.stringify({ search: v.search, filter: v.filter }),
    )
    .run();
  return c.json({ success: true });
});
api.post("/views/:id/delete", async (c) => {
  await c.env.DB.prepare("DELETE FROM saved_views WHERE id=? AND owner_id=?")
    .bind(id.parse(c.req.param("id")), c.get("profile").id)
    .run();
  return c.json({ success: true });
});
api.get("/today", async (c) => {
  const date = calendarDate.parse(c.req.query("date"));
  return c.json(
    (
      await c.env.DB.prepare(
        "SELECT b.id,b.slot,b.date,b.status,b.stage,b.duration_minutes,json_object('name',json_extract(b.details,'$.name'),'petName',json_extract(b.details,'$.petName'),'phone',json_extract(b.details,'$.phone')) details,g.name groomer_name,p.medical_history FROM bookings b LEFT JOIN groomers g ON g.id=b.groomer_id LEFT JOIN pets p ON p.id=b.pet_id WHERE b.date=? AND b.status!='cancelled' ORDER BY b.slot",
      )
        .bind(date)
        .all()
    ).results,
  );
});
api.post("/stage", async (c) => {
  const v = z
    .object({
      id,
      stage: z.enum(["scheduled", "arrived", "grooming", "ready", "collected"]),
    })
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE bookings SET stage=? WHERE id=? AND status IN ('confirmed','completed')",
    ).bind(v.stage, v.id),
    audit(c.env.DB, c.get("profile").id, "booking.stage." + v.stage, v.id),
  ]);
  return c.json({ success: true });
});
api.get("/invoices", async (c) => {
  const offset = page(c.req.query("offset"));
  return c.json(
    (
      await c.env.DB.prepare(
        `${balances} ORDER BY i.number DESC LIMIT 26 OFFSET ?`,
      )
        .bind(offset)
        .all()
    ).results,
  );
});
api.post("/invoices", async (c) =>
  c.json(
    await createInvoice(c.env.DB, c.get("profile").id, await c.req.json()),
    201,
  ),
);
api.get("/invoices/:id", async (c) => {
  const invoiceId = id.parse(c.req.param("id")),
    invoice = await c.env.DB.prepare(`${balances} WHERE i.id=?`)
      .bind(invoiceId)
      .first();
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  const [items, payments] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY rowid",
    )
      .bind(invoiceId)
      .all(),
    c.env.DB.prepare(
      "SELECT * FROM invoice_payments WHERE invoice_id=? ORDER BY created_at,rowid",
    )
      .bind(invoiceId)
      .all(),
  ]);
  return c.json({ invoice, items: items.results, payments: payments.results });
});
api.post("/invoices/:id/void", async (c) => {
  const invoiceId = id.parse(c.req.param("id"));
  const r = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE invoices SET status='void' WHERE id=? AND status='issued' AND NOT EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_id=?) RETURNING id",
    ).bind(invoiceId, invoiceId),
    audit(c.env.DB, c.get("profile").id, "invoice.void", invoiceId),
  ]);
  if (!r[0].results.length)
    return c.json(
      { error: "Only invoices with no payment history can be voided" },
      409,
    );
  return c.json({ success: true });
});
api.post("/payments", async (c) =>
  c.json(
    await recordPayment(c.env.DB, c.get("profile").id, await c.req.json()),
  ),
);
api.get("/finance", async (c) => {
  const date = calendarDate.parse(c.req.query("month") + "-01");
  const invoices = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(total_cents),0) sales_cents,COALESCE(SUM(total_cents-collected_cents),0) outstanding_cents FROM (${balances}) WHERE status='issued' AND issued_date>=? AND issued_date<date(?,'+1 month')`,
  )
    .bind(date, date)
    .first();
  const payments = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount_cents ELSE -amount_cents END),0) collected_cents,COALESCE(SUM(CASE WHEN kind='refund' THEN amount_cents ELSE 0 END),0) refund_cents FROM invoice_payments WHERE received_date>=? AND received_date<date(?,'+1 month')",
  )
    .bind(date, date)
    .first();
  return c.json({ ...invoices, ...payments });
});
const time = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/);
const weekdays = z.string().regex(/^(?:[0-6](?:,[0-6])*)?$/);
api.get("/settings", async (c) => {
  const [settings, groomers, closures] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM salon_settings WHERE id=1").first(),
    c.env.DB.prepare("SELECT * FROM groomers ORDER BY name").all(),
    c.env.DB.prepare("SELECT * FROM salon_closures ORDER BY date").all(),
  ]);
  return c.json({
    settings,
    groomers: groomers.results,
    closures: closures.results,
  });
});
api.post("/settings", async (c) => {
  const s = z
    .object({
      business_name: z.string().trim().min(1).max(150),
      address: z.string().max(500),
      phone: z.string().max(40),
      email: z.union([z.string().email(), z.literal("")]),
      invoice_footer: z.string().max(1000),
      opening: time,
      closing: time,
      closed_weekdays: weekdays,
      minimum_notice_minutes: z.number().int().min(0).max(10080),
    })
    .refine((v) => v.closing > v.opening, "Closing must be after opening")
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE salon_settings SET business_name=?,address=?,phone=?,email=?,invoice_footer=?,opening=?,closing=?,closed_weekdays=?,minimum_notice_minutes=? WHERE id=1",
    ).bind(
      s.business_name,
      s.address,
      s.phone,
      s.email,
      s.invoice_footer,
      s.opening,
      s.closing,
      s.closed_weekdays,
      s.minimum_notice_minutes,
    ),
    audit(c.env.DB, c.get("profile").id, "salon.settings", "1"),
  ]);
  return c.json({ success: true });
});
api.post("/groomers", async (c) => {
  const g = z
    .object({
      id: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
      active: z.number().int().min(0).max(1),
      opening: time,
      closing: time,
      closed_weekdays: weekdays,
      break_start: z.union([time, z.literal("")]),
      break_end: z.union([time, z.literal("")]),
    })
    .refine(
      (v) =>
        v.closing > v.opening &&
        ((!v.break_start && !v.break_end) ||
          (!!v.break_start &&
            !!v.break_end &&
            v.break_end > v.break_start &&
            v.break_start >= v.opening &&
            v.break_end <= v.closing)),
      "Invalid hours or break",
    )
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO groomers(id,name,active,opening,closing,closed_weekdays,break_start,break_end) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active,opening=excluded.opening,closing=excluded.closing,closed_weekdays=excluded.closed_weekdays,break_start=excluded.break_start,break_end=excluded.break_end",
    ).bind(
      g.id,
      g.name,
      g.active,
      g.opening,
      g.closing,
      g.closed_weekdays,
      g.break_start,
      g.break_end,
    ),
    audit(c.env.DB, c.get("profile").id, "groomer.update", g.id),
  ]);
  return c.json({ success: true });
});
api.post("/closures", async (c) => {
  const v = z
    .object({
      date: calendarDate,
      reason: z.string().max(200),
      remove: z.boolean().default(false),
    })
    .parse(await c.req.json());
  await c.env.DB.batch([
    v.remove
      ? c.env.DB.prepare("DELETE FROM salon_closures WHERE date=?").bind(v.date)
      : c.env.DB.prepare(
          "INSERT INTO salon_closures(date,reason) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET reason=excluded.reason",
        ).bind(v.date, v.reason),
    audit(c.env.DB, c.get("profile").id, "salon.closure", v.date),
  ]);
  return c.json({ success: true });
});
export default api;
