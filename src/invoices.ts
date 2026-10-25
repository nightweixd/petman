import { z } from "zod";
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const cents = z.number().int().min(0).max(100000000);
export const invoiceSchema = z
  .object({
    customerId: z.string().uuid(),
    issuedDate: calendarDate,
    dueDate: calendarDate,
    discountCents: cents.default(0),
    taxCents: cents.default(0),
    notes: z.string().max(2000).default(""),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(300),
          quantity: z.number().int().min(1).max(999),
          unitCents: cents,
        }),
      )
      .min(1)
      .max(50),
  })
  .refine((v) => v.dueDate >= v.issuedDate, "Due date precedes invoice date");
export function invoiceTotals(input: z.infer<typeof invoiceSchema>) {
  const subtotal = input.items.reduce(
    (n, i) => n + i.quantity * i.unitCents,
    0,
  );
  if (input.discountCents > subtotal)
    throw new Error("Discount exceeds subtotal");
  const total = subtotal - input.discountCents + input.taxCents;
  if (!Number.isSafeInteger(total) || total > 100000000)
    throw new Error("Invoice total is too large");
  return { subtotal, total };
}
export async function createInvoice(
  db: D1Database,
  actor: string,
  raw: unknown,
) {
  const input = invoiceSchema.parse(raw),
    { subtotal, total } = invoiceTotals(input);
  const customer = await db
    .prepare("SELECT * FROM customers WHERE id=? AND archived_at IS NULL")
    .bind(input.customerId)
    .first<{ customer_name: string; address: string }>();
  if (!customer) throw new Error("Customer not found");
  const settings = await db
    .prepare(
      "SELECT business_name,address,phone,email,invoice_footer FROM salon_settings WHERE id=1",
    )
    .first();
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO invoices(id,number,customer_id,customer_name,customer_address,business_snapshot,issued_date,due_date,subtotal_cents,discount_cents,tax_cents,total_cents,notes,created_by) SELECT ?,COALESCE(MAX(number),0)+1,?,?,?,?,?,?,?,?,?,?,?,? FROM invoices`,
      )
      .bind(
        id,
        input.customerId,
        customer.customer_name,
        customer.address,
        JSON.stringify(settings),
        input.issuedDate,
        input.dueDate,
        subtotal,
        input.discountCents,
        input.taxCents,
        total,
        input.notes,
        actor,
      ),
    ...input.items.map((i) =>
      db
        .prepare(
          "INSERT INTO invoice_items(id,invoice_id,description,quantity,unit_cents) VALUES(?,?,?,?,?)",
        )
        .bind(crypto.randomUUID(), id, i.description, i.quantity, i.unitCents),
    ),
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "invoice.create", id),
  ]);
  return { id };
}
export const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  id: z.string().uuid(),
  kind: z.enum(["payment", "refund"]),
  amountCents: cents.refine((n) => n > 0),
  method: z.enum(["cash", "bank_transfer", "card", "other"]),
  reference: z.string().max(200).default(""),
  receivedDate: calendarDate,
});
export async function recordPayment(
  db: D1Database,
  actor: string,
  raw: unknown,
) {
  const p = paymentSchema.parse(raw);
  const duplicate = await db
    .prepare("SELECT * FROM invoice_payments WHERE id=?")
    .bind(p.id)
    .first<{
      invoice_id: string;
      kind: string;
      amount_cents: number;
      method: string;
      reference: string;
      received_date: string;
    }>();
  if (duplicate) {
    if (
      duplicate.invoice_id !== p.invoiceId ||
      duplicate.kind !== p.kind ||
      duplicate.amount_cents !== p.amountCents ||
      duplicate.method !== p.method ||
      duplicate.reference !== p.reference ||
      duplicate.received_date !== p.receivedDate
    )
      throw new Error("Payment request ID already used");
    return { success: true };
  }
  await db.batch([
    db
      .prepare(
        "INSERT INTO invoice_payments(id,invoice_id,kind,amount_cents,method,reference,received_date,actor_id) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        p.id,
        p.invoiceId,
        p.kind,
        p.amountCents,
        p.method,
        p.reference,
        p.receivedDate,
        actor,
      ),
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "invoice." + p.kind, p.invoiceId),
  ]);
  return { success: true };
}
