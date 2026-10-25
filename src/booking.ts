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
export class BookingError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 409,
  ) {
    super(message);
  }
}

// A signed-in request uses the server-verified customer and pet, never submitted IDs.
export async function requestBooking(
  db: D1Database,
  timezone: string,
  raw: unknown,
  customerId: string | null = null,
) {
  let petId: string | null = null;
  let input = bookingSchema.parse(raw);
  if (customerId) {
    const selected = z
      .object({ petId: z.string().uuid().optional() })
      .parse(raw);
    if (selected.petId) {
      const pet = await db
        .prepare(
          "SELECT pet_name,pet_type,birthday FROM pets WHERE id=? AND customer_id=?",
        )
        .bind(selected.petId, customerId)
        .first<{
          pet_name: string;
          pet_type: string;
          birthday: string | null;
        }>();
      if (!pet)
        throw new BookingError("Choose a pet from your own account.", 403);
      petId = selected.petId;
      input = {
        ...input,
        petName: pet.pet_name,
        petType: ["Dog", "Cat"].includes(pet.pet_type)
          ? (pet.pet_type as "Dog" | "Cat")
          : "Other",
        petBirthday: pet.birthday ?? undefined,
      };
    }
  }
  if (!validSlot(input.date, input.slot, timezone))
    throw new BookingError("Choose a future slot within 90 days.", 400);
  const service = await db
    .prepare("SELECT name,price_cents FROM services WHERE id=? AND active=1")
    .bind(input.serviceId)
    .first<{ name: string; price_cents: number }>();
  if (!service)
    throw new BookingError("Package unavailable. Please choose another.", 400);
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO bookings(id,service_id,service_name,price_cents,date,slot,details,customer_id,pet_id) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        input.serviceId,
        service.name,
        service.price_cents,
        input.date,
        input.slot,
        JSON.stringify(input),
        customerId,
        petId,
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new BookingError(
        "That slot was just booked. Please choose another.",
        409,
      );
    throw error;
  }
  return { id, status: "pending" };
}
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
      pet_id: string | null;
      customer_id: string | null;
    }>();
  if (!booking) throw new Error("Booking not found");
  const details = bookingSchema.parse(JSON.parse(booking.details));
  const statements: D1PreparedStatement[] = [];
  if (status === "confirmed" && booking.status === "pending") {
    if (booking.customer_id && customerId && customerId !== booking.customer_id)
      throw new BookingError(
        "This request is already linked to a customer.",
        409,
      );
    const linkedCustomer = booking.customer_id ?? customerId;
    const customer = linkedCustomer ?? crypto.randomUUID(),
      pet = booking.pet_id ?? crypto.randomUUID();
    if (
      linkedCustomer &&
      !(await db
        .prepare("SELECT id FROM customers WHERE id=?")
        .bind(customer)
        .first())
    )
      throw new Error("Customer not found");
    if (!linkedCustomer)
      statements.push(
        db
          .prepare(
            "INSERT INTO customers(id,customer_id,customer_name) VALUES(?,?,?)",
          )
          .bind(customer, "WEB-" + customer.slice(0, 8), details.name),
      );
    if (!booking.pet_id)
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
