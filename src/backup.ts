import { z } from "zod";
import { columns } from "./data";
export const backupTables = [
  "customers",
  "pets",
  "appointments",
  "deleted_customers",
  "membership_tiers",
  "members",
  "services",
  "salon_settings",
  "groomers",
  "salon_closures",
  "customer_notes",
  "care_tasks",
  "saved_views",
  "bookings",
  "booking_transitions",
  "booking_occupancy",
  "invoices",
  "invoice_items",
  "invoice_payments",
] as const;
const backupColumns: Record<string, string[]> = {
  ...columns,
  customers: [...columns.customers, "archived_at"],
  salon_settings: [
    "id",
    "business_name",
    "address",
    "phone",
    "email",
    "invoice_footer",
    "opening",
    "closing",
    "closed_weekdays",
    "minimum_notice_minutes",
  ],
  groomers: [
    "id",
    "name",
    "active",
    "opening",
    "closing",
    "closed_weekdays",
    "break_start",
    "break_end",
  ],
  salon_closures: ["date", "reason"],
  customer_notes: ["id", "customer_id", "body", "actor_id", "created_at"],
  care_tasks: [
    "id",
    "customer_id",
    "title",
    "due_date",
    "assigned_to",
    "completed_at",
    "created_by",
    "created_at",
  ],
  saved_views: ["id", "owner_id", "name", "query", "created_at"],
  bookings: [
    "id",
    "service_id",
    "service_name",
    "price_cents",
    "date",
    "slot",
    "status",
    "details",
    "customer_id",
    "pet_id",
    "created_at",
    "groomer_id",
    "duration_minutes",
    "buffer_minutes",
    "stage",
  ],
  booking_transitions: ["booking_id", "from_status"],
  booking_occupancy: ["booking_id", "date", "slot", "groomer_id"],
  invoices: [
    "id",
    "number",
    "customer_id",
    "customer_name",
    "customer_address",
    "business_snapshot",
    "issued_date",
    "due_date",
    "status",
    "subtotal_cents",
    "discount_cents",
    "tax_cents",
    "total_cents",
    "notes",
    "created_by",
    "created_at",
  ],
  invoice_items: ["id", "invoice_id", "description", "quantity", "unit_cents"],
  invoice_payments: [
    "id",
    "invoice_id",
    "kind",
    "amount_cents",
    "method",
    "reference",
    "received_date",
    "actor_id",
    "created_at",
  ],
};
export async function exportRecords(db: D1Database) {
  const data: Record<string, unknown> = {};
  for (const table of backupTables) {
    const rows = (
      await db
        .prepare(`SELECT * FROM "${table}" ORDER BY rowid LIMIT 10001`)
        .all<Record<string, unknown>>()
    ).results;
    if (rows.length > 10000)
      throw new Error("Use a D1 export for large backups");
    for (const row of rows)
      if (typeof row.snapshot === "string")
        row.snapshot = JSON.parse(row.snapshot);
    data[table] = rows;
  }
  return {
    version: 3,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(
      Object.entries(data).map(([t, rows]) => [t, (rows as unknown[]).length]),
    ),
    data,
  };
}
export async function importRecords(
  db: D1Database,
  actor: string,
  input: unknown,
) {
  const backup = z
    .object({
      version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      data: z.record(
        z.string(),
        z.array(z.record(z.string(), z.unknown())).max(2000),
      ),
    })
    .parse(input);
  const statements: D1PreparedStatement[] = [];
  // Merge records, preserving account links and existing records absent from the backup.
  for (const table of [
    "membership_tiers",
    "customers",
    "pets",
    "appointments",
    "deleted_customers",
    "members",
    "services",
    "salon_settings",
    "groomers",
    "salon_closures",
    "customer_notes",
    "care_tasks",
    "saved_views",
    "bookings",
    "booking_transitions",
    "booking_occupancy",
    "invoices",
    "invoice_items",
    "invoice_payments",
  ]) {
    for (const inputRow of backup.data[table] ?? []) {
      const row = { ...inputRow };
      if (
        table === "care_tasks" &&
        row.assigned_to &&
        !(await db
          .prepare("SELECT id FROM user_profiles WHERE id=?")
          .bind(row.assigned_to as string)
          .first())
      )
        row.assigned_to = null;
      if (
        table === "saved_views" &&
        !(await db
          .prepare("SELECT id FROM user_profiles WHERE id=?")
          .bind(row.owner_id as string)
          .first())
      )
        continue;
      if (
        ![
          "salon_settings",
          "salon_closures",
          "booking_transitions",
          "booking_occupancy",
        ].includes(table) &&
        (typeof row.id !== "string" || !row.id)
      )
        throw new Error("Backup record missing ID");
      const keys = Object.keys(row);
      if (keys.some((k) => !backupColumns[table].includes(k)))
        throw new Error("Unknown backup field");
      const values = keys.map((k) => {
        const v = row[k];
        if (k === "snapshot" && typeof v !== "string") return JSON.stringify(v);
        if (typeof v === "boolean") return Number(v);
        if (
          v === null ||
          typeof v === "string" ||
          (typeof v === "number" && Number.isFinite(v))
        )
          return v;
        throw new Error("Invalid backup value");
      });
      const updates = keys
        .filter((k) => k !== "id")
        .map((k) => `"${k}"=excluded."${k}"`)
        .join(",");
      const immutable = [
        "invoices",
        "invoice_items",
        "invoice_payments",
        "booking_transitions",
        "booking_occupancy",
      ].includes(table);
      const conflict =
        table === "salon_closures"
          ? "date"
          : table === "booking_transitions"
            ? "booking_id,from_status"
            : table === "booking_occupancy"
              ? "date,slot,groomer_id"
              : "id";
      statements.push(
        db
          .prepare(
            `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) SELECT ${keys.map(() => "?").join(",")} WHERE ${immutable && keys.includes("id") ? 'NOT EXISTS(SELECT 1 FROM "' + table + '" WHERE id=?)' : "1"} ON CONFLICT(${conflict}) ${!immutable && updates ? "DO UPDATE SET " + updates : "DO NOTHING"}`,
          )
          .bind(
            ...values,
            ...(immutable && keys.includes("id") ? [row.id as string] : []),
          ),
      );
    }
  }
  if (statements.length > 2000)
    throw new Error("Use a D1 import for large backups");
  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "backup.merge", "business-records"),
  );
  await db.batch(statements);
}
