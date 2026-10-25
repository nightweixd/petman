import { useState, useEffect, useCallback } from "react";
import { database } from "@/lib/database";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tier = {
  id: string;
  name: string;
  min_spend: number;
  discount_pct: number;
  color: string;
  icon: string;
  perks: string;
};

type Member = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_ref: string;
  email: string;
  date_of_birth: string | null;
  total_spend: number;
  visit_count: number;
  tier_id: string | null;
  tier: Tier | null;
  marketing_consent: boolean;
  last_visit_date: string | null;
  notes: string;
};

type RawCustomer = {
  id: string;
  customer_id: string | null;
  customer_name: string;
};

type RawAppointment = {
  price: number | null;
  date: string | null;
  pets: { customer_id: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const INPUT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTierForSpend(tiers: Tier[], spend: number): Tier | null {
  const sorted = [...tiers].sort((a, b) => b.min_spend - a.min_spend);
  return sorted.find((t) => spend >= t.min_spend) ?? null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getAge(dob: string | null) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function isBirthdayThisMonth(dob: string | null) {
  if (!dob) return false;
  const month = new Date(dob).getMonth();
  return month === new Date().getMonth();
}

function daysSinceVisit(last: string | null) {
  if (!last) return null;
  const diff = Date.now() - new Date(last).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier)
    return (
      <span className="text-xs text-stone-300 font-semibold">No tier</span>
    );
  const colors: Record<string, string> = {
    Bronze: "bg-amber-100 text-amber-700",
    Silver: "bg-stone-100 text-stone-600",
    Gold: "bg-yellow-100 text-yellow-700",
    Platinum: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full ${colors[tier.name] ?? "bg-stone-100 text-stone-600"}`}
    >
      {tier.icon} {tier.name}
    </span>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({
  member,
  onClick,
}: {
  member: Member;
  onClick: () => void;
}) {
  const days = daysSinceVisit(member.last_visit_date);
  const inactive = days !== null && days > 60;
  const birthday = isBirthdayThisMonth(member.date_of_birth);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all cursor-pointer overflow-hidden"
    >
      {/* Top accent */}
      <div
        className="h-1"
        style={{ background: "linear-gradient(90deg,#14b8a6,#0d9488)" }}
      />
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-lg font-black text-teal-600 flex-shrink-0">
              {member.customer_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-stone-800 text-sm leading-tight">
                {member.customer_name}
              </p>
              <p className="text-xs text-stone-400 font-mono">
                {member.customer_ref || "—"}
              </p>
            </div>
          </div>
          <TierBadge tier={member.tier} />
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-3">
          <div className="text-center">
            <p className="text-base font-black text-stone-800">
              RM {member.total_spend.toFixed(0)}
            </p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
              Spent
            </p>
          </div>
          <div className="text-center">
            <p className="text-base font-black text-stone-800">
              {member.visit_count}
            </p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
              Visits
            </p>
          </div>
          <div className="text-center">
            <p className="text-base font-black text-stone-800">
              {member.tier ? `${member.tier.discount_pct}%` : "0%"}
            </p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
              Discount
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {birthday && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
              🎂 Birthday this month
            </span>
          )}
          {inactive && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
              ⏰ Inactive {days}d
            </span>
          )}
          {member.marketing_consent && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-600">
              ✉ Marketing on
            </span>
          )}
          {!member.date_of_birth && (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">
              No DOB
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Member Detail / Edit Modal ───────────────────────────────────────────────
function MemberModal({
  member,
  tiers,
  onClose,
  onSave,
}: {
  member: Member;
  tiers: Tier[];
  onClose: () => void;
  onSave: (updated: Member) => void;
}) {
  const [email, setEmail] = useState(member.email ?? "");
  const [dob, setDob] = useState(member.date_of_birth ?? "");
  const [consent, setConsent] = useState(member.marketing_consent);
  const [notes, setNotes] = useState(member.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "tier">("profile");

  const nextTier =
    tiers
      .filter((t) => t.min_spend > member.total_spend)
      .sort((a, b) => a.min_spend - b.min_spend)[0] ?? null;

  const spendToNext = nextTier ? nextTier.min_spend - member.total_spend : 0;
  const tierProgress = nextTier
    ? Math.min(
        100,
        ((member.total_spend - (member.tier?.min_spend ?? 0)) /
          (nextTier.min_spend - (member.tier?.min_spend ?? 0))) *
          100,
      )
    : 100;

  const handleSave = async () => {
    setSaving(true);
    const newTier = getTierForSpend(tiers, member.total_spend);

    const upsertData = {
      customer_id: member.customer_id,
      email: email.trim() || null,
      date_of_birth: dob || null,
      marketing_consent: consent,
      notes: notes.trim() || null,
      tier_id: newTier?.id ?? null,
      total_spend: member.total_spend,
      visit_count: member.visit_count,
      last_visit_date: member.last_visit_date,
    };

    let result;
    if (member.id.startsWith("temp-")) {
      result = await database
        .from("members")
        .insert(upsertData)
        .select()
        .single();
    } else {
      result = await database
        .from("members")
        .update(upsertData)
        .eq("id", member.id)
        .select()
        .single();
    }

    if (!result.error && result.data) {
      onSave({
        ...member,
        id: result.data.id,
        email,
        date_of_birth: dob || null,
        marketing_consent: consent,
        notes,
        tier_id: newTier?.id ?? null,
        tier: newTier,
      });
    }
    setSaving(false);
  };

  const TAB_CLS = (t: string) =>
    `px-4 py-2 rounded-xl text-sm font-black transition-all ${
      tab === t
        ? "bg-teal-500 text-white shadow-sm shadow-teal-200"
        : "text-stone-500 hover:bg-stone-100"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ animation: "popIn .18s ease-out" }}
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-teal-200">
              {member.customer_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-800">
                {member.customer_name}
              </h2>
              <p className="text-xs text-stone-400">{member.customer_ref}</p>
            </div>
          </div>
          <TierBadge tier={member.tier} />
        </div>

        {/* Tabs */}
        <div className="px-7 pt-4 flex gap-2">
          <button
            className={TAB_CLS("profile")}
            onClick={() => setTab("profile")}
          >
            Profile
          </button>
          <button className={TAB_CLS("tier")} onClick={() => setTab("tier")}>
            Tier & Stats
          </button>
        </div>

        <div className="px-7 py-5 space-y-4">
          {tab === "profile" && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. customer@email.com"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  Date of Birth{" "}
                  <span className="text-pink-400">
                    — used for birthday promos
                  </span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={INPUT_CLS}
                />
                {dob && (
                  <p className="text-xs text-stone-400 mt-1">
                    Age: {getAge(dob)} years old
                    {isBirthdayThisMonth(dob) && (
                      <span className="ml-2 text-pink-500 font-bold">
                        🎂 Birthday this month!
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this member…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all resize-none"
                />
              </div>
              <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-2xl border border-teal-100">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-500"
                />
                <label
                  htmlFor="consent"
                  className="text-sm text-stone-600 leading-relaxed cursor-pointer"
                >
                  <strong className="text-stone-800">Marketing consent</strong>{" "}
                  — OK to send birthday promos, tier upgrades, and special
                  offers via WhatsApp or email.
                </label>
              </div>
            </>
          )}

          {tab === "tier" && (
            <div className="space-y-4">
              {/* Current stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Total Spend",
                    val: `RM ${member.total_spend.toFixed(0)}`,
                  },
                  { label: "Visits", val: member.visit_count.toString() },
                  {
                    label: "Last Visit",
                    val: member.last_visit_date
                      ? formatDate(member.last_visit_date)
                      : "Never",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-stone-50 rounded-2xl p-3 text-center"
                  >
                    <p className="text-base font-black text-stone-800">
                      {s.val}
                    </p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tier progress */}
              <div className="bg-white rounded-2xl border border-stone-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-teal-500">
                    Tier Progress
                  </p>
                  <TierBadge tier={member.tier} />
                </div>
                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all"
                    style={{ width: `${tierProgress}%` }}
                  />
                </div>
                {nextTier ? (
                  <p className="text-xs text-stone-500">
                    <strong className="text-stone-700">
                      RM {spendToNext.toFixed(0)} more
                    </strong>{" "}
                    to reach {nextTier.icon} <strong>{nextTier.name}</strong> (
                    {nextTier.discount_pct}% discount)
                  </p>
                ) : (
                  <p className="text-xs text-teal-600 font-bold">
                    💎 Maximum tier reached!
                  </p>
                )}
              </div>

              {/* All tiers */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-stone-400">
                  All Tiers
                </p>
                {tiers
                  .sort((a, b) => a.min_spend - b.min_spend)
                  .map((t) => {
                    const active = member.tier?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                          active
                            ? "border-teal-200 bg-teal-50"
                            : "border-stone-100 bg-stone-50 opacity-60"
                        }`}
                      >
                        <span className="text-xl">{t.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-black text-stone-800">
                            {t.name}
                            {active && (
                              <span className="ml-2 text-xs text-teal-600">
                                ← current
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-stone-500">{t.perks}</p>
                        </div>
                        <p className="text-xs font-bold text-stone-500">
                          RM {t.min_spend}+
                        </p>
                      </div>
                    );
                  })}
              </div>

              {/* Inactive warning */}
              {daysSinceVisit(member.last_visit_date) !== null &&
                daysSinceVisit(member.last_visit_date)! > 60 && (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700 font-semibold">
                    ⏰ This member hasn't visited in{" "}
                    <strong>
                      {daysSinceVisit(member.last_visit_date)} days
                    </strong>{" "}
                    — consider sending a win-back promo.
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Member ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Members Page ────────────────────────────────────────────────────────
export default function MembersPage({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<string>("all");
  const [selected, setSelected] = useState<Member | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load tiers
    const { data: tierData } = await database
      .from("membership_tiers")
      .select("*")
      .order("min_spend", { ascending: true });
    const tierList: Tier[] = tierData ?? [];
    setTiers(tierList);

    // Load customers
    const { data: customers } = await database
      .from("customers")
      .select("id, customer_id, customer_name")
      .order("customer_name", { ascending: true });

    // Load existing members
    const { data: memberData } = await database.from("members").select("*");

    // Load appointments to calculate spend + visits
    const { data: appointments } = await database
      .from("appointments")
      .select("price, date, pets(customer_id)");

    // Build member list from customers (merge with members table)
    const memberMap: Record<
      string,
      typeof memberData extends (infer T)[] ? T : never
    > = {};
    (memberData ?? []).forEach((m: any) => {
      memberMap[m.customer_id] = m;
    });

    // Calculate spend + visits per customer from appointments
    const spendMap: Record<
      string,
      { spend: number; visits: number; lastDate: string | null }
    > = {};
    ((appointments as RawAppointment[]) ?? []).forEach((a) => {
      const cid = (a.pets as any)?.customer_id;
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

    const built: Member[] = ((customers as RawCustomer[]) ?? []).map((c) => {
      const existing = memberMap[c.id] as any;
      const stats = spendMap[c.id] ?? { spend: 0, visits: 0, lastDate: null };
      const tier = getTierForSpend(tierList, stats.spend);
      return {
        id: existing?.id ?? `temp-${c.id}`,
        customer_id: c.id,
        customer_name: c.customer_name,
        customer_ref: c.customer_id ?? "",
        email: existing?.email ?? "",
        date_of_birth: existing?.date_of_birth ?? null,
        total_spend: stats.spend,
        visit_count: stats.visits,
        tier_id: tier?.id ?? null,
        tier,
        marketing_consent: existing?.marketing_consent ?? false,
        last_visit_date: stats.lastDate,
        notes: existing?.notes ?? "",
      };
    });

    setMembers(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = (updated: Member) => {
    setMembers((prev) =>
      prev.map((m) => (m.customer_id === updated.customer_id ? updated : m)),
    );
    setSelected(null);
  };

  // Filters
  const filtered = members.filter((m) => {
    const matchSearch =
      m.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      m.customer_ref.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchTier =
      filterTier === "all" ||
      m.tier?.name === filterTier ||
      (filterTier === "none" && !m.tier);
    const days = daysSinceVisit(m.last_visit_date);
    const matchFlag =
      filterFlag === "all" ||
      (filterFlag === "birthday" && isBirthdayThisMonth(m.date_of_birth)) ||
      (filterFlag === "inactive" && days !== null && days > 60) ||
      (filterFlag === "marketing" && m.marketing_consent) ||
      (filterFlag === "nodob" && !m.date_of_birth);
    return matchSearch && matchTier && matchFlag;
  });

  // Summary stats
  const totalRevenue = members.reduce((s, m) => s + m.total_spend, 0);
  const birthdayCount = members.filter((m) =>
    isBirthdayThisMonth(m.date_of_birth),
  ).length;
  const inactiveCount = members.filter((m) => {
    const d = daysSinceVisit(m.last_visit_date);
    return d !== null && d > 60;
  }).length;
  const marketingCount = members.filter((m) => m.marketing_consent).length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-teal-600 transition-all text-sm font-bold"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
                🏅
              </div>
              <div>
                <h1 className="text-xl font-black text-stone-800 tracking-tight">
                  Members
                </h1>
                <p className="text-xs text-stone-400">
                  <span className="font-bold text-teal-600">
                    {members.length}
                  </span>{" "}
                  members ·{" "}
                  <span className="font-bold text-teal-600">
                    RM {totalRevenue.toFixed(0)}
                  </span>{" "}
                  total revenue
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name, ID or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 text-sm bg-stone-50 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Revenue",
              val: `RM ${totalRevenue.toFixed(0)}`,
              icon: "💰",
              color: "teal",
            },
            {
              label: "Birthdays this month",
              val: birthdayCount.toString(),
              icon: "🎂",
              color: "pink",
            },
            {
              label: "Inactive (60d+)",
              val: inactiveCount.toString(),
              icon: "⏰",
              color: "amber",
            },
            {
              label: "Marketing opted in",
              val: marketingCount.toString(),
              icon: "✉",
              color: "blue",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-3xl border border-stone-100 shadow-sm p-4 text-center"
            >
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black text-stone-800">{s.val}</p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide leading-tight mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Tier filter */}
          <div className="flex flex-wrap gap-1.5">
            {["all", "Bronze", "Silver", "Gold", "Platinum", "none"].map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    filterTier === t
                      ? "bg-teal-500 text-white shadow-sm shadow-teal-200"
                      : "bg-white border border-stone-200 text-stone-500 hover:border-teal-300"
                  }`}
                >
                  {t === "all" ? "All tiers" : t === "none" ? "No tier" : t}
                </button>
              ),
            )}
          </div>

          {/* Flag filter */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { val: "all", label: "All" },
              { val: "birthday", label: "🎂 Birthday" },
              { val: "inactive", label: "⏰ Inactive" },
              { val: "marketing", label: "✉ Marketing on" },
              { val: "nodob", label: "No DOB" },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setFilterFlag(f.val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  filterFlag === f.val
                    ? "bg-stone-700 text-white"
                    : "bg-white border border-stone-200 text-stone-500 hover:border-stone-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Member list */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3 animate-pulse">🏅</div>
            <p className="text-stone-400 font-semibold text-sm">
              Loading members…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">🏅</p>
            <p className="text-stone-400 font-bold text-lg">No members found</p>
            <p className="text-stone-300 text-sm mt-1">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard
                key={m.customer_id}
                member={m}
                onClick={() => setSelected(m)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <MemberModal
          member={selected}
          tiers={tiers}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}

      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}
