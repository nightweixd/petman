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
] as const;
export async function exportRecords(db: D1Database) {
  const data: Record<string, unknown> = {};
  for (const table of backupTables) {
    const rows = (
      await db
        .prepare(`SELECT * FROM "${table}" LIMIT 10001`)
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
    version: 2,
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
      version: z.union([z.literal(1), z.literal(2)]),
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
  ]) {
    for (const row of backup.data[table] ?? []) {
      if (typeof row.id !== "string" || !row.id)
        throw new Error("Backup record missing ID");
      const keys = Object.keys(row);
      if (keys.some((k) => !columns[table].includes(k)))
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
      statements.push(
        db
          .prepare(
            `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")}) ON CONFLICT(id) ${updates ? "DO UPDATE SET " + updates : "DO NOTHING"}`,
          )
          .bind(...values),
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
