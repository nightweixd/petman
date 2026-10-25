import { useState, useEffect, useCallback } from "react";
import { database } from "@/lib/database";

// ─── Types ────────────────────────────────────────────────────────────────────
type DashStats = {
  totalRevenue: number;
  totalCustomers: number;
  totalPets: number;
  totalVisits: number;
  revenueThisMonth: number;
  visitsThisMonth: number;
  newCustomersThisMonth: number;
};

type TierCount = { name: string; icon: string; count: number; color: string };
type BirthdayCustomer = {
  name: string;
  customerId: string;
  dob: string;
  daysUntil: number;
};
type InactiveCustomer = {
  name: string;
  customerId: string;
  lastVisit: string | null;
  daysSince: number;
};
type TopCustomer = {
  name: string;
  customerId: string;
  spend: number;
  visits: number;
  tier: string | null;
  tierIcon: string;
};
type RecentVisit = {
  petName: string;
  customerName: string;
  date: string;
  type: string;
  groomer: string;
  price: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntilBirthday(dob: string): number {
  const today = new Date();
  const bday = new Date(dob);
  const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function thisMonth(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
      <div
        className="h-1"
        style={{
          background: accent ?? "linear-gradient(90deg,#14b8a6,#0d9488)",
        }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-stone-800">{value}</p>
            {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center text-xl flex-shrink-0">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHead({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <p className="text-[11px] font-black uppercase tracking-widest text-teal-500">
        {title}
      </p>
      {count !== undefined && (
        <span className="ml-auto text-[11px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage({
  onBack,
  onGoMembers,
}: {
  onBack: () => void;
  onGoMembers: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [tierCounts, setTierCounts] = useState<TierCount[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayCustomer[]>([]);
  const [inactive, setInactive] = useState<InactiveCustomer[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    const [
      { data: customers },
      { data: pets },
      { data: appointments },
      { data: members },
      { data: tiers },
    ] = await Promise.all([
      database
        .from("customers")
        .select("id, customer_id, customer_name, created_at"),
      database.from("pets").select("id, customer_id, pet_name"),
      database
        .from("appointments")
        .select("id, pet_id, price, date, type, groomer, created_at"),
      database
        .from("members")
        .select("customer_id, date_of_birth, tier_id, last_visit_date"),
      database
        .from("membership_tiers")
        .select("id, name, icon, min_spend, color")
        .order("min_spend"),
    ]);

    const tierList = tiers ?? [];
    const custList = customers ?? [];
    const petList = pets ?? [];
    const apptList = appointments ?? [];
    const memberList = members ?? [];

    // Pet → customer map
    const petToCustomer: Record<string, string> = {};
    petList.forEach((p: any) => {
      petToCustomer[p.id] = p.customer_id;
    });

    // Spend + visits per customer
    const spendMap: Record<
      string,
      { spend: number; visits: number; lastDate: string | null }
    > = {};
    apptList.forEach((a: any) => {
      const cid = petToCustomer[a.pet_id];
      if (!cid) return;
      if (!spendMap[cid])
        spendMap[cid] = { spend: 0, visits: 0, lastDate: null };
      spendMap[cid].spend += a.price ?? 0;
      spendMap[cid].visits += 1;
      if (
        a.date &&
        (!spendMap[cid].lastDate || a.date > spendMap[cid].lastDate!)
      ) {
        spendMap[cid].lastDate = a.date;
      }
    });

    // Member DOB map
    const memberDobMap: Record<string, string | null> = {};
    memberList.forEach((m: any) => {
      memberDobMap[m.customer_id] = m.date_of_birth;
    });

    // Tier assignment
    function getTierForSpend(spend: number) {
      const sorted = [...tierList].sort(
        (a: any, b: any) => b.min_spend - a.min_spend,
      );
      return (sorted as any[]).find((t) => spend >= t.min_spend) ?? null;
    }

    // ── Stats ──
    const now = new Date();
    const totalRevenue = apptList.reduce(
      (s: number, a: any) => s + (a.price ?? 0),
      0,
    );
    const revenueThisMonth = apptList
      .filter((a: any) => thisMonth(a.date))
      .reduce((s: number, a: any) => s + (a.price ?? 0), 0);
    const visitsThisMonth = apptList.filter((a: any) =>
      thisMonth(a.date),
    ).length;
    const newCustThisMonth = custList.filter((c: any) =>
      thisMonth(c.created_at),
    ).length;

    setStats({
      totalRevenue,
      totalCustomers: custList.length,
      totalPets: petList.length,
      totalVisits: apptList.length,
      revenueThisMonth,
      visitsThisMonth,
      newCustomersThisMonth: newCustThisMonth,
    });

    // ── Tier counts ──
    const counts: Record<string, number> = {};
    custList.forEach((c: any) => {
      const s = spendMap[c.id]?.spend ?? 0;
      const tier = getTierForSpend(s);
      const key = tier?.name ?? "None";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const tierCountList: TierCount[] = (tierList as any[]).map((t) => ({
      name: t.name,
      icon: t.icon,
      count: counts[t.name] ?? 0,
      color: t.color,
    }));
    if (counts["None"])
      tierCountList.unshift({
        name: "No tier",
        icon: "—",
        count: counts["None"],
        color: "#ccc",
      });
    setTierCounts(tierCountList);

    // ── Birthdays in next 30 days ──
    const bdayList: BirthdayCustomer[] = [];
    custList.forEach((c: any) => {
      const dob = memberDobMap[c.id];
      if (!dob) return;
      const days = daysUntilBirthday(dob);
      if (days <= 30) {
        bdayList.push({
          name: c.customer_name,
          customerId: c.customer_id ?? "",
          dob,
          daysUntil: days,
        });
      }
    });
    setBirthdays(bdayList.sort((a, b) => a.daysUntil - b.daysUntil));

    // ── Inactive customers (60+ days no visit) ──
    const inactiveList: InactiveCustomer[] = [];
    custList.forEach((c: any) => {
      const last = spendMap[c.id]?.lastDate ?? null;
      if (!last) return; // never visited = different problem
      const daysSince = Math.floor(
        (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince >= 60) {
        inactiveList.push({
          name: c.customer_name,
          customerId: c.customer_id ?? "",
          lastVisit: last,
          daysSince,
        });
      }
    });
    setInactive(
      inactiveList.sort((a, b) => b.daysSince - a.daysSince).slice(0, 8),
    );

    // ── Top customers by spend ──
    const topList: TopCustomer[] = custList
      .map((c: any) => {
        const s = spendMap[c.id] ?? { spend: 0, visits: 0 };
        const tier = getTierForSpend(s.spend);
        return {
          name: c.customer_name,
          customerId: c.customer_id ?? "",
          spend: s.spend,
          visits: s.visits,
          tier: tier?.name ?? null,
          tierIcon: tier?.icon ?? "—",
        };
      })
      .sort((a: TopCustomer, b: TopCustomer) => b.spend - a.spend)
      .slice(0, 5);
    setTopCustomers(topList);

    // ── Recent visits ──
    const petNameMap: Record<string, string> = {};
    const petCustNameMap: Record<string, string> = {};
    petList.forEach((p: any) => {
      petNameMap[p.id] = p.pet_name;
      const c = custList.find((c: any) => c.id === p.customer_id);
      petCustNameMap[p.id] = c?.customer_name ?? "Unknown";
    });
    const recent: RecentVisit[] = [...apptList]
      .sort((a: any, b: any) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 6)
      .map((a: any) => ({
        petName: petNameMap[a.pet_id] ?? "—",
        customerName: petCustNameMap[a.pet_id] ?? "—",
        date: a.date ?? "",
        type: a.type ?? "—",
        groomer: a.groomer ?? "—",
        price: a.price,
      }));
    setRecentVisits(recent);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📊</div>
          <p className="text-stone-400 font-semibold text-sm">
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const currentMonth = monthNames[new Date().getMonth()];

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-teal-600 transition-all text-sm font-bold"
            >
              ←
            </button>
            <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
              📊
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-800 tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs text-stone-400">Business overview</p>
            </div>
          </div>
          <button
            onClick={onGoMembers}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-500 text-white font-black text-sm hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 whitespace-nowrap"
          >
            🏅 Members
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        {/* Main stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon="💰"
            label="Total revenue"
            value={`RM ${stats?.totalRevenue.toFixed(0) ?? 0}`}
            sub={`RM ${stats?.revenueThisMonth.toFixed(0) ?? 0} this ${currentMonth}`}
          />
          <StatCard
            icon="👥"
            label="Customers"
            value={stats?.totalCustomers.toString() ?? "0"}
            sub={`+${stats?.newCustomersThisMonth ?? 0} this ${currentMonth}`}
            accent="linear-gradient(90deg,#8b5cf6,#7c3aed)"
          />
          <StatCard
            icon="🐾"
            label="Pets"
            value={stats?.totalPets.toString() ?? "0"}
            accent="linear-gradient(90deg,#f59e0b,#d97706)"
          />
          <StatCard
            icon="✂️"
            label="Total visits"
            value={stats?.totalVisits.toString() ?? "0"}
            sub={`${stats?.visitsThisMonth ?? 0} this ${currentMonth}`}
            accent="linear-gradient(90deg,#3b82f6,#2563eb)"
          />
        </div>

        {/* Tier breakdown + Top customers */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Tier breakdown */}
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
            <SectionHead icon="🏅" title="Members by tier" />
            <div className="space-y-2">
              {tierCounts.map((t) => {
                const pct = stats?.totalCustomers
                  ? Math.round((t.count / stats.totalCustomers) * 100)
                  : 0;
                return (
                  <div key={t.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-stone-700">
                        {t.icon} {t.name}
                      </span>
                      <span className="text-sm font-black text-stone-800">
                        {t.count}{" "}
                        <span className="text-xs text-stone-400 font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={onGoMembers}
              className="mt-4 w-full py-2 rounded-xl text-xs font-black text-teal-600 hover:bg-teal-50 border border-teal-100 transition-all"
            >
              View all members →
            </button>
          </div>

          {/* Top customers */}
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
            <SectionHead
              icon="⭐"
              title="Top customers by spend"
              count={topCustomers.length}
            />
            <div className="space-y-2">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-4">
                  No data yet
                </p>
              ) : (
                topCustomers.map((c, i) => (
                  <div
                    key={c.customerId}
                    className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0"
                  >
                    <span className="text-sm font-black text-stone-400 w-5">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-sm font-black text-teal-600 flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-stone-800 truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-stone-400">
                        {c.visits} visits · {c.tierIcon} {c.tier ?? "No tier"}
                      </p>
                    </div>
                    <p className="text-sm font-black text-teal-600 whitespace-nowrap">
                      RM {c.spend.toFixed(0)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Birthday alerts */}
        {birthdays.length > 0 && (
          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm p-5">
            <SectionHead
              icon="🎂"
              title={`Birthdays in next 30 days`}
              count={birthdays.length}
            />
            <div className="grid sm:grid-cols-2 gap-2">
              {birthdays.map((b) => (
                <div
                  key={b.customerId}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                    b.daysUntil <= 7
                      ? "bg-pink-50 border-pink-200"
                      : "bg-stone-50 border-stone-100"
                  }`}
                >
                  <span className="text-xl">🎂</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-stone-800 truncate">
                      {b.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {b.customerId} · {formatDate(b.dob)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {b.daysUntil === 0 ? (
                      <span className="text-xs font-black text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
                        Today! 🎉
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full ${b.daysUntil <= 7 ? "bg-pink-100 text-pink-600" : "bg-stone-100 text-stone-500"}`}
                      >
                        {b.daysUntil}d
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-3">
              💡 Add dates of birth in the Members tab to see birthday alerts.
            </p>
          </div>
        )}

        {/* Inactive customers */}
        {inactive.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-5">
            <SectionHead
              icon="⏰"
              title="Inactive customers (60+ days)"
              count={inactive.length}
            />
            <div className="grid sm:grid-cols-2 gap-2">
              {inactive.map((c) => (
                <div
                  key={c.customerId}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100"
                >
                  <span className="text-xl">⏰</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-stone-800 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      Last visit: {formatDate(c.lastVisit)}
                    </p>
                  </div>
                  <span className="text-xs font-black bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full flex-shrink-0">
                    {c.daysSince}d ago
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-3">
              💡 Consider sending a win-back promo to these customers.
            </p>
          </div>
        )}

        {/* Recent visits */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <SectionHead
              icon="✂️"
              title="Recent visits"
              count={recentVisits.length}
            />
          </div>
          {recentVisits.length === 0 ? (
            <div className="py-10 text-center text-stone-400 text-sm">
              No visits recorded yet
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="block sm:hidden divide-y divide-stone-50">
                {recentVisits.map((v, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-stone-800 text-sm">
                          {v.petName}{" "}
                          <span className="font-normal text-stone-400 text-xs">
                            · {v.customerName}
                          </span>
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {formatDate(v.date)} · {v.groomer}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {v.type && (
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold">
                            {v.type}
                          </span>
                        )}
                        {v.price != null && (
                          <span className="text-sm font-black text-teal-600">
                            RM {v.price}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100">
                      {[
                        "Pet",
                        "Customer",
                        "Date",
                        "Type",
                        "Groomer",
                        "Price",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-stone-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentVisits.map((v, i) => (
                      <tr
                        key={i}
                        className="border-b border-stone-50 hover:bg-stone-50 transition-colors last:border-0"
                      >
                        <td className="px-4 py-3 font-black text-stone-700">
                          {v.petName}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {v.customerName}
                        </td>
                        <td className="px-4 py-3 text-stone-500 font-mono text-xs">
                          {formatDate(v.date)}
                        </td>
                        <td className="px-4 py-3">
                          {v.type !== "—" ? (
                            <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold">
                              {v.type}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs">
                          {v.groomer}
                        </td>
                        <td className="px-4 py-3 font-black text-teal-600">
                          {v.price != null ? (
                            `RM ${v.price}`
                          ) : (
                            <span className="text-stone-300 font-normal">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
