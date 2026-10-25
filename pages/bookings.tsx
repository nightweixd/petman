import { useEffect, useState } from "react";
import { database } from "@/lib/database";
type Booking = {
  id: string;
  service_name: string;
  price_cents: number;
  date: string;
  slot: string;
  status: string;
  details: {
    name: string;
    phone: string;
    email: string;
    petName: string;
    consent: boolean;
  };
};
type Customer = { id: string; customer_name: string; customer_id: string };
type Service = {
  id: string;
  name: string;
  price_cents: number;
  active: number;
};
async function api(path: string, body?: unknown) {
  const r = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = (await r.json()) as any;
  if (!r.ok) throw new Error(d.error);
  return d;
}
export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [matches, setMatches] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [b, c, s] = await Promise.all([
        api("/api/admin/bookings"),
        database.from("customers").select("id,customer_name,customer_id"),
        database.from("services").select("*"),
      ]);
      setBookings(b);
      setCustomers(c.data ?? []);
      setServices(s.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function transition(b: Booking, status: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/booking-status", {
        id: b.id,
        status,
        ...(matches[b.id] ? { customerId: matches[b.id] } : {}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-teal-50 p-4 sm:p-8">
      <section className="max-w-3xl mx-auto space-y-6">
        <a className="underline text-teal-800" href="/">
          Back to PetMan
        </a>
        <h1 className="text-3xl font-bold">Bookings & packages</h1>
        <p>
          Share{" "}
          <a className="underline text-teal-800" href="/book">
            the booking page
          </a>{" "}
          with customers. One appointment per hour, 09:00–17:00, in the
          configured salon timezone. No online payments.
        </p>
        <p role="alert" className="text-red-700">
          {error}
        </p>
        <h2 className="text-xl font-bold">Booking requests</h2>
        {!bookings.length && <p>No booking requests yet.</p>}
        {bookings.map((b) => (
          <article
            key={b.id}
            className="bg-white border rounded-xl p-5 space-y-3"
          >
            <h3 className="font-bold">
              {b.details.petName} · {b.service_name}
            </h3>
            <p>
              {b.date} at {b.slot} · {b.status}
            </p>
            <p>
              {b.details.name} · {b.details.phone} · {b.details.email}
            </p>
            {b.status === "pending" && (
              <label className="block">
                Membership record
                <select
                  value={matches[b.id] ?? ""}
                  onChange={(e) =>
                    setMatches((m) => ({ ...m, [b.id]: e.target.value }))
                  }
                  className="block w-full mt-1 border rounded-lg p-3"
                >
                  <option value="">Create a new customer and membership</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name} ({c.customer_id})
                    </option>
                  ))}
                </select>
                <span className="text-sm text-stone-600">
                  Verify identity with the customer before linking to an
                  existing record. A new pet record will be added.
                </span>
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              {b.status === "pending" && (
                <button
                  disabled={busy}
                  className="rounded-lg p-3 bg-teal-800 text-white"
                  onClick={() => transition(b, "confirmed")}
                >
                  Confirm & capture membership
                </button>
              )}
              {b.status === "confirmed" && (
                <button
                  disabled={busy}
                  className="rounded-lg p-3 bg-teal-800 text-white"
                  onClick={() => transition(b, "completed")}
                >
                  Complete visit ({(b.price_cents / 100).toFixed(2)})
                </button>
              )}
              {["pending", "confirmed"].includes(b.status) && (
                <button
                  disabled={busy}
                  className="rounded-lg border p-3"
                  onClick={() => transition(b, "cancelled")}
                >
                  Cancel booking
                </button>
              )}
            </div>
          </article>
        ))}
        <section className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="text-xl font-bold">Service packages</h2>
          <p className="text-sm text-stone-600">
            All packages use a one-hour slot. The listed amount is saved on each
            booking; discounts and payment collection are handled by staff.
          </p>
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4">
              <p>
                {s.name} · {(s.price_cents / 100).toFixed(2)} ·{" "}
                {s.active ? "Available" : "Hidden"}
              </p>
              <button
                disabled={busy}
                className="border p-3 rounded-lg"
                onClick={async () => {
                  setBusy(true);
                  const r = await database
                    .from("services")
                    .update({ active: s.active ? 0 : 1 })
                    .eq("id", s.id);
                  if (r.error) setError(r.error.message);
                  await load();
                  setBusy(false);
                }}
              >
                {s.active ? "Hide" : "Show"}
              </button>
            </div>
          ))}
          <form
            className="space-y-4 border-t pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              setBusy(true);
              const r = await database
                .from("services")
                .insert({
                  name: String(f.get("name")),
                  description: String(f.get("description")),
                  price_cents: Math.round(Number(f.get("price")) * 100),
                });
              if (r.error) setError(r.error.message);
              else form.reset();
              await load();
              setBusy(false);
            }}
          >
            {[
              ["name", "Package name", "text"],
              ["description", "Description", "text"],
              ["price", "Amount", "number"],
            ].map(([name, label, type]) => (
              <label key={name} className="block">
                {label}
                <input
                  name={name}
                  type={type}
                  required
                  min={type === "number" ? 0 : undefined}
                  step={type === "number" ? ".01" : undefined}
                  maxLength={300}
                  className="block w-full border rounded-lg p-3"
                />
              </label>
            ))}
            <button disabled={busy} className="p-3 border rounded-lg">
              Add package
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
