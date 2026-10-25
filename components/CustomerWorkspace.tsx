import { useEffect, useMemo, useState } from "react";
import type { Customer, Pet } from "@/pages/index";
import { database } from "@/lib/database";
import Icon from "./Icon";
import { useModalFocus } from "./Drawer";
import type { ReactNode } from "react";
type Membership = {
  customer_id: string;
  tier_id: string | null;
  email: string;
};
type Tier = { id: string; name: string; min_spend: number };
const number = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const money = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export default function CustomerWorkspace({
  customers,
  onAdd,
  onAddPet,
  onOpen,
  onDelete,
}: {
  customers: Customer[];
  onAdd: () => void;
  onAddPet: (c: Customer) => void;
  onOpen: (c: Customer, p: Pet) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [filters, setFilters] = useState(false),
    [page, setPage] = useState(0),
    [ascending, setAscending] = useState(true),
    [selected, setSelected] = useState<string[]>([]),
    [members, setMembers] = useState<Membership[]>([]),
    [tiers, setTiers] = useState<Tier[]>([]),
    [confirm, setConfirm] = useState<Customer | null>(null),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    void Promise.all([
      database.from("members").select("customer_id,tier_id,email"),
      database.from("membership_tiers").select("id,name,min_spend"),
    ]).then(([m, t]) => {
      setMembers(m.data ?? []);
      setTiers(t.data ?? []);
    });
  }, []);
  const filtered = useMemo(
    () =>
      customers
        .filter(
          (c) =>
            (kind === "all" || c.pets.some((p) => p.petType === kind)) &&
            [
              c.customerName,
              c.customerId,
              ...c.pets.flatMap((p) => [p.petName, p.contact]),
            ].some((s) => s.toLowerCase().includes(search.toLowerCase())),
        )
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * a.customerName.localeCompare(b.customerName),
        ),
    [customers, search, kind, ascending],
  );
  useEffect(() => setPage(0), [search, kind]);
  const safePage = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / 8) - 1),
    ),
    visible = filtered.slice(safePage * 8, safePage * 8 + 8);
  const pets = customers.flatMap((c) => c.pets),
    visits = pets.flatMap((p) => p.appointments),
    now = new Date();
  const thisMonth = visits.filter(
    (v) =>
      v.date &&
      v.date.slice(0, 7) ===
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  function tierFor(c: Customer) {
    const member = members.find((m) => m.customer_id === c.id);
    if (!member) return null;
    const spend = c.pets
      .flatMap((p) => p.appointments)
      .reduce((n, v) => n + (v.price ?? 0), 0);
    return (
      [...tiers]
        .sort((a, b) => b.min_spend - a.min_spend)
        .find((t) => spend >= t.min_spend)?.name ?? "Member"
    );
  }
  function exportRows() {
    const rows = filtered.filter(
      (c) => !selected.length || selected.includes(c.id),
    );
    const cell = (v: string) =>
      `"${(/^[=+\-@]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const csv = [
      [
        "Customer",
        "Reference",
        "Phone",
        "Pets",
        "Membership",
        "Recorded spend",
      ],
      ...rows.map((c) => [
        c.customerName,
        c.customerId,
        c.pets[0]?.contact ?? "",
        c.pets.map((p) => p.petName).join(", "),
        tierFor(c) ?? "Not enrolled",
        String(
          c.pets
            .flatMap((p) => p.appointments)
            .reduce((n, v) => n + (v.price ?? 0), 0),
        ),
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n");
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
      );
    a.href = url;
    a.download = "petman-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="pm-workspace-grid">
      <div className="pm-workspace-left">
        <div className="pm-stats">
          {[
            {
              label: "Total customers",
              value: number.format(customers.length),
              sub: "Customer records",
              icon: "users",
              color: "blue",
            },
            {
              label: "Pets in our care",
              value: number.format(pets.length),
              sub: `${new Set(pets.map((p) => p.petType)).size} ${new Set(pets.map((p) => p.petType)).size === 1 ? "pet type" : "pet types"}`,
              icon: "paw",
              color: "orange",
            },
            {
              label: "This month’s visits",
              value: number.format(thisMonth.length),
              sub:
                money(thisMonth.reduce((n, v) => n + (v.price ?? 0), 0)) +
                " recorded",
              icon: "calendar",
              color: "green",
            },
          ].map((s) => (
            <section className="pm-stat" key={s.label}>
              <div className="pm-stat-label">
                <span className={`pm-stat-icon ${s.color}`}>
                  <Icon
                    name={s.icon as "users" | "paw" | "calendar"}
                    size={19}
                  />
                </span>
                {s.label}
              </div>
              <div className="pm-stat-bottom">
                <strong>{s.value}</strong>
                <span>{s.sub}</span>
              </div>
            </section>
          ))}
        </div>
        <section className="pm-table-card">
          <div className="pm-table-toolbar">
            <div>
              <h2>
                All customers <span>{customers.length}</span>
              </h2>
              <p>Customer profiles, pets and visit history.</p>
            </div>
            <button className="pm-button pm-primary" onClick={onAdd}>
              <Icon name="plus" size={17} />
              Add customer
            </button>
          </div>
          <div className="pm-table-controls">
            <label className="pm-search">
              <Icon name="search" size={17} />
              <input
                aria-label="Search customers"
                placeholder="Search customers, pets or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className={`pm-button ${kind !== "all" ? "is-selected" : ""}`}
              onClick={() => setFilters((f) => !f)}
              aria-expanded={filters}
            >
              <Icon name="filter" size={16} />
              Filter
            </button>
            <button
              className="pm-button"
              onClick={exportRows}
              disabled={!filtered.length}
            >
              <Icon name="export" size={16} />
              Export{selected.length ? ` (${selected.length})` : ""}
            </button>
          </div>
          {filters && (
            <div className="pm-filter-bar">
              <label>
                Pet type
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">All pets</option>
                  {[...new Set(pets.map((p) => p.petType))].sort().map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => {
                  setKind("all");
                  setFilters(false);
                }}
                className="pm-text-button"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="pm-table-scroll">
            <table className="pm-data-table">
              <thead>
                <tr>
                  <th className="pm-checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select customers on this page"
                      checked={
                        visible.length > 0 &&
                        visible.every((c) => selected.includes(c.id))
                      }
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...ids,
                                  ...visible.map((c) => c.id),
                                ]),
                              ]
                            : ids.filter(
                                (id) => !visible.some((c) => c.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  <th>
                    <button
                      className="pm-sort"
                      onClick={() => setAscending((a) => !a)}
                    >
                      Customer name{" "}
                      <span aria-hidden="true">{ascending ? "↕" : "↓"}</span>
                    </button>
                  </th>
                  <th>Pets</th>
                  <th>Membership</th>
                  <th className="pm-right">Total spend</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => {
                  const tier = tierFor(c),
                    spend = c.pets
                      .flatMap((p) => p.appointments)
                      .reduce((n, v) => n + (v.price ?? 0), 0);
                  return (
                    <tr
                      key={c.id}
                      className={selected.includes(c.id) ? "is-selected" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.customerName}`}
                          checked={selected.includes(c.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, c.id]
                                : ids.filter((id) => id !== c.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="pm-customer-name"
                          onClick={() =>
                            c.pets[0] ? onOpen(c, c.pets[0]) : onAddPet(c)
                          }
                        >
                          <span className={`pm-avatar tone-${i % 5}`}>
                            {initials(c.customerName)}
                          </span>
                          <span>
                            <strong>{c.customerName}</strong>
                            <small>
                              {c.pets[0]?.contact ||
                                c.customerId ||
                                "No contact recorded"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className="pm-pet-cell">
                          <span>
                            {c.pets.map((p) => p.petName).join(", ") ||
                              "No pets yet"}
                          </span>
                          <small>
                            {c.pets.length
                              ? c.pets
                                  .map((p) => p.petType)
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .join(", ")
                              : "Add a pet to get started"}
                          </small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`pm-status ${tier ? "member" : "neutral"}`}
                        >
                          <i />
                          {tier ?? "Not enrolled"}
                        </span>
                      </td>
                      <td className="pm-right pm-amount">{money(spend)}</td>
                      <td>
                        <div className="pm-row-actions">
                          <button
                            className="pm-icon-button"
                            title={`Add pet for ${c.customerName}`}
                            aria-label={`Add pet for ${c.customerName}`}
                            onClick={() => onAddPet(c)}
                          >
                            <Icon name="plus" size={16} />
                          </button>
                          <button
                            className="pm-icon-button pm-delete"
                            title={`Delete ${c.customerName}`}
                            aria-label={`Delete ${c.customerName}`}
                            onClick={() => setConfirm(c)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                          <button
                            className="pm-icon-button"
                            aria-label={`Open ${c.customerName}`}
                            onClick={() =>
                              c.pets[0] ? onOpen(c, c.pets[0]) : onAddPet(c)
                            }
                          >
                            <Icon name="chevron" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="pm-empty">
              <Icon name="users" size={30} />
              <h3>
                {search || kind !== "all"
                  ? "No matching customers"
                  : "Your customer directory starts here"}
              </h3>
              <p>
                {search || kind !== "all"
                  ? "Try another name or clear your filters."
                  : "Add your first customer and their pet to keep their records together."}
              </p>
              {!search && kind === "all" && (
                <button className="pm-button pm-primary" onClick={onAdd}>
                  Add customer
                </button>
              )}
            </div>
          )}
          <div className="pm-table-footer">
            <span>
              {filtered.length
                ? `${safePage * 8 + 1}–${Math.min((safePage + 1) * 8, filtered.length)}`
                : "0"}{" "}
              of {filtered.length} customers
            </span>
            <div>
              <button
                className="pm-icon-button"
                disabled={safePage === 0}
                aria-label="Previous page"
                onClick={() => setPage(safePage - 1)}
              >
                <Icon
                  name="chevron"
                  size={16}
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>
              <span className="pm-page-number">{safePage + 1}</span>
              <button
                className="pm-icon-button"
                disabled={(safePage + 1) * 8 >= filtered.length}
                aria-label="Next page"
                onClick={() => setPage(safePage + 1)}
              >
                <Icon name="chevron" size={16} />
              </button>
            </div>
          </div>
        </section>
        <div className="pm-directory-note">
          <Icon name="lock" size={14} />
          <span>Customer information is visible to authorized staff only.</span>
        </div>
      </div>
      <aside className="pm-insights">
        <Activity customers={customers} />
        <PetMix pets={pets} />
        <section className="pm-quick-note">
          <span className="pm-note-icon">
            <Icon name="calendar" />
          </span>
          <div>
            <h3>Booking requests</h3>
            <p>Review incoming requests and confirm appointments.</p>
            <a href="/bookings">
              Manage bookings <Icon name="chevron" size={14} />
            </a>
          </div>
        </section>
      </aside>
      {confirm && (
        <ConfirmOverlay onClose={() => setConfirm(null)}>
          <section>
            <h2>Delete {confirm.customerName}?</h2>
            <p>
              The customer and their pet records will move to Deleted records.
              You can restore them there.
            </p>
            <div>
              <button
                className="pm-button"
                disabled={deleting}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="pm-button pm-danger"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(confirm.id);
                    setConfirm(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete customer"}
              </button>
            </div>
          </section>
        </ConfirmOverlay>
      )}
    </div>
  );
}
function Activity({ customers }: { customers: Customer[] }) {
  const [metric, setMetric] = useState("Visit value"),
    [months, setMonths] = useState(6);
  const visits = customers.flatMap((c) =>
    c.pets.flatMap((p) => p.appointments),
  );
  const points = Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - months + 1 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      list = visits.filter((v) => v.date.startsWith(key));
    return {
      label: d.toLocaleDateString("en-MY", { month: "short" }),
      value:
        metric === "Visit value"
          ? list.reduce((n, v) => n + (v.price ?? 0), 0)
          : list.length,
    };
  });
  const max = Math.max(...points.map((p) => p.value), 1),
    total = points.reduce((n, p) => n + p.value, 0),
    xy = points
      .map(
        (p, i) =>
          `${12 + i * (256 / (months - 1))},${100 - (p.value / max) * 76}`,
      )
      .join(" ");
  return (
    <section className="pm-insight-card">
      <div className="pm-card-heading">
        <h2>Visit activity</h2>
        <select
          aria-label="Activity period"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          <option value={6}>6 months</option>
          <option value={12}>12 months</option>
        </select>
      </div>
      <div className="pm-segmented">
        {["Visit value", "Visits"].map((m) => (
          <button
            key={m}
            className={metric === m ? "is-active" : ""}
            aria-pressed={metric === m}
            onClick={() => setMetric(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <strong className="pm-insight-value">
        {metric === "Visit value" ? money(total) : number.format(total)}
      </strong>
      <p>
        {metric === "Visit value"
          ? "Recorded appointment amounts"
          : "Recorded appointments"}{" "}
        in the last {months} months.
      </p>
      <div className="pm-activity-chart">
        <svg
          viewBox="0 0 280 115"
          role="img"
          aria-label={`${metric} by month: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}
        >
          <defs>
            <linearGradient id="pm-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#11a5e8" stopOpacity=".18" />
              <stop offset="100%" stopColor="#11a5e8" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {[24, 62, 100].map((y) => (
            <line
              key={y}
              x1="12"
              x2="268"
              y1={y}
              y2={y}
              stroke="#edf1f4"
              strokeDasharray="3 4"
            />
          ))}
          <polygon points={`12,100 ${xy} 268,100`} fill="url(#pm-chart-fill)" />
          <polyline
            points={xy}
            fill="none"
            stroke="#079fe1"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={12 + i * (256 / (months - 1))}
              cy={100 - (p.value / max) * 76}
              r="3"
              fill="white"
              stroke="#079fe1"
              strokeWidth="2"
            />
          ))}
        </svg>
        <div className="pm-chart-labels">
          {points
            .filter(
              (_, i) =>
                i === 0 ||
                i === points.length - 1 ||
                i === Math.floor(points.length / 2),
            )
            .map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
        </div>
      </div>
    </section>
  );
}
function PetMix({ pets }: { pets: Pet[] }) {
  const colors = ["#27a9e9", "#f8b448", "#90c96f", "#9988d9", "#df8eaa"];
  const kinds = Object.entries(
    pets.reduce<Record<string, number>>(
      (a, p) => ({ ...a, [p.petType]: (a[p.petType] ?? 0) + 1 }),
      {},
    ),
  );
  let offset = 0;
  return (
    <section className="pm-insight-card">
      <div className="pm-card-heading">
        <h2>Pet overview</h2>
        <span className="pm-muted">{pets.length} total</span>
      </div>
      <div className="pm-donut">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={
            kinds.length
              ? kinds.map(([k, n]) => `${n} ${k}`).join(", ")
              : "No pets recorded"
          }
        >
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="#f0f4f7"
            strokeWidth="28"
          />
          {kinds.map(([kind, n], i) => {
            const length = (n / Math.max(pets.length, 1)) * 452.39;
            const start = offset;
            offset += length;
            return (
              <circle
                key={kind}
                cx="100"
                cy="100"
                r="72"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="28"
                strokeDasharray={`${Math.max(length - 4, 0)} ${452.39 - Math.max(length - 4, 0)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 100 100)"
              />
            );
          })}
        </svg>
        <div>
          <strong>{pets.length}</strong>
          <span>Pets in our care</span>
        </div>
      </div>
      <div className="pm-chart-legend">
        {kinds.length ? (
          kinds.map(([k, n], i) => (
            <span key={k}>
              <i style={{ background: colors[i % colors.length] }} />
              {k}
              <strong>{n}</strong>
            </span>
          ))
        ) : (
          <p>Add a pet to see the breakdown.</p>
        )}
      </div>
    </section>
  );
}

function ConfirmOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useModalFocus(onClose);
  return (
    <div
      className="pm-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete customer"
      ref={ref}
    >
      {children}
    </div>
  );
}
