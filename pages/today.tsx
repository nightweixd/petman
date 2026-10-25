import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, today } from "@/lib/workspace";
import { Empty, ErrorMessage, Field, Heading } from "@/components/Operations";
type Booking = {
  id: string;
  slot: string;
  duration_minutes: number;
  status: string;
  stage: string;
  groomer_name: string;
  medical_history?: string;
  details: string;
};
const stages = ["scheduled", "arrived", "grooming", "ready", "collected"];
export default function Today() {
  const [date, setDate] = useState(today),
    [rows, setRows] = useState<Booking[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [phone, setPhone] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<Booking[]>("/today?date=" + date));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="ops-workspace">
      <section className="pm-table-card">
        <Heading
          title="Salon day board"
          description="Track each pet from arrival to collection."
        >
          <Field label="Appointment date">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <button className="pm-button" onClick={() => void load()}>
            Refresh
          </button>
          <Link className="pm-button" href="/bookings">
            Review requests
          </Link>
        </Heading>
        <ErrorMessage error={error} />
        <div className="ops-board">
          {stages.map((stage) => (
            <section key={stage} className="ops-board-column">
              <h3>
                {stage[0].toUpperCase() + stage.slice(1)}{" "}
                <span>{rows.filter((b) => b.stage === stage).length}</span>
              </h3>
              {rows
                .filter((b) => b.stage === stage)
                .map((b) => {
                  const d = JSON.parse(b.details) as {
                    name: string;
                    petName: string;
                    phone: string;
                  };
                  return (
                    <article className="ops-booking-card" key={b.id}>
                      <div className="ops-actions">
                        <strong>{b.slot}</strong>
                        <span>{b.duration_minutes} min</span>
                      </div>
                      <h4>{d.petName}</h4>
                      <p>{d.name}</p>
                      {b.medical_history && (
                        <p className="ops-alert">
                          Care alert: {b.medical_history}
                        </p>
                      )}
                      <small>
                        {b.groomer_name ?? "Salon"} · {b.status}
                      </small>
                      {b.status !== "pending" && (
                        <Field label={"Stage for " + d.petName}>
                          <select
                            disabled={busy === b.id}
                            value={b.stage}
                            onChange={async (e) => {
                              setBusy(b.id);
                              try {
                                await api("/stage", {
                                  id: b.id,
                                  stage: e.target.value,
                                });
                                await load();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy("");
                              }
                            }}
                          >
                            {stages.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label={"Message for " + d.petName}>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            let digits = d.phone.replace(/\D/g, "");
                            if (digits.startsWith("0"))
                              digits = "60" + digits.slice(1);
                            setPhone(digits);
                            const texts: Record<string, string> = {
                              confirmation: `Hi ${d.name}, your appointment for ${d.petName} is confirmed for ${date} at ${b.slot}. Please let us know if you need to reschedule.`,
                              reminder: `Hi ${d.name}, a reminder that ${d.petName}'s grooming appointment is on ${date} at ${b.slot}. We look forward to seeing you.`,
                              ready: `Hi ${d.name}, ${d.petName} is ready for collection. Thank you!`,
                            };
                            setMessage(texts[e.target.value] ?? "");
                            e.target.value = "";
                          }}
                        >
                          <option value="">Prepare message…</option>
                          <option value="confirmation">Confirmation</option>
                          <option value="reminder">Appointment reminder</option>
                          <option value="ready">Ready for collection</option>
                        </select>
                      </Field>
                    </article>
                  );
                })}
            </section>
          ))}
        </div>
        {!rows.length && (
          <Empty>
            {loading
              ? "Loading appointments…"
              : "No appointments for this date."}
          </Empty>
        )}
      </section>
      {message && (
        <section className="pm-table-card ops-pad">
          <Heading
            title="Message preview"
            description="Review the message before opening WhatsApp. Nothing is sent automatically."
          />
          <Field label="Message">
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <div className="ops-actions">
            <a
              className="pm-button pm-primary"
              target="_blank"
              rel="noopener noreferrer"
              href={
                "https://wa.me/" +
                phone +
                "?text=" +
                encodeURIComponent(message)
              }
            >
              Open WhatsApp
            </a>
            <button
              className="pm-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(message)
                  .catch(() =>
                    setError(
                      "Copy failed. Select and copy the message manually.",
                    ),
                  );
              }}
            >
              Copy message
            </button>
            <button className="pm-button" onClick={() => setMessage("")}>
              Close
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
