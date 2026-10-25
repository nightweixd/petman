import { z } from "zod";
import type { Profile } from "./permissions";

// Only these business fields may cross the API. Auth tables and raw SQL are never exposed.
export const columns: Record<string, string[]> = {
  customers: [
    "id",
    "customer_id",
    "customer_name",
    "created_at",
    "updated_at",
    "phone",
    "address",
    "tags",
  ],
  pets: [
    "id",
    "customer_id",
    "pet_name",
    "pet_type",
    "breed",
    "age",
    "address",
    "medical_history",
    "contact",
    "preferred_groomer",
    "birthday",
    "created_at",
    "updated_at",
  ],
  appointments: [
    "id",
    "pet_id",
    "day",
    "date",
    "type",
    "groomer",
    "price",
    "p_buy",
    "p_use",
    "p_left",
    "notes",
    "created_at",
  ],
  deleted_customers: [
    "id",
    "original_id",
    "customer_id",
    "customer_name",
    "snapshot",
    "deleted_at",
  ],
  members: [
    "id",
    "customer_id",
    "email",
    "date_of_birth",
    "total_spend",
    "visit_count",
    "tier_id",
    "marketing_consent",
    "consent_at",
    "last_visit_date",
    "notes",
    "created_at",
    "updated_at",
  ],
  membership_tiers: [
    "id",
    "name",
    "min_spend",
    "discount_pct",
    "color",
    "icon",
    "perks",
  ],
  user_profiles: [
    "id",
    "role",
    "staff_role",
    "customer_id",
    "full_name",
    "is_active",
    "created_at",
  ],
  services: [
    "id",
    "name",
    "description",
    "price_cents",
    "active",
    "duration_minutes",
    "buffer_minutes",
  ],
};
const scalar = z.union([
  z.string().max(20000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const querySchema = z.object({
  table: z.string(),
  action: z.enum(["select", "insert", "update", "delete"]),
  select: z.string().max(500).default("*"),
  filters: z
    .array(
      z.object({
        column: z.string(),
        op: z.enum(["eq", "neq", "in"]),
        value: z.union([scalar, z.array(scalar).max(500)]),
      }),
    )
    .max(20)
    .default([]),
  order: z.object({ column: z.string(), ascending: z.boolean() }).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(100).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  single: z.boolean().default(false),
  limit: z.number().int().min(1).max(10000).default(10000),
  offset: z.number().int().min(0).max(10000000).default(0),
});
function value(input: unknown): string | number | null {
  if (input === null) return null;
  if (typeof input === "boolean") return Number(input);
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.length <= 200000) return input;
  throw new Error("Invalid field value");
}
export async function executeQuery(
  db: D1Database,
  profile: Profile,
  input: unknown,
) {
  const q = querySchema.parse(input),
    fields = columns[q.table];
  if (!fields) throw new Error("Unknown table");
  const field = (s: string) => {
    if (!fields.includes(s)) throw new Error("Unknown field");
    return `"${s}"`;
  };
  const parameters: (string | number | null)[] = [],
    conditions: string[] = [];
  if (q.table === "customers") conditions.push("archived_at IS NULL");
  if (q.table === "pets" || q.table === "members")
    conditions.push(
      "customer_id IN (SELECT id FROM customers WHERE archived_at IS NULL)",
    );
  if (q.table === "appointments")
    conditions.push(
      "pet_id IN (SELECT p.id FROM pets p JOIN customers c ON c.id=p.customer_id WHERE c.archived_at IS NULL)",
    );
  if (q.table === "customers" && q.action === "delete")
    throw new Error("Use customer archive instead");
  if (q.table === "deleted_customers" && q.action !== "select")
    throw new Error("Recovery records are retained; use restore");
  if (profile.role === "admin" && profile.staff_role !== "owner") {
    if (q.table === "user_profiles") {
      if (q.action !== "select") throw new Error("Access denied");
      conditions.push("id = ?");
      parameters.push(profile.id);
    } else if (profile.staff_role === "groomer") {
      throw new Error("Access denied");
    } else if (
      ![
        "customers",
        "pets",
        "appointments",
        "members",
        "membership_tiers",
        "services",
      ].includes(q.table)
    )
      throw new Error("Access denied");
    if (q.table === "membership_tiers" && q.action !== "select")
      throw new Error("Access denied");
  }
  if (profile.role !== "admin") {
    if (q.action !== "select") throw new Error("Read-only account");
    switch (q.table) {
      case "customers":
        conditions.push("id = ?");
        parameters.push(profile.customer_id);
        break;
      case "pets":
      case "members":
        conditions.push("customer_id = ?");
        parameters.push(profile.customer_id);
        break;
      case "appointments":
        conditions.push(
          "pet_id IN (SELECT id FROM pets WHERE customer_id = ?)",
        );
        parameters.push(profile.customer_id);
        break;
      case "user_profiles":
        conditions.push("id = ?");
        parameters.push(profile.id);
        break;
      case "membership_tiers":
        break;
      default:
        throw new Error("Access denied");
    }
  }
  if (q.table === "user_profiles" && q.action !== "select")
    throw new Error("Use the account management endpoints");
  for (const filter of q.filters) {
    const f = field(filter.column);
    if (filter.op === "in") {
      if (!Array.isArray(filter.value)) throw new Error("Expected list");
      conditions.push(
        filter.value.length
          ? `${f} IN (${filter.value.map(() => "?").join(",")})`
          : "0",
      );
      parameters.push(...filter.value.map(value));
    } else {
      conditions.push(`${f} ${filter.op === "eq" ? "IS" : "IS NOT"} ?`);
      parameters.push(value(filter.value));
    }
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const table = `"${q.table}"`;
  let statements: D1PreparedStatement[];
  const normalize = (row: Record<string, unknown>, insert: boolean) => {
    const result: Record<string, unknown> = { ...row };
    if (insert && !result.id) result.id = crypto.randomUUID();
    if (insert && q.table === "customers" && !result.customer_id)
      result.customer_id =
        "CUST-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    if (q.table === "services") {
      if ("duration_minutes" in result)
        result.duration_minutes = z
          .number()
          .int()
          .min(15)
          .max(480)
          .refine((v) => v % 15 === 0)
          .parse(result.duration_minutes);
      if ("buffer_minutes" in result)
        result.buffer_minutes = z
          .number()
          .int()
          .min(0)
          .max(120)
          .refine((v) => v % 15 === 0)
          .parse(result.buffer_minutes);
      if ("price_cents" in result)
        result.price_cents = z
          .number()
          .int()
          .min(0)
          .max(100000000)
          .parse(result.price_cents);
    }
    if (!insert && ("id" in result || "created_at" in result))
      throw new Error("Cannot change record identity");
    if (fields.includes("updated_at"))
      result.updated_at = new Date().toISOString();
    if (q.table === "members" && "marketing_consent" in result)
      result.consent_at = new Date().toISOString();
    return Object.entries(result).map(
      ([key, v]) =>
        [
          field(key),
          key === "snapshot" ? JSON.stringify(v) : value(v),
        ] as const,
    );
  };
  if (q.action === "select") {
    // The membership screen uses this one explicit relationship, not arbitrary joins.
    const joined =
      q.table === "appointments" &&
      q.select === "price, date, pets(customer_id)";
    const selected = joined
      ? "*,(SELECT customer_id FROM pets WHERE pets.id=appointments.pet_id) AS __owner"
      : q.select === "*"
        ? "*"
        : q.select
            .split(",")
            .map((s) => field(s.trim()))
            .join(",");
    const order = q.order
      ? ` ORDER BY ${field(q.order.column)} ${q.order.ascending ? "ASC" : "DESC"}${q.order.column === "id" ? "" : ",id ASC"}`
      : "";
    const rows = (
      await db
        .prepare(
          `SELECT ${selected} FROM ${table}${where}${order || " ORDER BY id ASC"} LIMIT ? OFFSET ?`,
        )
        .bind(...parameters, q.limit, q.offset)
        .all<Record<string, unknown>>()
    ).results;
    if (joined) {
      for (const row of rows) {
        row.pets = { customer_id: row.__owner };
        delete row.__owner;
      }
    }
    for (const row of rows) {
      if (typeof row.snapshot === "string")
        row.snapshot = JSON.parse(row.snapshot);
      if ("marketing_consent" in row)
        row.marketing_consent = Boolean(row.marketing_consent);
      if ("is_active" in row) row.is_active = Boolean(row.is_active);
    }
    if (q.single && rows.length > 1) throw new Error("Expected one record");
    return q.single ? (rows[0] ?? null) : rows;
  }
  if (q.action === "insert") {
    if (!q.rows) throw new Error("Records required");
    statements = q.rows.map((row) => {
      const entries = normalize(row, true);
      return db
        .prepare(
          `INSERT INTO ${table} (${entries.map((e) => e[0]).join(",")}) VALUES (${entries.map(() => "?").join(",")}) RETURNING *`,
        )
        .bind(...entries.map((e) => e[1]));
    });
  } else {
    if (!q.filters.length) throw new Error("Mutation filter required");
    if (q.action === "delete")
      statements = [
        db
          .prepare(`DELETE FROM ${table}${where} RETURNING *`)
          .bind(...parameters),
      ];
    else {
      if (!q.values || !Object.keys(q.values).length)
        throw new Error("Changes required");
      const entries = normalize(q.values, false);
      statements = [
        db
          .prepare(
            `UPDATE ${table} SET ${entries.map((e) => `${e[0]} = ?`).join(",")}${where} RETURNING *`,
          )
          .bind(...entries.map((e) => e[1]), ...parameters),
      ];
    }
  }
  // Write audit entries in the same transaction as the mutations.
  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log (id,actor_id,action,target_id) VALUES (?,?,?,?)",
      )
      .bind(crypto.randomUUID(), profile.id, q.action, q.table),
  );
  const results = await db.batch<Record<string, unknown>>(statements);
  const rows = results.slice(0, -1).flatMap((r) => r.results);
  return q.single ? (rows[0] ?? null) : rows;
}
