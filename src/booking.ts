import { z } from "zod";
export const slots = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const bookingSchema = z.object({
  serviceId: z.string().max(100),
  date,
  slot: z.enum(slots as [string, ...string[]]),
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^\+?[\d\s()-]+$/),
  email: z.union([z.string().email().max(254), z.literal("")]),
  birthday: date.optional(),
  petBirthday: date.optional(),
  petName: z.string().trim().min(1).max(100),
  petType: z.enum(["Dog", "Cat", "Other"]),
  consent: z.boolean(),
});
export function validSlot(day: string, slot: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const days = (Date.parse(day) - Date.parse(today)) / 86400000;
  return (
    days >= 0 &&
    days <= 90 &&
    slots.includes(slot) &&
    (day !== today || slot > `${parts.hour}:${parts.minute}`)
  );
}
export async function transitionBooking(
  db: D1Database,
  actor: string,
  input: unknown,
) {
  const { id, status, customerId } = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["confirmed", "completed", "cancelled"]),
      customerId: z.string().uuid().optional(),
    })
    .parse(input);
  const booking = await db
    .prepare("SELECT * FROM bookings WHERE id=?")
    .bind(id)
    .first<{
      id: string;
      status: string;
      details: string;
      date: string;
      slot: string;
      price_cents: number;
      service_name: string;
      pet_id: string;
    }>();
  if (!booking) throw new Error("Booking not found");
  const details = bookingSchema.parse(JSON.parse(booking.details));
  const statements: D1PreparedStatement[] = [];
  if (status === "confirmed" && booking.status === "pending") {
    const customer = customerId ?? crypto.randomUUID(),
      pet = crypto.randomUUID();
    if (
      customerId &&
      !(await db
        .prepare("SELECT id FROM customers WHERE id=?")
        .bind(customer)
        .first())
    )
      throw new Error("Customer not found");
    if (!customerId)
      statements.push(
        db
          .prepare(
            "INSERT INTO customers(id,customer_id,customer_name) VALUES(?,?,?)",
          )
          .bind(customer, "WEB-" + customer.slice(0, 8), details.name),
      );
    statements.push(
      db
        .prepare(
          "INSERT INTO pets(id,customer_id,pet_name,pet_type,contact,birthday) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          pet,
          customer,
          details.petName,
          details.petType,
          details.phone,
          details.petBirthday ?? null,
        ),
    );
    // A guest submission must never overwrite existing identity or membership details.
    statements.push(
      db
        .prepare(
          "INSERT INTO members(id,customer_id,email,date_of_birth,marketing_consent,consent_at) VALUES(?,?,?,?,?,?) ON CONFLICT(customer_id) DO NOTHING",
        )
        .bind(
          crypto.randomUUID(),
          customer,
          details.email,
          details.birthday ?? null,
          Number(details.consent),
          new Date().toISOString(),
        ),
    );
    statements.push(
      db
        .prepare(
          "UPDATE bookings SET status='confirmed',customer_id=?,pet_id=? WHERE id=? AND status='pending'",
        )
        .bind(customer, pet, id),
    );
  } else if (status === "completed" && booking.status === "confirmed") {
    statements.push(
      db
        .prepare(
          "INSERT INTO appointments(id,pet_id,date,type,price,notes) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          "booking-" + id,
          booking.pet_id,
          booking.date,
          booking.service_name,
          booking.price_cents / 100,
          "Booking " + id + " at " + booking.slot,
        ),
    );
    statements.push(
      db
        .prepare(
          "UPDATE bookings SET status='completed' WHERE id=? AND status='confirmed'",
        )
        .bind(id),
    );
  } else if (
    status === "cancelled" &&
    ["pending", "confirmed"].includes(booking.status)
  )
    statements.push(
      db
        .prepare(
          "UPDATE bookings SET status='cancelled' WHERE id=? AND status IN ('pending','confirmed')",
        )
        .bind(id),
    );
  else throw new Error("Invalid booking transition");
  // One transition from each state: competing staff actions roll back atomically.
  statements.unshift(
    db
      .prepare(
        "INSERT INTO booking_transitions(booking_id,from_status) VALUES(?,?)",
      )
      .bind(id, booking.status),
  );
  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log(id,actor_id,action,target_id) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "booking." + status, id),
  );
  await db.batch(statements);
}
