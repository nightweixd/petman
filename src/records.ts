import { z } from "zod";
export async function archiveCustomer(
  db: D1Database,
  actor: string,
  customerId: string,
) {
  const customer = await db
    .prepare("SELECT * FROM customers WHERE id=? AND archived_at IS NULL")
    .bind(customerId)
    .first<{ id: string; customer_name: string; customer_id: string }>();
  if (!customer) throw new Error("Customer not found");
  const id = crypto.randomUUID();
  // A soft archive retains original identities, memberships, account links and bookings.
  const snapshot = {
    version: 3,
    id: customer.id,
    customerName: customer.customer_name,
    customerId: customer.customer_id,
    pets: [],
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO deleted_customers(id,original_id,customer_id,customer_name,snapshot) VALUES(?,?,?,?,?)",
      )
      .bind(
        id,
        customer.id,
        customer.customer_id,
        customer.customer_name,
        JSON.stringify(snapshot),
      ),
    db
      .prepare(
        "UPDATE customers SET archived_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL",
      )
      .bind(customerId),
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "customer.archive", customerId),
  ]);
  return { success: true };
}
export async function restoreCustomer(
  db: D1Database,
  actor: string,
  id: string,
) {
  const log = await db
    .prepare("SELECT * FROM deleted_customers WHERE id=?")
    .bind(id)
    .first<{ original_id: string; snapshot: string }>();
  if (!log) throw new Error("Recovery record not found");
  const s = JSON.parse(log.snapshot);
  const statements: D1PreparedStatement[] = [];
  if (s.version === 3) {
    if (
      !(await db
        .prepare(
          "SELECT id FROM customers WHERE id=? AND archived_at IS NOT NULL",
        )
        .bind(log.original_id)
        .first())
    )
      throw new Error("Customer is already active");
    statements.push(
      db
        .prepare("UPDATE customers SET archived_at=NULL WHERE id=?")
        .bind(log.original_id),
    );
  } else {
    // Older snapshots contain only customer/pet/visit data. Never discard the snapshot on partial recovery.
    const customer = z
      .object({
        customerName: z.string(),
        customerId: z.string().nullable(),
        pets: z.array(
          z.object({
            id: z.string(),
            petName: z.string(),
            petType: z.string().nullable().optional(),
            breed: z.string().nullable().optional(),
            age: z.number().nullable().optional(),
            address: z.string().nullable().optional(),
            medicalHistory: z.string().nullable().optional(),
            contact: z.string().nullable().optional(),
            preferredGroomer: z.string().nullable().optional(),
            appointments: z.array(
              z.object({
                id: z.string(),
                day: z.string().nullable().optional(),
                date: z.string().nullable().optional(),
                type: z.string().nullable().optional(),
                groomer: z.string().nullable().optional(),
                price: z.number().nullable().optional(),
                pBuy: z.number().nullable().optional(),
                pUse: z.number().nullable().optional(),
                pLeft: z.number().nullable().optional(),
                notes: z.string().nullable().optional(),
              }),
            ),
          }),
        ),
      })
      .parse(s);
    statements.push(
      db
        .prepare(
          "INSERT INTO customers(id,customer_id,customer_name) VALUES(?,?,?)",
        )
        .bind(log.original_id, customer.customerId, customer.customerName),
    );
    for (const p of customer.pets) {
      statements.push(
        db
          .prepare(
            "INSERT INTO pets(id,customer_id,pet_name,pet_type,breed,age,address,medical_history,contact,preferred_groomer) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            p.id,
            log.original_id,
            p.petName,
            p.petType ?? null,
            p.breed ?? null,
            p.age ?? null,
            p.address ?? null,
            p.medicalHistory ?? null,
            p.contact ?? null,
            p.preferredGroomer ?? null,
          ),
      );
      for (const a of p.appointments)
        statements.push(
          db
            .prepare(
              "INSERT INTO appointments(id,pet_id,day,date,type,groomer,price,p_buy,p_use,p_left,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              a.id,
              p.id,
              a.day ?? null,
              a.date ?? null,
              a.type ?? null,
              a.groomer ?? null,
              a.price ?? null,
              a.pBuy ?? null,
              a.pUse ?? null,
              a.pLeft ?? null,
              a.notes ?? null,
            ),
        );
    }
  }
  statements.push(
    db.prepare("DELETE FROM deleted_customers WHERE id=?").bind(id),
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "customer.restore", log.original_id),
  );
  await db.batch(statements);
  return { success: true, customerId: log.original_id };
}
