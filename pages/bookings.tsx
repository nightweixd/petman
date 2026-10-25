import Drawer from "@/components/Drawer";
import Icon from "@/components/Icon";
import { useEffect, useState } from "react";
import { database } from "@/lib/database";
type Booking = {
  customer_id: string | null;
  pet_id: string | null;
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
    [petMatches, setPetMatches] = useState<Record<string, string>>({}),
    [matchingPets, setMatchingPets] = useState<
      { id: string; pet_name: string }[]
    >([]),
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
        ...(petMatches[b.id] ? { petId: petMatches[b.id] } : {}),
      });
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const [tab, setTab] = useState("requests"),
    [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Booking | null>(null),
    [creating, setCreating] = useState(false);
  const filtered = bookings.filter(
    (b) =>
      (status === "all" || b.status === status) &&
      [b.details.name, b.details.petName, b.service_name].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <div>
      <div className="pm-page-tabs">
        <button
          className={tab === "requests" ? "is-active" : ""}
          onClick={() => setTab("requests")}
        >
          Booking requests{" "}
          <span>{bookings.filter((b) => b.status === "pending").length}</span>
        </button>
        <button
          className={tab === "packages" ? "is-active" : ""}
          onClick={() => setTab("packages")}
        >
          Service packages
        </button>
      </div>
      {error && (
        <p role="alert" className="pm-inline-error">
          {error}
        </p>
      )}
      {tab === "requests" ? (
        <section className="pm-table-card">
          <div className="pm-table-toolbar">
            <div>
              <h2>
                All bookings <span>{bookings.length}</span>
              </h2>
              <p>
                Review requests, confirm appointments and record completed
                visits.
              </p>
            </div>
            <a className="pm-button pm-primary" href="/book" target="_blank">
              Booking page
              <Icon name="arrow" size={15} />
            </a>
          </div>
          <div className="pm-table-controls">
            <label className="pm-search">
              <Icon name="search" size={17} />
              <input
                aria-label="Search bookings"
                placeholder="Search customer, pet or package…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="pm-control-select"
              aria-label="Booking status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["all", "pending", "confirmed", "completed", "cancelled"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v === "all"
                      ? "All statuses"
                      : v[0].toUpperCase() + v.slice(1)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="pm-table-scroll">
            <table className="pm-data-table">
              <thead>
                <tr>
                  <th>Customer & pet</th>
                  <th>Package</th>
                  <th>Date & time</th>
                  <th>Status</th>
                  <th className="pm-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <button
                        className="pm-customer-name"
                        onClick={() => setSelected(b)}
                      >
                        <span className="pm-avatar">
                          {b.details.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{b.details.name}</strong>
                          <small>{b.details.petName}</small>
                        </span>
                      </button>
                    </td>
                    <td>{b.service_name}</td>
                    <td>
                      <div className="pm-pet-cell">
                        <span>{b.date}</span>
                        <small>{b.slot}</small>
                      </div>
                    </td>
                    <td>
                      <span className={"pm-status " + b.status}>
                        <i />
                        {b.status[0].toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                    <td className="pm-right pm-amount">
                      RM {(b.price_cents / 100).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className="pm-icon-button"
                        aria-label={"View booking for " + b.details.petName}
                        onClick={() => setSelected(b)}
                      >
                        <Icon name="chevron" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="pm-empty">
              <Icon name="calendar" size={30} />
              <h3>No bookings found</h3>
              <p>
                New requests will appear here when customers use your booking
                page.
              </p>
            </div>
          )}
          <div className="pm-table-footer">
            <span>{filtered.length} bookings</span>
            <span>One-hour appointments · Salon timezone</span>
          </div>
        </section>
      ) : (
        <section className="pm-table-card">
          <div className="pm-table-toolbar">
            <div>
              <h2>
                Service packages <span>{services.length}</span>
              </h2>
              <p>Packages shown on your public booking page.</p>
            </div>
            <button
              className="pm-button pm-primary"
              onClick={() => setCreating(true)}
            >
              <Icon name="plus" size={16} />
              Add package
            </button>
          </div>
          <div className="pm-table-scroll">
            <table className="pm-data-table">
              <thead>
                <tr>
                  <th>Package name</th>
                  <th>Duration</th>
                  <th>Availability</th>
                  <th className="pm-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>1 hour</td>
                    <td>
                      <span
                        className={
                          "pm-status " + (s.active ? "member" : "neutral")
                        }
                      >
                        <i />
                        {s.active ? "Available" : "Hidden"}
                      </span>
                    </td>
                    <td className="pm-right pm-amount">
                      RM {(s.price_cents / 100).toFixed(2)}
                    </td>
                    <td className="pm-right">
                      <button
                        disabled={busy}
                        className="pm-button"
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
                        {s.active ? "Hide package" : "Show package"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!services.length && (
            <div className="pm-empty">
              <Icon name="calendar" size={30} />
              <h3>No service packages yet</h3>
              <p>Add your first package to open online booking.</p>
            </div>
          )}
        </section>
      )}
      {selected && (
        <Drawer
          title={selected.details.petName}
          eyebrow="Bookings / Request details"
          onClose={() => setSelected(null)}
        >
          <div className="pm-drawer-form">
            <section className="pm-record-summary">
              <span className={"pm-status " + selected.status}>
                <i />
                {selected.status}
              </span>
              <h3>{selected.service_name}</h3>
              <p>
                {selected.date} at {selected.slot} · RM{" "}
                {(selected.price_cents / 100).toFixed(2)}
              </p>
            </section>
            <dl className="pm-record-fields">
              <div>
                <dt>Customer</dt>
                <dd>{selected.details.name}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.details.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.details.email || "Not provided"}</dd>
              </div>
            </dl>
            {selected.status === "pending" && (
              <label>
                Membership record
                <select
                  value={selected.customer_id ?? matches[selected.id] ?? ""}
                  disabled={!!selected.customer_id}
                  onChange={async (e) => {
                    const customerId = e.target.value;
                    setMatches((m) => ({ ...m, [selected.id]: customerId }));
                    setPetMatches((m) => ({ ...m, [selected.id]: "" }));
                    setMatchingPets([]);
                    if (customerId) {
                      const r = await database
                        .from("pets")
                        .select("id,pet_name")
                        .eq("customer_id", customerId);
                      if (!r.error) setMatchingPets(r.data ?? []);
                    }
                  }}
                >
                  <option value="">Create a new customer and membership</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name} ({c.customer_id})
                    </option>
                  ))}
                </select>
                <small>
                  Verify identity before linking an existing customer, then
                  select their pet below.
                </small>
              </label>
            )}
            {selected.status === "pending" &&
              !selected.pet_id &&
              matches[selected.id] && (
                <label>
                  Pet record
                  <select
                    value={petMatches[selected.id] ?? ""}
                    onChange={(e) =>
                      setPetMatches((m) => ({
                        ...m,
                        [selected.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Create a new pet</option>
                    {matchingPets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pet_name}
                        {p.pet_name.toLowerCase() ===
                        selected.details.petName.toLowerCase()
                          ? " · name matches"
                          : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    Choose an existing pet to keep its visit history together.
                  </small>
                </label>
              )}
            <p className="pm-form-note">
              Confirming captures the customer and pet details in your records.
              No online payment is collected.
            </p>
            <div className="pm-drawer-actions">
              {["pending", "confirmed"].includes(selected.status) && (
                <button
                  disabled={busy}
                  className="pm-button"
                  onClick={async () => {
                    if (await transition(selected, "cancelled"))
                      setSelected(null);
                  }}
                >
                  Cancel booking
                </button>
              )}
              {selected.status === "pending" && (
                <button
                  disabled={busy}
                  className="pm-button pm-primary"
                  onClick={async () => {
                    if (await transition(selected, "confirmed"))
                      setSelected(null);
                  }}
                >
                  {busy ? "Confirming…" : "Confirm booking"}
                </button>
              )}
              {selected.status === "confirmed" && (
                <button
                  disabled={busy}
                  className="pm-button pm-primary"
                  onClick={async () => {
                    if (await transition(selected, "completed"))
                      setSelected(null);
                  }}
                >
                  {busy ? "Saving…" : "Complete visit"}
                </button>
              )}
            </div>
          </div>
        </Drawer>
      )}
      {creating && (
        <Drawer
          title="New service package"
          eyebrow="Bookings / Service packages"
          onClose={() => setCreating(false)}
        >
          <form
            className="pm-drawer-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              setBusy(true);
              const r = await database.from("services").insert({
                name: String(f.get("name")),
                description: String(f.get("description")),
                price_cents: Math.round(Number(f.get("price")) * 100),
              });
              if (r.error) setError(r.error.message);
              else {
                form.reset();
                setCreating(false);
              }
              await load();
              setBusy(false);
            }}
          >
            <p>
              Add the package name, details and quoted amount customers will see
              when booking.
            </p>
            {[
              ["name", "Package name", "text"],
              ["description", "Description", "text"],
              ["price", "Amount (RM)", "number"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type={type}
                  required
                  min={type === "number" ? 0 : undefined}
                  step={type === "number" ? ".01" : undefined}
                  maxLength={300}
                />
              </label>
            ))}
            <p className="pm-form-note">
              Set durations and buffers in Salon settings. Discounts and
              payments are handled by staff.
            </p>
            {error && (
              <p className="pm-inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="pm-drawer-actions">
              <button
                type="button"
                className="pm-button"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button disabled={busy} className="pm-button pm-primary">
                {busy ? "Saving…" : "Add package"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
