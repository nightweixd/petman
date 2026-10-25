import { useEffect, useState } from "react";
type Service = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
};
export default function Book() {
  const [services, setServices] = useState<Service[]>([]),
    [serviceId, setService] = useState(""),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [slot, setSlot] = useState(""),
    [timezone, setTimezone] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState("");
  useEffect(() => {
    fetch("/api/public/services")
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load packages");
        return (await r.json()) as Service[];
      })
      .then(setServices)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setSlot("");
    setSlots([]);
    if (!date) return;
    const controller = new AbortController();
    fetch("/api/public/slots?date=" + date, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load slots");
        return (await r.json()) as { slots: string[]; timezone: string };
      })
      .then((d) => {
        setSlots(d.slots);
        setTimezone(d.timezone);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [date]);
  const field = "block w-full border border-stone-300 rounded-lg p-3 mt-1";
  return (
    <main className="min-h-screen bg-teal-50 px-4 py-10">
      <section className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 sm:p-9">
        <p className="text-teal-800 font-semibold mb-2">
          PetMan · Grooming appointments
        </p>
        <h1 className="text-3xl font-bold mb-3">
          A little care, just for them.
        </h1>
        <p className="text-stone-600 mb-8">
          Choose a package and time. The salon will review your request and
          confirm it with you.
        </p>
        {reference ? (
          <div role="status" className="space-y-4">
            <h2 className="text-xl font-bold">Booking request received</h2>
            <p>
              Your reference is{" "}
              <strong className="break-all">{reference}</strong>.
            </p>
            <p>
              This is pending salon confirmation. No payment is collected
              online.
            </p>
            <a href="/book" className="underline text-teal-800">
              Make another request
            </a>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              const body: Record<string, unknown> = {
                ...Object.fromEntries(f),
                serviceId,
                date,
                slot,
                consent: f.get("consent") === "on",
              };
              if (!body.birthday) delete body.birthday;
              if (!body.petBirthday) delete body.petBirthday;
              try {
                const r = await fetch("/api/public/book", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const d = (await r.json()) as { error?: string; id: string };
                if (!r.ok) throw new Error(d.error);
                setReference(d.id);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Booking failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block font-semibold">
              1. Service package
              <select
                required
                value={serviceId}
                onChange={(e) => setService(e.target.value)}
                className={field}
              >
                <option value="">Select a package</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {(s.price_cents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            {serviceId && (
              <p className="text-stone-600">
                {services.find((s) => s.id === serviceId)?.description}
              </p>
            )}
            {!services.length && (
              <p>
                No packages are currently available. Please contact the salon.
              </p>
            )}
            <label className="block font-semibold">
              2. Appointment date
              <input
                className={field}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block font-semibold">
              3. Time slot
              <select
                className={field}
                required
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                disabled={!date}
              >
                <option value="">Select an available time</option>
                {slots.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <p className="text-sm text-stone-600">
              {timezone && `Times shown in ${timezone}. `}Appointments use
              one-hour slots.{" "}
              {date && !slots.length ? "No available slots for this date." : ""}
            </p>
            <fieldset className="space-y-4">
              <legend className="font-semibold mb-4">4. Your details</legend>
              {[
                ["name", "Your name", "text", true],
                ["phone", "Phone number", "tel", true],
                ["email", "Email (optional)", "email", false],
                ["birthday", "Your birthday (optional)", "date", false],
                ["petName", "Pet name", "text", true],
                ["petBirthday", "Pet birthday (optional)", "date", false],
              ].map(([name, label, type, required]) => (
                <label key={String(name)} className="block">
                  {label}
                  <input
                    name={String(name)}
                    type={String(type)}
                    required={Boolean(required)}
                    className={field}
                    maxLength={type === "date" ? undefined : 100}
                  />
                </label>
              ))}
              <label className="block">
                Pet type
                <select name="petType" className={field}>
                  <option>Dog</option>
                  <option>Cat</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="consent"
                  className="w-5 shrink-0"
                />
                <span>
                  I would like to receive birthday offers and membership
                  promotions. Optional; you can withdraw consent by contacting
                  the salon.
                </span>
              </label>
              <p className="text-sm text-stone-600">
                We use these details to manage your appointment and membership
                record. Staff review returning-customer matches before linking
                records.
              </p>
            </fieldset>
            <p role="alert" className="text-red-700">
              {error}
            </p>
            <button
              disabled={busy || !services.length}
              className="w-full rounded-xl p-4 bg-teal-800 text-white font-semibold disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Request booking"}
            </button>
          </form>
        )}
        <a href="/" className="block mt-8 underline text-sm text-stone-600">
          Staff / member sign in
        </a>
      </section>
    </main>
  );
}
