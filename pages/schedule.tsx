import { useEffect, useState } from "react";
import { database } from "@/lib/database";
import { api } from "@/lib/workspace";
import { ErrorMessage, Field, Heading } from "@/components/Operations";
type Settings = {
  business_name: string;
  address: string;
  phone: string;
  email: string;
  invoice_footer: string;
  opening: string;
  closing: string;
  closed_weekdays: string;
  minimum_notice_minutes: number;
};
type Groomer = {
  id: string;
  name: string;
  active: number;
  opening: string;
  closing: string;
  closed_weekdays: string;
  break_start: string;
  break_end: string;
};
type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
};
type Config = {
  settings: Settings;
  groomers: Groomer[];
  closures: { date: string; reason: string }[];
};
export default function Schedule() {
  const [config, setConfig] = useState<Config | null>(null),
    [services, setServices] = useState<Service[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [c, s] = await Promise.all([
        api<Config>("/settings"),
        database.from("services").select("*"),
      ]);
      if (s.error) throw new Error(s.error.message);
      setConfig(c);
      setServices(s.data);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function save(path: string, body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, body);
      setMessage(
        "Saved. Existing bookings remain unchanged; new availability uses these settings.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ops-workspace">
      <ErrorMessage error={error} />
      {message && (
        <p role="status" className="ops-success">
          {message}
        </p>
      )}
      {!config ? (
        <p>Loading salon settings…</p>
      ) : (
        <>
          <section className="pm-table-card ops-pad">
            <Heading
              title="Salon & invoice details"
              description="Business details are captured on each new invoice."
            />
            <form
              className="ops-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                void save("/settings", {
                  ...f,
                  minimum_notice_minutes: Number(f.minimum_notice_minutes),
                });
              }}
            >
              {[
                ["business_name", "Business name"],
                ["address", "Business address"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["invoice_footer", "Invoice footer"],
              ].map(([name, label]) => (
                <Field key={name} label={label}>
                  <input
                    required={name === "business_name"}
                    name={name}
                    defaultValue={config.settings[name as keyof Settings]}
                    maxLength={name === "invoice_footer" ? 1000 : 500}
                  />
                </Field>
              ))}
              <Hours value={config.settings} />
              <Field label="Minimum booking notice (minutes)">
                <input
                  required
                  type="number"
                  min={0}
                  max={10080}
                  name="minimum_notice_minutes"
                  defaultValue={config.settings.minimum_notice_minutes}
                />
              </Field>
              <button className="pm-button pm-primary" disabled={busy}>
                Save salon settings
              </button>
            </form>
          </section>
          <section className="pm-table-card ops-pad">
            <Heading
              title="Groomers & availability"
              description="Each active groomer has independent capacity, hours and breaks."
            />
            {[
              ...config.groomers,
              {
                id: "",
                name: "",
                active: 1,
                opening: "09:00",
                closing: "17:00",
                closed_weekdays: "",
                break_start: "",
                break_end: "",
              },
            ].map((g) => (
              <form
                key={g.id || "new"}
                className="ops-form ops-line"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  void save("/groomers", {
                    ...f,
                    id: g.id || crypto.randomUUID(),
                    active: Number(f.active),
                  });
                }}
              >
                <h3>{g.name || "Add groomer"}</h3>
                <Field label="Groomer name">
                  <input
                    required
                    name="name"
                    defaultValue={g.name}
                    maxLength={100}
                  />
                </Field>
                <Hours value={g} />
                <div className="ops-grid">
                  <Field label="Break start (optional)">
                    <input
                      type="time"
                      step={900}
                      name="break_start"
                      defaultValue={g.break_start}
                    />
                  </Field>
                  <Field label="Break end (optional)">
                    <input
                      type="time"
                      step={900}
                      name="break_end"
                      defaultValue={g.break_end}
                    />
                  </Field>
                </div>
                <Field label="Availability">
                  <select name="active" defaultValue={g.active}>
                    <option value={1}>Accept bookings</option>
                    <option value={0}>Inactive</option>
                  </select>
                </Field>
                <button className="pm-button" disabled={busy}>
                  {g.id ? "Save groomer" : "Add groomer"}
                </button>
              </form>
            ))}
          </section>
          <section className="pm-table-card ops-pad">
            <Heading
              title="Service durations"
              description="Booking capacity includes the service time and cleanup buffer."
            />
            {services.map((s) => (
              <form
                key={s.id}
                className="ops-filter"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  try {
                    const r = await database
                      .from("services")
                      .update({
                        duration_minutes: Number(f.get("duration")),
                        buffer_minutes: Number(f.get("buffer")),
                      })
                      .eq("id", s.id);
                    if (r.error) throw new Error(r.error.message);
                    setMessage("Service duration saved.");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <strong>{s.name}</strong>
                <Field label="Duration (minutes)">
                  <input
                    required
                    name="duration"
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    defaultValue={s.duration_minutes}
                  />
                </Field>
                <Field label="Buffer (minutes)">
                  <input
                    required
                    name="buffer"
                    type="number"
                    min={0}
                    max={120}
                    step={15}
                    defaultValue={s.buffer_minutes}
                  />
                </Field>
                <button className="pm-button" disabled={busy}>
                  Save duration
                </button>
              </form>
            ))}
            {!services.length && (
              <a href="/bookings">Add service packages in Bookings first.</a>
            )}
          </section>
          <section className="pm-table-card ops-pad">
            <Heading
              title="Holidays & closed dates"
              description="Closed dates stop new online bookings. Contact existing bookings separately."
            />
            <form
              className="ops-filter"
              onSubmit={(e) => {
                e.preventDefault();
                void save(
                  "/closures",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              }}
            >
              <Field label="Closed date">
                <input required name="date" type="date" />
              </Field>
              <Field label="Reason">
                <input required name="reason" maxLength={200} />
              </Field>
              <button className="pm-button" disabled={busy}>
                Close date
              </button>
            </form>
            {config.closures.map((c) => (
              <div className="ops-task" key={c.date}>
                <span>
                  {c.date} · {c.reason}
                </span>
                <button
                  className="pm-button"
                  disabled={busy}
                  onClick={() => void save("/closures", { ...c, remove: true })}
                >
                  Reopen date
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
function Hours({
  value,
}: {
  value: { opening: string; closing: string; closed_weekdays: string };
}) {
  const [closed, setClosed] = useState(value.closed_weekdays);
  return (
    <>
      <div className="ops-grid">
        <Field label="Opening time">
          <input
            required
            type="time"
            step={900}
            name="opening"
            defaultValue={value.opening}
          />
        </Field>
        <Field label="Closing time">
          <input
            required
            type="time"
            step={900}
            name="closing"
            defaultValue={value.closing}
          />
        </Field>
      </div>
      <fieldset className="ops-weekdays">
        <legend>Closed weekdays</legend>
        {[
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map((d, i) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={closed.split(",").includes(String(i))}
              onChange={(e) =>
                setClosed((v) => {
                  const list = v ? v.split(",") : [];
                  return (
                    e.target.checked
                      ? [...list, String(i)]
                      : list.filter((n) => n !== String(i))
                  )
                    .sort()
                    .join(",");
                })
              }
            />
            {d}
          </label>
        ))}
      </fieldset>
      <input type="hidden" name="closed_weekdays" value={closed} />
    </>
  );
}
