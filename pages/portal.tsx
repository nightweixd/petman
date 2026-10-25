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

type Pet = {
  id: string;
  pet_name: string;
  pet_type: string;
  breed: string;
  age: number | null;
  medical_history: string;
  contact: string;
  preferred_groomer: string;
};

type Appointment = {
  id: string;
  pet_id: string;
  pet_name: string;
  day: string;
  date: string;
  type: string;
  groomer: string;
  price: number | null;
  notes: string;
};

type MemberInfo = {
  total_spend: number;
  visit_count: number;
  last_visit_date: string | null;
  tier: Tier | null;
  next_tier: Tier | null;
  date_of_birth: string | null;
  email: string;
  marketing_consent: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPetIcon(type: string) {
  const icons: Record<string, string> = {
    Dog: "🐕",
    Cat: "🐈",
    Bird: "🐦",
    Fish: "🐠",
    Rabbit: "🐇",
    Hamster: "🐹",
    Other: "🐾",
  };
  return icons[type] || "🐾";
}

function isBirthdayThisMonth(dob: string | null) {
  if (!dob) return false;
  return new Date(dob).getMonth() === new Date().getMonth();
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: Tier | null }) {
  if (!tier) return null;
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

// ─── Portal Header ────────────────────────────────────────────────────────────
function PortalHeader({
  name,
  onSignOut,
}: {
  name: string;
  onSignOut: () => void;
}) {
  return (
    <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
            🐾
          </div>
          <div>
            <h1 className="text-lg font-black text-stone-800 tracking-tight">
              PetMan
            </h1>
            <p className="text-xs text-stone-400">
              Hi, <span className="font-bold text-teal-600">{name}</span> 👋
            </p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition-all"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Membership Card ──────────────────────────────────────────────────────────
function MemberCard({ info }: { info: MemberInfo }) {
  const tierProgress =
    info.tier && info.next_tier
      ? Math.min(
          100,
          ((info.total_spend - info.tier.min_spend) /
            (info.next_tier.min_spend - info.tier.min_spend)) *
            100,
        )
      : info.tier
        ? 100
        : 0;

  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
      <div
        className="h-1.5"
        style={{ background: "linear-gradient(90deg,#14b8a6,#0d9488)" }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1">
              Membership
            </p>
            <TierBadge tier={info.tier} />
            {!info.tier && (
              <span className="text-xs text-stone-400">No tier yet</span>
            )}
          </div>
          {isBirthdayThisMonth(info.date_of_birth) && (
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-pink-100 text-pink-600">
              🎂 Birthday month!
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total Spent", val: `RM ${info.total_spend.toFixed(0)}` },
            { label: "Visits", val: info.visit_count.toString() },
            {
              label: "Discount",
              val: info.tier ? `${info.tier.discount_pct}%` : "0%",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-stone-50 rounded-2xl p-3 text-center"
            >
              <p className="text-base font-black text-stone-800">{s.val}</p>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Tier progress */}
        {info.tier && (
          <div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all"
                style={{ width: `${tierProgress}%` }}
              />
            </div>
            {info.next_tier ? (
              <p className="text-xs text-stone-500">
                <strong className="text-stone-700">
                  RM {(info.next_tier.min_spend - info.total_spend).toFixed(0)}{" "}
                  more
                </strong>{" "}
                to unlock {info.next_tier.icon}{" "}
                <strong>{info.next_tier.name}</strong> — {info.next_tier.perks}
              </p>
            ) : (
              <p className="text-xs text-teal-600 font-bold">
                💎 You've reached the highest tier!
              </p>
            )}
          </div>
        )}

        {/* Perks */}
        {info.tier && info.tier.discount_pct > 0 && (
          <div className="mt-3 px-3 py-2.5 bg-teal-50 rounded-2xl border border-teal-100 text-xs text-teal-700">
            <strong>Your {info.tier.name} perk:</strong> {info.tier.perks}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pet Card ─────────────────────────────────────────────────────────────────
function PetCard({
  pet,
  appointments,
  selected,
  onClick,
}: {
  pet: Pet;
  appointments: Appointment[];
  selected: boolean;
  onClick: () => void;
}) {
  const myAppts = appointments.filter((a) => a.pet_id === pet.id);
  const lastAppt = myAppts.sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  )[0];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-3xl border shadow-sm cursor-pointer transition-all overflow-hidden ${
        selected
          ? "border-teal-400 shadow-teal-100"
          : "border-stone-100 hover:border-teal-200 hover:shadow-md"
      }`}
    >
      <div
        className={`h-1 transition-all ${selected ? "bg-teal-500" : "bg-stone-100"}`}
      />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${selected ? "bg-teal-50" : "bg-stone-50"}`}
          >
            {getPetIcon(pet.pet_type)}
          </div>
          <div>
            <p className="font-black text-stone-800">{pet.pet_name}</p>
            <p className="text-xs text-stone-400">
              {pet.breed || pet.pet_type || "—"}
            </p>
          </div>
        </div>
        <div className="flex justify-between text-xs text-stone-400">
          <span>
            {myAppts.length} visit{myAppts.length !== 1 ? "s" : ""}
          </span>
          {lastAppt && <span>Last: {formatDate(lastAppt.date)}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Visit History ────────────────────────────────────────────────────────────
function VisitHistory({ appointments }: { appointments: Appointment[] }) {
  const sorted = [...appointments].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
        <p className="text-3xl mb-2">✂️</p>
        <p className="text-stone-400 font-semibold text-sm">
          No visits recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <p className="text-[11px] font-black uppercase tracking-widest text-teal-500">
          Visit History · {sorted.length} visit{sorted.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="divide-y divide-stone-50">
        {sorted.map((a) => (
          <div
            key={a.id}
            className="px-5 py-4 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-sm flex-shrink-0">
                {getPetIcon("")}
              </div>
              <div>
                <p className="text-sm font-black text-stone-800">
                  {a.pet_name}
                </p>
                <p className="text-xs text-stone-400">
                  {formatDate(a.date)} · {a.groomer || "—"}
                </p>
                {a.type && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-[11px] font-bold">
                    {a.type}
                  </span>
                )}
                {a.notes && (
                  <p className="text-xs text-stone-400 mt-1 italic">
                    "{a.notes}"
                  </p>
                )}
              </div>
            </div>
            {a.price != null && (
              <p className="text-sm font-black text-teal-600 whitespace-nowrap flex-shrink-0">
                RM {a.price}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────
export default function CustomerPortal({
  userId,
  onSignOut,
}: {
  userId: string;
  onSignOut: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [customerName, setName] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppts] = useState<Appointment[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [selPet, setSelPet] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "visits">("overview");

  const load = useCallback(async () => {
    setLoading(true);

    // Get user_profile to find customer_id
    const { data: profile } = await database
      .from("user_profiles")
      .select("customer_id, full_name")
      .eq("id", userId)
      .single();

    if (!profile?.customer_id) {
      setLoading(false);
      return;
    }

    setName(profile.full_name || "");

    // Load customer, pets, member, tiers in parallel
    const [
      { data: customer },
      { data: petData },
      { data: memberData },
      { data: tierData },
    ] = await Promise.all([
      database
        .from("customers")
        .select("customer_name")
        .eq("id", profile.customer_id)
        .single(),
      database.from("pets").select("*").eq("customer_id", profile.customer_id),
      database
        .from("members")
        .select("*")
        .eq("customer_id", profile.customer_id)
        .single(),
      database.from("membership_tiers").select("*").order("min_spend"),
    ]);

    if (customer) setName(profile.full_name || customer.customer_name);

    const petList: Pet[] = petData ?? [];
    setPets(petList);

    // Load appointments for all pets
    let apptList: Appointment[] = [];
    if (petList.length > 0) {
      const petIds = petList.map((p) => p.id);
      const { data: apptData } = await database
        .from("appointments")
        .select("*")
        .in("pet_id", petIds)
        .order("date", { ascending: false });

      apptList = (apptData ?? []).map((a: any) => ({
        ...a,
        pet_name: petList.find((p) => p.id === a.pet_id)?.pet_name ?? "—",
      }));
      setAppts(apptList);
    }

    // Build member info
    const tiers: Tier[] = tierData ?? [];
    const totalSpend = apptList.reduce((s, a) => s + (a.price ?? 0), 0);
    const visitCount = apptList.length;
    const lastVisit = apptList[0]?.date ?? null;

    const sorted = [...tiers].sort((a, b) => b.min_spend - a.min_spend);
    const currentTier = sorted.find((t) => totalSpend >= t.min_spend) ?? null;
    const nextTier =
      [...tiers]
        .sort((a, b) => a.min_spend - b.min_spend)
        .find((t) => t.min_spend > totalSpend) ?? null;

    setMemberInfo({
      total_spend: totalSpend,
      visit_count: visitCount,
      last_visit_date: lastVisit,
      tier: currentTier,
      next_tier: nextTier,
      date_of_birth: memberData?.date_of_birth ?? null,
      email: memberData?.email ?? "",
      marketing_consent: memberData?.marketing_consent ?? false,
    });

    if (petList.length > 0) setSelPet(petList[0].id);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPetAppts = selPet
    ? appointments.filter((a) => a.pet_id === selPet)
    : appointments;

  const TAB = (t: typeof tab) =>
    `px-4 py-2 rounded-xl text-sm font-black transition-all ${
      tab === t
        ? "bg-teal-500 text-white shadow-sm shadow-teal-200"
        : "text-stone-500 hover:bg-stone-100"
    }`;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🐾</div>
          <p className="text-stone-400 font-semibold text-sm">
            Loading your profile…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
    >
      <PortalHeader name={customerName} onSignOut={onSignOut} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            className={TAB("overview")}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button className={TAB("visits")} onClick={() => setTab("visits")}>
            All visits {appointments.length > 0 && `(${appointments.length})`}
          </button>
        </div>

        {tab === "overview" && (
          <>
            {/* Member card */}
            {memberInfo && <MemberCard info={memberInfo} />}

            {/* My pets */}
            {pets.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3 px-1">
                  My Pets
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {pets.map((p) => (
                    <PetCard
                      key={p.id}
                      pet={p}
                      appointments={appointments}
                      selected={selPet === p.id}
                      onClick={() => setSelPet(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Selected pet visits */}
            {selPet && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-3 px-1">
                  {pets.find((p) => p.id === selPet)?.pet_name}'s Visits
                </p>
                <VisitHistory appointments={selectedPetAppts} />
              </div>
            )}

            {pets.length === 0 && (
              <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-8 text-center">
                <p className="text-3xl mb-2">🐾</p>
                <p className="text-stone-400 font-semibold">
                  No pets on record yet
                </p>
                <p className="text-xs text-stone-300 mt-1">
                  Visit us and we'll add your pet to the system
                </p>
              </div>
            )}
          </>
        )}

        {tab === "visits" && <VisitHistory appointments={appointments} />}

        {/* Last visit */}
        {memberInfo?.last_visit_date && (
          <p className="text-center text-xs text-stone-400 pb-4">
            Last visit: {formatDate(memberInfo.last_visit_date)}
          </p>
        )}
      </div>
    </div>
  );
}
