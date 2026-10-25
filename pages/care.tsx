import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Drawer from "@/components/Drawer";
import { Empty, ErrorMessage, Field, Heading } from "@/components/Operations";
import {
  api,
  money,
  today,
  invoiceNumber,
  type Customer,
  type Invoice,
} from "@/lib/workspace";
type Task = {
  id: string;
  customer_id: string;
  customer_name: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  assigned_to: string | null;
  assignee: string;
};
type Staff = { id: string; full_name: string };
type Note = { id: string; body: string; actor: string; created_at: string };
type Pet = {
  id: string;
  pet_name: string;
  pet_type: string;
  medical_history: string;
  preferred_groomer: string;
  birthday: string;
};
type Visit = {
  id: string;
  date: string;
  type: string;
  price: number;
  notes: string;
};
type Detail = {
  customer: Customer;
  pets: Pet[];
  appointments: Visit[];
  notes: Note[];
  tasks: Task[];
  invoices: Invoice[];
  member: {
    email: string;
    date_of_birth: string | null;
    marketing_consent: number;
  }[];
  bookings: { id: string; date: string; slot: string; status: string }[];
};
type View = { id: string; name: string; query: string };
export default function Care() {
  const [rows, setRows] = useState<Customer[]>([]),
    [total, setTotal] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [offset, setOffset] = useState(0),
    [detail, setDetail] = useState<Detail | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [staff, setStaff] = useState<Staff[]>([]),
    [views, setViews] = useState<View[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("customers"),
    [busy, setBusy] = useState(false),
    [viewName, setViewName] = useState("");
  const loadExtras = useCallback(async () => {
    try {
      const [t, s, v] = await Promise.all([
        api<Task[]>("/tasks"),
        api<Staff[]>("/staff"),
        api<View[]>("/views"),
      ]);
      setTasks(t);
      setStaff(s);
      setViews(v);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void api<{ rows: Customer[]; total: number }>(
        "/customers?search=" +
          encodeURIComponent(search) +
          "&filter=" +
          filter +
          "&offset=" +
          offset,
        undefined,
        controller.signal,
      )
        .then((d) => {
          setRows(d.rows);
          setTotal(d.total);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, filter, offset]);
  const open = async (id: string) => {
    try {
      setDetail(await api<Detail>("/customers/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const toggle = async (t: Task) => {
    try {
      await api("/tasks/" + t.id, { completed: !t.completed_at });
      await loadExtras();
      if (detail) await open(detail.customer.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="ops-workspace">
      <section className="pm-table-card">
        <Heading
          title="Customer care"
          description="Customer profiles, follow-ups and saved customer lists."
        />
        <div className="pm-page-tabs">
          {["customers", "tasks"].map((t) => (
            <button
              key={t}
              className={tab === t ? "is-active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "customers" ? "Customers" : "Follow-up tasks"}
            </button>
          ))}
        </div>
        <ErrorMessage error={error} />
        {tab === "customers" ? (
          <>
            <div className="ops-filter">
              <Field label="Search customers">
                <input
                  value={search}
                  placeholder="Name, phone, pet or tag"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                />
              </Field>
              <Field label="Customer group">
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">All active customers</option>
                  <option value="inactive">No visit for 60 days</option>
                  <option value="birthday">Birthday this month</option>
                  <option value="outstanding">Outstanding invoice</option>
                </select>
              </Field>
              <Field label="Saved lists">
                <select
                  value=""
                  onChange={(e) => {
                    const v = views.find((v) => v.id === e.target.value);
                    if (v) {
                      const q = JSON.parse(v.query);
                      setSearch(q.search);
                      setFilter(q.filter);
                      setOffset(0);
                    }
                  }}
                >
                  <option value="">Choose saved list</option>
                  {views.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <form
              className="ops-filter"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("/views", { name: viewName, search, filter });
                  setViewName("");
                  await loadExtras();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Save current filters as">
                <input
                  required
                  maxLength={60}
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g. Customers to contact"
                />
              </Field>
              <button disabled={busy} className="pm-button">
                Save list
              </button>
            </form>
            <div className="pm-table-scroll">
              <table className="pm-data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Reference</th>
                    <th>Phone</th>
                    <th>Pets</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button
                          className="pm-text-button"
                          onClick={() => void open(c.id)}
                        >
                          {c.customer_name}
                        </button>
                      </td>
                      <td>{c.customer_id}</td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.pet_count}</td>
                      <td>{c.tags || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty>
                {loading ? "Loading customers…" : "No matching customers."}
              </Empty>
            )}
            <div className="pm-table-footer">
              <button
                className="pm-button"
                disabled={!offset || loading}
                onClick={() => setOffset((n) => Math.max(0, n - 25))}
              >
                Previous
              </button>
              <span>
                {total} customers · Page {offset / 25 + 1}
              </span>
              <button
                className="pm-button"
                disabled={offset + 25 >= total || loading}
                onClick={() => setOffset((n) => n + 25)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="ops-pad">
            <TaskForm staff={staff} onSaved={loadExtras} />
            <TaskList tasks={tasks} onToggle={toggle} />
          </div>
        )}
      </section>
      {detail && (
        <Drawer
          title={detail.customer.customer_name}
          eyebrow={detail.customer.customer_id}
          onClose={() => setDetail(null)}
        >
          <ProfileEditor
            key={detail.customer.id}
            detail={detail}
            onSaved={() => open(detail.customer.id)}
          />
          <section className="ops-section">
            <h3>Pets & care alerts</h3>
            {detail.pets.map((p) => (
              <article key={p.id} className="ops-line">
                <strong>{p.pet_name}</strong>
                <p>
                  {p.pet_type} · Preferred groomer:{" "}
                  {p.preferred_groomer || "Not set"}
                </p>
                {p.medical_history && (
                  <p className="ops-alert">
                    <strong>Care alert: </strong>
                    {p.medical_history}
                  </p>
                )}
                {p.birthday && <small>Birthday: {p.birthday}</small>}
              </article>
            ))}
          </section>
          <section className="ops-section">
            <h3>Upcoming & recent bookings</h3>
            {detail.bookings.map((b) => (
              <p key={b.id}>
                {b.date} {b.slot} · {b.status}
              </p>
            ))}
            {!detail.bookings.length && <p>No linked bookings.</p>}
          </section>
          <section className="ops-section">
            <h3>Membership</h3>
            {detail.member[0] ? (
              <>
                <p>
                  {detail.member[0].email || "No membership email recorded"}
                </p>
                <p>
                  Birthday: {detail.member[0].date_of_birth || "Not recorded"}
                </p>
                <p>
                  Marketing consent:{" "}
                  {detail.member[0].marketing_consent
                    ? "Granted"
                    : "Not granted"}
                </p>
              </>
            ) : (
              <p>No saved membership profile.</p>
            )}
            <Link className="pm-text-button" href="/?section=members">
              Membership tiers & benefits
            </Link>
          </section>
          <section className="ops-section">
            <h3>Invoices</h3>
            {detail.invoices?.map((i) => (
              <p key={i.id}>
                <Link href={"/invoices?id=" + i.id}>
                  {invoiceNumber(i.number)}
                </Link>{" "}
                · {money(i.total_cents)} ·{" "}
                {i.status === "void"
                  ? "Void"
                  : money(i.total_cents - i.collected_cents) + " outstanding"}
              </p>
            ))}
            <Link className="pm-button" href="/invoices">
              Manage invoices
            </Link>
          </section>
          <section className="ops-section">
            <h3>Visit history</h3>
            {detail.appointments.map((a) => (
              <article className="ops-line" key={a.id}>
                <strong>
                  {a.date} · {a.type}
                </strong>
                <p>{money(Math.round((a.price ?? 0) * 100))}</p>
                <p>{a.notes}</p>
              </article>
            ))}
          </section>
          <section className="ops-section">
            <h3>Notes & activity</h3>
            <NoteForm
              customerId={detail.customer.id}
              onSaved={() => open(detail.customer.id)}
            />
            {detail.notes.map((n) => (
              <article className="ops-line" key={n.id}>
                <p className="ops-pre">{n.body}</p>
                <small>
                  {n.actor} · {n.created_at}
                </small>
              </article>
            ))}
          </section>
          <section className="ops-section">
            <h3>Follow-ups</h3>
            <TaskForm
              customerId={detail.customer.id}
              staff={staff}
              onSaved={async () => {
                await loadExtras();
                await open(detail.customer.id);
              }}
            />
            <TaskList tasks={detail.tasks} onToggle={toggle} />
          </section>
        </Drawer>
      )}
    </div>
  );
}
function TaskList({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (task: Task) => Promise<void>;
}) {
  return (
    <div>
      {tasks.map((t) => (
        <article className="ops-task" key={t.id}>
          <div>
            <strong>{t.title}</strong>
            <p>
              {t.customer_name ?? "Salon task"} · {t.assignee ?? "Unassigned"}
            </p>
            <small
              className={
                !t.completed_at && t.due_date < today() ? "ops-overdue" : ""
              }
            >
              Due {t.due_date} {t.completed_at ? "· Completed" : ""}
            </small>
          </div>
          <button className="pm-button" onClick={() => void onToggle(t)}>
            {t.completed_at ? "Reopen" : "Complete"}
          </button>
        </article>
      ))}
      {!tasks.length && <Empty>No follow-up tasks.</Empty>}
    </div>
  );
}
function TaskForm({
  customerId,
  staff,
  onSaved,
}: {
  customerId?: string;
  staff: Staff[];
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        setBusy(true);
        setError("");
        try {
          await api("/tasks", {
            customerId: customerId ?? null,
            title: f.get("title"),
            dueDate: f.get("dueDate"),
            assignedTo: f.get("assignedTo") || null,
          });
          form.reset();
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorMessage error={error} />
      <Field label="Follow-up task">
        <input
          required
          name="title"
          maxLength={300}
          placeholder="e.g. Confirm next grooming visit"
        />
      </Field>
      <div className="ops-grid">
        <Field label="Due date">
          <input required type="date" name="dueDate" defaultValue={today()} />
        </Field>
        <Field label="Assign to">
          <select name="assignedTo">
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button className="pm-button" disabled={busy}>
        {busy ? "Saving…" : "Add task"}
      </button>
    </form>
  );
}
function NoteForm({
  customerId,
  onSaved,
}: {
  customerId: string;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          await api("/notes", {
            customerId,
            body: new FormData(form).get("body"),
          });
          form.reset();
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorMessage error={error} />
      <Field label="Add internal note">
        <textarea required name="body" maxLength={4000} />
      </Field>
      <button className="pm-button" disabled={busy}>
        Save note
      </button>
    </form>
  );
}
function ProfileEditor({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            "/customers/" + detail.customer.id + "/profile",
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorMessage error={error} />
      <Field label="Owner phone">
        <input
          name="phone"
          defaultValue={detail.customer.phone}
          maxLength={40}
        />
      </Field>
      <Field label="Billing address">
        <textarea
          name="address"
          defaultValue={detail.customer.address}
          maxLength={500}
        />
      </Field>
      <Field label="Tags">
        <input
          name="tags"
          defaultValue={detail.customer.tags}
          maxLength={300}
          placeholder="e.g. Regular, anxious pet, prefers mornings"
        />
      </Field>
      <button className="pm-button" disabled={busy}>
        Save profile
      </button>
    </form>
  );
}
