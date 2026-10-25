import DeletedLog from "@/components/RecoveryRecords";
import { api as workspaceApi } from "@/lib/workspace";
import { useRouter } from "next/router";
import { AdminNavigation } from "@/components/AdminShell";
import CustomerWorkspace from "@/components/CustomerWorkspace";
import Drawer, { useModalFocus } from "@/components/Drawer";
import Icon from "@/components/Icon";
import { useState, useEffect, useCallback, useContext } from "react";
import type { Session } from "@/lib/database";
import {
  database,
  signIn,
  signOut,
  fetchAllData,
  fetchDeletedCustomers,
} from "@/lib/database";
import type {
  DbCustomer,
  DbPet,
  DbAppointment,
  DbDeletedCustomer,
} from "@/lib/database";
import DashboardPage from "./dashboard";
import MembersPage from "./members";
import CustomerPortal from "./portal";
import AccountsPage from "./accounts";

// ─── Constants ────────────────────────────────────────────────────────────────
const PET_ICONS = {
  Dog: <Icon name="paw" size={22} />,
  Cat: <Icon name="paw" size={22} />,
  Bird: <Icon name="paw" size={22} />,
  Fish: <Icon name="paw" size={22} />,
  Rabbit: <Icon name="paw" size={22} />,
  Hamster: <Icon name="paw" size={22} />,
  Other: <Icon name="paw" size={22} />,
};
const getPetIcon = (type: string) =>
  PET_ICONS[type as keyof typeof PET_ICONS] || <Icon name="paw" size={22} />;
const APPT_TYPES = [
  "BG, BT",
  "FG, BT",
  "BG Only",
  "BT Only",
  "FG Only",
  "Nail Trim",
  "Other",
];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const INPUT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all";
const INPUT_SM =
  "w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

// ─── Types ────────────────────────────────────────────────────────────────────
type Appointment = {
  id: string;
  day: string;
  date: string;
  type: string;
  groomer: string;
  price: number | null;
  pBuy: number | null;
  pUse: number | null;
  pLeft: number;
  notes: string;
};
export type Pet = {
  id: string;
  petName: string;
  petType: string;
  breed: string;
  age: number | null;
  address: string;
  medicalHistory: string;
  contact: string;
  preferredGroomer: string;
  appointments: Appointment[];
};
export type Customer = {
  id: string;
  customerId: string;
  customerName: string;
  pets: Pet[];
};

// ─── DB mapping ───────────────────────────────────────────────────────────────
function mapData(
  customers: DbCustomer[],
  pets: DbPet[],
  appointments: DbAppointment[],
): Customer[] {
  return customers.map((c) => ({
    id: c.id,
    customerId: c.customer_id ?? "",
    customerName: c.customer_name,
    pets: pets
      .filter((p) => p.customer_id === c.id)
      .map((p) => ({
        id: p.id,
        petName: p.pet_name,
        petType: p.pet_type ?? "Other",
        breed: p.breed ?? "",
        age: p.age,
        address: p.address ?? "",
        medicalHistory: p.medical_history ?? "",
        contact: p.contact ?? "",
        preferredGroomer: p.preferred_groomer ?? "",
        appointments: appointments
          .filter((a) => a.pet_id === p.id)
          .map((a) => ({
            id: a.id,
            day: a.day ?? "",
            date: a.date ?? "",
            type: a.type ?? "",
            groomer: a.groomer ?? "",
            price: a.price,
            pBuy: a.p_buy,
            pUse: a.p_use,
            pLeft: a.p_left ?? 0,
            notes: a.notes ?? "",
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      })),
  }));
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Dog: "bg-sky-50 text-sky-700",
    Cat: "bg-stone-100 text-stone-600",
    Bird: "bg-sky-50 text-sky-700",
    Fish: "bg-sky-50 text-sky-700",
    Rabbit: "bg-stone-100 text-stone-600",
    Hamster: "bg-stone-100 text-stone-600",
  };
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[type] || "bg-gray-100 text-gray-600"}`}
    >
      {type || "Other"}
    </span>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await signIn(email, password);
    if (error) setError(error.message ?? "Unable to sign in");
    setLoading(false);
  };

  return (
    <main className="pm-login">
      <section className="pm-login-card">
        <div className="pm-login-brand">
          <span>
            <Icon name="paw" size={24} />
          </span>
          <strong>PetMan</strong>
        </div>
        <h1>Sign in to your workspace</h1>
        <p>Manage customers, appointments and memberships.</p>
        <form onSubmit={handleLogin}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p role="alert" className="pm-login-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <a href="/book">
          Looking to book an appointment? <Icon name="arrow" size={14} />
        </a>
        <a href="/login">
          Customer account sign in <Icon name="arrow" size={14} />
        </a>
      </section>
    </main>
  );
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────
// KEY FIX: All inputs are inline — no sub-components (F / inp) that caused remount on every keystroke
function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (c: Customer) => void;
}) {
  const panelRef = useModalFocus(onClose);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("Dog");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!customerName.trim()) e.customerName = "Required";
    if (!petName.trim()) e.petName = "Required";
    if (!contact.trim()) e.contact = "Required";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSaving(true);
    let created: {customerId:string;customerRef:string;petId:string};
    try { created=await workspaceApi('/new-customer',{customerName:customerName.trim(),customerRef:customerId.trim(),petName:petName.trim(),petType,phone:contact.trim()}); }
    catch(error){setErrors({customerName:error instanceof Error?error.message:'Unable to create customer'});setSaving(false);return;}
    const cId=created.customerRef,cData={id:created.customerId},pData={id:created.petId};

    onAdd({
      id: cData.id,
      customerId: cId,
      customerName: customerName.trim(),
      pets: [
        {
          id: pData.id,
          petName: petName.trim(),
          petType,
          breed: "",
          age: null,
          address: "",
          medicalHistory: "",
          preferredGroomer: "",
          contact: contact.trim(),
          appointments: [],
        },
      ],
    });
    setSaving(false);
  };

  const errCls = (k: string) =>
    errors[k]
      ? "border-red-400 ring-2 ring-red-100"
      : "border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="New customer & pet"
      data-admin-panel="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
        style={{ animation: "popIn .18s ease-out" }}
      >
        <button
          type="button"
          className="pm-icon-button pm-panel-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Icon name="close" size={16} />
        </button>
        <div className="px-7 pt-6 pb-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
            <Icon name="paw" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-800">
              New customer & pet
            </h2>
            <p className="text-xs text-stone-400">
              Keep customer and pet details together.
            </p>
          </div>
        </div>
        <div className="px-7 py-5 space-y-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-teal-500">
            Owner
          </p>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Customer Name *
            </label>
            <input
              aria-label="Customer name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setErrors((x) => ({ ...x, customerName: "" }));
              }}
              placeholder="e.g. Alex Tan"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${errCls("customerName")}`}
            />
            {errors.customerName && (
              <p className="text-xs text-red-500 mt-1">{errors.customerName}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Customer ID
            </label>
            <input
              aria-label="Customer reference"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Auto-generated if empty"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100`}
            />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-teal-500 pt-1">
            Pet
          </p>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Pet Name *
            </label>
            <input
              aria-label="Pet name"
              value={petName}
              onChange={(e) => {
                setPetName(e.target.value);
                setErrors((x) => ({ ...x, petName: "" }));
              }}
              placeholder="e.g. Milo"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${errCls("petName")}`}
            />
            {errors.petName && (
              <p className="text-xs text-red-500 mt-1">{errors.petName}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Pet Type
            </label>
            <input
              list="pt-add"
              aria-label="Pet type"
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              placeholder="e.g. Dog, Cat…"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100`}
            />
            <datalist id="pt-add">
              {Object.keys(PET_ICONS).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Contact Number *
            </label>
            <input
              aria-label="Phone number"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                setErrors((x) => ({ ...x, contact: "" }));
              }}
              placeholder="e.g. 91234567"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${errCls("contact")}`}
            />
            {errors.contact && (
              <p className="text-xs text-red-500 mt-1">{errors.contact}</p>
            )}
          </div>
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Pet to Existing Customer ─────────────────────────────────────────────
function AddPetModal({
  customer,
  onClose,
  onAdd,
}: {
  customer: Customer;
  onClose: () => void;
  onAdd: (p: Pet) => void;
}) {
  const panelRef = useModalFocus(onClose);
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("Dog");
  const [contact, setContact] = useState(customer.pets[0]?.contact ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!petName.trim()) {
      setError("Pet name is required");
      return;
    }
    setSaving(true);
    const { data, error } = await database
      .from("pets")
      .insert({
        customer_id: customer.id,
        pet_name: petName.trim(),
        pet_type: petType,
        contact: contact.trim(),
      })
      .select()
      .single();
    if (error || !data) {
      setSaving(false);
      return;
    }
    onAdd({
      id: data.id,
      petName: petName.trim(),
      petType,
      breed: "",
      age: null,
      address: "",
      medicalHistory: "",
      preferredGroomer: "",
      contact: contact.trim(),
      appointments: [],
    });
    setSaving(false);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Add pet"
      data-admin-panel="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
        style={{ animation: "popIn .18s ease-out" }}
      >
        <button
          type="button"
          className="pm-icon-button pm-panel-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Icon name="close" size={16} />
        </button>
        <div className="px-7 pt-6 pb-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
            <Icon name="paw" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-800">
              Add Another Pet
            </h2>
            <p className="text-xs text-stone-400">
              For{" "}
              <span className="font-bold text-stone-600">
                {customer.customerName}
              </span>{" "}
              · {customer.customerId}
            </p>
          </div>
        </div>
        <div className="px-7 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Pet Name *
            </label>
            <input
              aria-label="Pet name"
              value={petName}
              onChange={(e) => {
                setPetName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Max"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${error ? "border-red-400 ring-2 ring-red-100" : "border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"}`}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Pet Type
            </label>
            <input
              list="pt-addpet"
              aria-label="Pet type"
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              placeholder="e.g. Dog, Cat…"
              className={INPUT_CLS}
            />
            <datalist id="pt-addpet">
              {Object.keys(PET_ICONS).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Contact
            </label>
            <input
              aria-label="Phone number"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. 91234567"
              className={INPUT_CLS}
            />
          </div>
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add Pet ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Appointment Modal ────────────────────────────────────────────────────
function AddApptModal({
  petId,
  pLeft,
  onClose,
  onAdd,
}: {
  petId: string;
  pLeft: number;
  onClose: () => void;
  onAdd: (a: Appointment) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const dayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const panelRef = useModalFocus(onClose);
  const [day, setDay] = useState(dayName);
  const [date, setDate] = useState(today);
  const [type, setType] = useState("");
  const [groomer, setGroomer] = useState("");
  const [price, setPrice] = useState("");
  const [pBuy, setPBuy] = useState("");
  const [pUse, setPUse] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const computedPLeft =
    (pLeft || 0) + (parseInt(pBuy) || 0) - (parseInt(pUse) || 0);

  const handleDateChange = (val: string) => {
    const d = new Date(val + "T00:00:00");
    setDate(val);
    setDay(
      isNaN(d.getTime()) ? "" : DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
    );
  };

  const submit = async () => {
    setSaving(true);
    const { data, error } = await database
      .from("appointments")
      .insert({
        pet_id: petId,
        day,
        date: date || null,
        type,
        groomer,
        price: price !== "" ? parseFloat(price) : null,
        p_buy: pBuy !== "" ? parseInt(pBuy) : null,
        p_use: pUse !== "" ? parseInt(pUse) : null,
        p_left: computedPLeft,
        notes,
      })
      .select()
      .single();
    if (error || !data) {
      setSaving(false);
      return;
    }
    onAdd({
      id: data.id,
      day: data.day ?? "",
      date: data.date ?? "",
      type: data.type ?? "",
      groomer: data.groomer ?? "",
      price: data.price,
      pBuy: data.p_buy,
      pUse: data.p_use,
      pLeft: data.p_left ?? 0,
      notes: data.notes ?? "",
    });
    setSaving(false);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="New visit"
      data-admin-panel="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
        style={{ animation: "popIn .18s ease-out" }}
      >
        <button
          type="button"
          className="pm-icon-button pm-panel-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Icon name="close" size={16} />
        </button>
        <div className="px-7 pt-6 pb-4 border-b border-stone-100">
          <h2 className="text-lg font-black text-stone-800">Log a Visit</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Record grooming details and package usage.
          </p>
        </div>
        <div
          className="px-7 py-5 space-y-3 overflow-y-auto"
          style={{ maxHeight: "55vh" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                Day
              </label>
              <div className="px-3 py-2 rounded-xl border border-stone-200 text-sm bg-stone-50 text-stone-600 font-semibold">
                {day || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className={INPUT_SM}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Appointment Type
            </label>
            <input
              list="appt-types"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. BG, BT or custom…"
              className={INPUT_SM}
            />
            <datalist id="appt-types">
              {APPT_TYPES.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Groomer / Staff
            </label>
            <input
              value={groomer}
              onChange={(e) => setGroomer(e.target.value)}
              placeholder="e.g. Tania"
              className={INPUT_SM}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Price (SGD)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Leave empty if using package"
              className={INPUT_SM}
            />
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-teal-600 mb-3">
              📦 Package
            </p>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  P Buy
                </label>
                <input
                  type="number"
                  value={pBuy}
                  onChange={(e) => setPBuy(e.target.value)}
                  placeholder="0"
                  className={INPUT_SM}
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Sessions bought
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  P Use
                </label>
                <input
                  type="number"
                  value={pUse}
                  onChange={(e) => setPUse(e.target.value)}
                  placeholder="1"
                  className={INPUT_SM}
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Used this visit
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  P Left
                </label>
                <div
                  className={`px-3 py-2 rounded-xl text-sm font-black text-center border-2
                  ${
                    computedPLeft < 0
                      ? "border-red-300 bg-red-50 text-red-600"
                      : computedPLeft === 0
                        ? "border-amber-300 bg-amber-50 text-amber-600"
                        : "border-teal-300 bg-white text-teal-700"
                  }`}
                >
                  {computedPLeft}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-stone-400">Balance:</span>
              <span className="font-black text-stone-600">{pLeft}</span>
              <span className="text-stone-300">
                +{parseInt(pBuy) || 0} −{parseInt(pUse) || 0} =
              </span>
              <span
                className={`font-black ${computedPLeft < 0 ? "text-red-500" : "text-teal-600"}`}
              >
                {computedPLeft}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Notes
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className={INPUT_SM}
            />
          </div>
        </div>
        <div className="px-7 pb-7 pt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pet Detail ───────────────────────────────────────────────────────────────
// Row wrapper for info tab
const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-5 gap-3 items-start py-3 border-b border-stone-100 last:border-0">
    <div className="col-span-2">
      <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">
        {label}
      </p>
      {hint && <p className="text-[10px] text-stone-300 mt-0.5">{hint}</p>}
    </div>
    <div className="col-span-3">{children}</div>
  </div>
);
const Txt = ({ v }: { v: string | number | null }) => (
  <p
    className={`text-sm ${v ? "text-stone-700 font-medium" : "text-stone-300 italic"}`}
  >
    {v || "Not specified"}
  </p>
);

function PetDetail({
  customer,
  pet: initPet,
  onBack,
  onSave,
}: {
  customer: Customer;
  pet: Pet;
  onBack: () => void;
  onSave: (cId: string, p: Pet) => void;
}) {
  const [pet, setPet] = useState(initPet);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAppt, setShowAppt] = useState(false);
  const [tab, setTab] = useState("info");
  const [confirmDeleteAppt, setConfirmDeleteAppt] = useState<string | null>(
    null,
  );

  // Each field is its own state variable — no re-mount issues
  const [fPetName, setFPetName] = useState(initPet.petName);
  const [fPetType, setFPetType] = useState(initPet.petType);
  const [fBreed, setFBreed] = useState(initPet.breed);
  const [fAge, setFAge] = useState(String(initPet.age ?? ""));
  const [fAddress, setFAddress] = useState(initPet.address);
  const [fMedical, setFMedical] = useState(initPet.medicalHistory);
  const [fContact, setFContact] = useState(initPet.contact);
  const [fGroomer, setFGroomer] = useState(initPet.preferredGroomer);

  const resetForm = (p: Pet) => {
    setFPetName(p.petName);
    setFPetType(p.petType);
    setFBreed(p.breed);
    setFAge(String(p.age ?? ""));
    setFAddress(p.address);
    setFMedical(p.medicalHistory);
    setFContact(p.contact);
    setFGroomer(p.preferredGroomer);
  };

  const currentPLeft =
    pet.appointments.length > 0
      ? (pet.appointments[pet.appointments.length - 1].pLeft ?? 0)
      : 0;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await database
      .from("pets")
      .update({
        pet_name: fPetName,
        pet_type: fPetType,
        breed: fBreed,
        age: fAge !== "" ? parseFloat(fAge) : null,
        address: fAddress,
        medical_history: fMedical,
        contact: fContact,
        preferred_groomer: fGroomer,
      })
      .eq("id", pet.id);

    if (!error) {
      const updated: Pet = {
        ...pet,
        petName: fPetName,
        petType: fPetType,
        breed: fBreed,
        age: fAge !== "" ? parseFloat(fAge) : null,
        address: fAddress,
        medicalHistory: fMedical,
        contact: fContact,
        preferredGroomer: fGroomer,
      };
      setPet(updated);
      onSave(customer.id, updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const handleAddAppt = (appt: Appointment) => {
    const updated = { ...pet, appointments: [...pet.appointments, appt] };
    setPet(updated);
    onSave(customer.id, updated);
    setShowAppt(false);
  };

  const handleDeleteAppt = async (apptId: string) => {
    await database.from("appointments").delete().eq("id", apptId);
    const updated = {
      ...pet,
      appointments: pet.appointments.filter((a) => a.id !== apptId),
    };
    setPet(updated);
    onSave(customer.id, updated);
    setConfirmDeleteAppt(null);
  };

  const totalSpend = pet.appointments.reduce((s, a) => s + (a.price || 0), 0);
  const totalSessions = pet.appointments.reduce((s, a) => s + (a.pUse || 0), 0);
  const visitCount = pet.appointments.filter((a) => a.date).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-teal-600 transition-colors group"
          >
            <span className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-teal-50 flex-shrink-0">
              ←
            </span>
            <span className="hidden sm:inline">Back to List</span>
            <span className="sm:hidden">Back</span>
          </button>
          <div className="flex gap-2">
            {!editing ? (
              <button
                aria-label="Edit pet information"
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-sm shadow-teal-200"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    resetForm(pet);
                    setEditing(false);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-sm shadow-teal-200 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
        {/* Hero */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#e6f7f5,#ccede9)" }}
            >
              {getPetIcon(pet.petType)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-stone-800 tracking-tight">
                {pet.petName}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge type={pet.petType} />
                {pet.breed && (
                  <span className="text-xs text-stone-400">{pet.breed}</span>
                )}
                {pet.age && (
                  <span className="text-xs text-stone-400">{pet.age} yrs</span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-1">
                Owner:{" "}
                <span className="font-semibold text-stone-600">
                  {customer.customerName}
                </span>{" "}
                · {customer.customerId}
              </p>
            </div>
            <div
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border-2 ${currentPLeft <= 0 ? "border-amber-300 bg-amber-50" : "border-teal-300 bg-teal-50"}`}
            >
              <p
                className={`text-2xl sm:text-3xl font-black leading-none ${currentPLeft <= 0 ? "text-amber-500" : "text-teal-600"}`}
              >
                {currentPLeft}
              </p>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-1">
                Sessions
                <br />
                Left
              </p>
            </div>
          </div>
          {saved && (
            <div className="mt-3 px-4 py-2 bg-teal-50 rounded-xl text-teal-600 text-sm font-bold">
              Changes saved
            </div>
          )}
          {currentPLeft <= 1 &&
            currentPLeft >= 0 &&
            pet.appointments.length > 0 && (
              <div className="mt-3 px-4 py-2 bg-amber-50 rounded-xl text-amber-700 text-xs font-bold">
                ⚠{" "}
                {currentPLeft === 0
                  ? "Package exhausted — time to top up!"
                  : "Last session remaining — remind owner to top up!"}
              </div>
            )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Visits", value: visitCount },
            { label: "Sessions Used", value: totalSessions },
            {
              label: "Total Spend",
              value: totalSpend > 0 ? `$${totalSpend}` : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-stone-100 shadow-sm p-3 text-center"
            >
              <p className="text-xl font-black text-stone-800">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-2xl p-1">
          {["info", "visits"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-black transition-all capitalize
                ${tab === t ? "bg-white text-teal-600 shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
            >
              {t === "info"
                ? "Pet Info"
                : `Visit Log (${pet.appointments.length})`}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {tab === "info" && (
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-teal-500 mb-3">
              Pet Information
            </p>
            <Row label="Owner Name">
              <Txt v={customer.customerName} />
            </Row>
            <Row label="Pet Name">
              {editing ? (
                <input
                  aria-label="Pet name"
                  value={fPetName}
                  onChange={(e) => setFPetName(e.target.value)}
                  className={INPUT_SM}
                />
              ) : (
                <Txt v={fPetName} />
              )}
            </Row>
            <Row label="Pet Type">
              {editing ? (
                <>
                  <input
                    list="pt-edit"
                    aria-label="Pet type"
                    value={fPetType}
                    onChange={(e) => setFPetType(e.target.value)}
                    className={INPUT_SM}
                  />
                  <datalist id="pt-edit">
                    {Object.keys(PET_ICONS).map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              ) : (
                <Txt v={fPetType} />
              )}
            </Row>
            <Row label="Breed" hint="e.g. Golden Retriever">
              {editing ? (
                <input
                  aria-label="Breed"
                  value={fBreed}
                  onChange={(e) => setFBreed(e.target.value)}
                  className={INPUT_SM}
                />
              ) : (
                <Txt v={fBreed} />
              )}
            </Row>
            <Row label="Age (yrs)">
              {editing ? (
                <input
                  type="number"
                  aria-label="Age"
                  value={fAge}
                  onChange={(e) => setFAge(e.target.value)}
                  className={INPUT_SM}
                />
              ) : (
                <Txt v={fAge} />
              )}
            </Row>
            <Row label="Address">
              {editing ? (
                <textarea
                  aria-label="Address"
                  value={fAddress}
                  onChange={(e) => setFAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 resize-none"
                />
              ) : (
                <Txt v={fAddress} />
              )}
            </Row>
            <Row label="Medical History" hint="Conditions, allergies">
              {editing ? (
                <textarea
                  aria-label="Medical history"
                  value={fMedical}
                  onChange={(e) => setFMedical(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 resize-none"
                />
              ) : (
                <Txt v={fMedical} />
              )}
            </Row>
            <Row label="Contact">
              {editing ? (
                <input
                  aria-label="Phone number"
                  value={fContact}
                  onChange={(e) => setFContact(e.target.value)}
                  className={INPUT_SM}
                />
              ) : (
                <Txt v={fContact} />
              )}
            </Row>
            <Row label="Preferred Groomer">
              {editing ? (
                <input
                  aria-label="Preferred groomer"
                  value={fGroomer}
                  onChange={(e) => setFGroomer(e.target.value)}
                  className={INPUT_SM}
                />
              ) : (
                <Txt v={fGroomer} />
              )}
            </Row>
          </div>
        )}

        {/* Visits Tab */}
        {tab === "visits" && (
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3">
              <p className="text-xs font-black uppercase tracking-widest text-teal-600 mb-1.5">
                📦 Package Columns
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
                <span>
                  <strong className="text-stone-700">P Buy</strong> = Sessions
                  purchased
                </span>
                <span>
                  <strong className="text-stone-700">P Use</strong> = Sessions
                  used
                </span>
                <span>
                  <strong className="text-stone-700">P Left</strong> = Running
                  balance
                </span>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-teal-500">
                  Visit History
                </p>
                <button
                  onClick={() => setShowAppt(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-black hover:bg-teal-600 active:scale-95 transition-all shadow-sm shadow-teal-200"
                >
                  + Add Visit
                </button>
              </div>
              {pet.appointments.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-4xl mb-2">📋</p>
                  <p className="text-stone-400 text-sm font-semibold">
                    No visits logged yet
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile: card view */}
                  <div className="block sm:hidden divide-y divide-stone-50">
                    {pet.appointments.map((a) => (
                      <div
                        key={a.id}
                        className="p-4 hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-black text-stone-700 text-sm">
                              {a.date || "—"}{" "}
                              <span className="font-normal text-stone-400 text-xs">
                                ({a.day || "—"})
                              </span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {a.type && (
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold">
                                  {a.type}
                                </span>
                              )}
                              {a.groomer && (
                                <span className="text-xs text-stone-400">
                                  {a.groomer}
                                </span>
                              )}
                              {a.price != null && (
                                <span className="text-xs font-semibold text-stone-600">
                                  ${a.price}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-black ${(a.pLeft ?? 0) <= 0 ? "bg-amber-100 text-amber-600" : "bg-teal-100 text-teal-700"}`}
                            >
                              {a.pLeft ?? 0} left
                            </span>
                            {confirmDeleteAppt === a.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteAppt(a.id)}
                                  className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-black"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteAppt(null)}
                                  className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 text-[10px] font-black"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteAppt(a.id)}
                                className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center text-xs hover:bg-red-100"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-stone-500">
                          {a.pBuy != null && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-black">
                              +{a.pBuy} bought
                            </span>
                          )}
                          {a.pUse != null && (
                            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded font-black">
                              -{a.pUse} used
                            </span>
                          )}
                          {a.notes && (
                            <span className="truncate text-stone-400">
                              {a.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table view */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-100">
                          {[
                            "Day",
                            "Date",
                            "Type",
                            "Groomer",
                            "Price",
                            "P Buy",
                            "P Use",
                            "P Left",
                            "Notes",
                            "",
                          ].map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-stone-400 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pet.appointments.map((a, i) => (
                          <tr
                            key={a.id}
                            className={`hover:bg-stone-50 transition-colors group/row ${i < pet.appointments.length - 1 ? "border-b border-stone-50" : ""}`}
                          >
                            <td className="px-3 py-3 font-semibold text-stone-600 whitespace-nowrap">
                              {a.day || "—"}
                            </td>
                            <td className="px-3 py-3 text-stone-500 whitespace-nowrap font-mono text-xs">
                              {a.date || "—"}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {a.type ? (
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold">
                                  {a.type}
                                </span>
                              ) : (
                                <span className="text-stone-300 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-stone-500 whitespace-nowrap text-xs">
                              {a.groomer || "—"}
                            </td>
                            <td className="px-3 py-3 font-semibold text-stone-700 whitespace-nowrap">
                              {a.price != null ? (
                                `$${a.price}`
                              ) : (
                                <span className="text-stone-300 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {a.pBuy != null ? (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">
                                  +{a.pBuy}
                                </span>
                              ) : (
                                <span className="text-stone-300 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {a.pUse != null ? (
                                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-black">
                                  -{a.pUse}
                                </span>
                              ) : (
                                <span className="text-stone-300 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-black ${(a.pLeft ?? 0) <= 0 ? "bg-amber-100 text-amber-600" : "bg-teal-100 text-teal-700"}`}
                              >
                                {a.pLeft ?? 0}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-stone-400 text-xs max-w-[100px] truncate">
                              {a.notes || "—"}
                            </td>
                            <td className="px-3 py-3">
                              {confirmDeleteAppt === a.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-red-500 font-bold whitespace-nowrap">
                                    Sure?
                                  </span>
                                  <button
                                    onClick={() => handleDeleteAppt(a.id)}
                                    className="px-2 py-0.5 rounded-lg bg-red-500 text-white text-[10px] font-black"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteAppt(null)}
                                    className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-500 text-[10px] font-black"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteAppt(a.id)}
                                  className="opacity-0 group-hover/row:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center text-xs"
                                >
                                  ✕
                                </button>
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
        )}
      </div>

      {showAppt && (
        <AddApptModal
          petId={pet.id}
          pLeft={currentPLeft}
          onClose={() => setShowAppt(false)}
          onAdd={handleAddAppt}
        />
      )}
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

// ─── Backup Page ─────────────────────────────────────────────────────────────
function BackupPage({ onBack }: { onBack: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [backupInfo, setBackupInfo] = useState<{
    date: string;
    customers: number;
    pets: number;
    appointments: number;
  } | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/backup");
      if (!response.ok) throw new Error("Backup failed");
      const backup = (await response.json()) as any;

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `petman-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({
        type: "success",
        msg: `✓ Backup downloaded — ${backup.counts.customers} customers, ${backup.counts.pets} pets, ${backup.counts.appointments} visits`,
      });
    } catch {
      setStatus({
        type: "error",
        msg: "Failed to download backup. Try again.",
      });
    }
    setDownloading(false);
  };

  const handleFilePreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.data) throw new Error("Invalid");
      setBackupInfo({
        date: new Date(backup.exported_at).toLocaleString("en-SG"),
        customers: backup.counts.customers ?? 0,
        pets: backup.counts.pets ?? 0,
        appointments: backup.counts.appointments ?? 0,
      });
    } catch {
      setStatus({
        type: "error",
        msg: "Invalid backup file. Please select a PetMan backup JSON.",
      });
      setBackupInfo(null);
    }
    e.target.value = "";
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setStatus(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.data) throw new Error("Invalid");
      const { customers, pets, appointments, deleted_customers } = backup.data;

      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });
      if (!response.ok) throw new Error("Import failed");

      setStatus({
        type: "success",
        msg: `✓ Merge complete — ${customers?.length ?? 0} customers, ${pets?.length ?? 0} pets, ${appointments?.length ?? 0} visits restored. Reload the page to see your data.`,
      });
      setBackupInfo(null);
    } catch {
      setStatus({
        type: "error",
        msg: "Restore failed. The backup file may be corrupted.",
      });
    }
    setRestoring(false);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-teal-600 transition-colors group"
          >
            <span className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-teal-50">
              ←
            </span>
            Back to List
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">💾</span>
            <h1 className="text-base font-black text-stone-700">
              Backup & Restore
            </h1>
          </div>
          <div className="w-24" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {status && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm font-semibold
            ${status.type === "success" ? "bg-teal-50 border border-teal-200 text-teal-700" : "bg-red-50 border border-red-200 text-red-600"}`}
          >
            {status.msg}
          </div>
        )}

        {/* Download */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg,#14b8a6,#0d9488)" }}
          />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-2xl flex-shrink-0">
                💾
              </div>
              <div className="flex-1">
                <h2 className="text-base font-black text-stone-800">
                  Download Backup
                </h2>
                <p className="text-sm text-stone-400 mt-1">
                  Downloads a <strong className="text-stone-600">.json</strong>{" "}
                  file with all customers, pets, visit history and deleted log.
                  Save it to Google Drive, iCloud, or your computer.
                </p>
                <div className="mt-4 p-3 bg-stone-50 rounded-xl text-xs text-stone-500 space-y-1">
                  <p>
                    📁 File name:{" "}
                    <span className="font-mono font-bold text-stone-600">
                      petman-backup-YYYY-MM-DD.json
                    </span>
                  </p>
                  <p>🔒 Contains all your data — keep it private</p>
                  <p>📅 Recommended: backup once a week</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="mt-5 w-full py-3 rounded-2xl bg-teal-500 text-white font-black text-sm hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
            >
              {downloading ? "Preparing backup…" : "⬇ Download Backup Now"}
            </button>
          </div>
        </div>

        {/* Restore */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg,#f59e0b,#d97706)" }}
          />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl flex-shrink-0">
                📂
              </div>
              <div className="flex-1">
                <h2 className="text-base font-black text-stone-800">
                  Restore from Backup
                </h2>
                <p className="text-sm text-stone-400 mt-1">
                  Select a{" "}
                  <strong className="text-stone-600">
                    petman-backup-*.json
                  </strong>{" "}
                  file.{" "}
                  <span className="text-red-500 font-semibold">
                    Matching record IDs will be updated.
                  </span>
                </p>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-semibold">
                  The import merges business records. Existing records missing
                  from the file and login accounts are preserved.
                </div>

                {!backupInfo ? (
                  <div className="mt-4">
                    <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-stone-200 hover:border-teal-300 hover:bg-teal-50 text-sm font-bold text-stone-500 hover:text-teal-600 cursor-pointer transition-all">
                      📁 Choose .json file to preview
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFilePreview}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                      <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">
                        Backup Preview
                      </p>
                      <p className="text-xs text-stone-500 mb-3">
                        📅 Exported:{" "}
                        <strong className="text-stone-700">
                          {backupInfo.date}
                        </strong>
                      </p>
                      <div className="flex gap-6">
                        {[
                          { label: "Customers", val: backupInfo.customers },
                          { label: "Pets", val: backupInfo.pets },
                          { label: "Visits", val: backupInfo.appointments },
                        ].map((s) => (
                          <div key={s.label} className="text-center">
                            <p className="text-2xl font-black text-stone-800">
                              {s.val}
                            </p>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">
                              {s.label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setBackupInfo(null)}
                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
                      >
                        Cancel
                      </button>
                      <label
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all
                        ${restoring ? "bg-amber-300 text-white opacity-60 pointer-events-none" : "bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-lg shadow-amber-200"}`}
                      >
                        {restoring ? "Restoring…" : "↩ Confirm Restore"}
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleRestore}
                          disabled={restoring}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-teal-500 mb-3">
            💡 Backup Tips
          </p>
          <div className="space-y-2 text-sm text-stone-500">
            <p>
              • <strong className="text-stone-700">Weekly backups</strong> —
              Download every Monday before you start the week
            </p>
            <p>
              • <strong className="text-stone-700">Before big changes</strong> —
              Always backup before adding or deleting many records
            </p>
            <p>
              • <strong className="text-stone-700">Store in 2 places</strong> —
              Save to Google Drive AND your phone/computer
            </p>
            <p>
              • <strong className="text-stone-700">Auto-named by date</strong> —
              Files are named{" "}
              <span className="font-mono text-xs">
                petman-backup-2026-02-17.json
              </span>{" "}
              so you can tell them apart
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deleted Log Page ─────────────────────────────────────────────────────────
function CustomerCard({
  customer,
  onSelectPet,
  onDelete,
  onAddPet,
}: {
  customer: Customer;
  onSelectPet: (c: Customer, p: Pet) => void;
  onDelete: (id: string) => void;
  onAddPet: (c: Customer) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div
        className="h-1.5"
        style={{ background: "linear-gradient(90deg,#14b8a6,#0d9488)" }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-stone-800 tracking-tight">
              {customer.customerName}
            </h3>
            <p className="text-xs text-stone-400 font-mono">
              {customer.customerId}
            </p>
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-8 h-8 rounded-xl bg-stone-50 hover:bg-red-50 text-stone-300 hover:text-red-400 flex items-center justify-center transition-all"
            >
              🗑
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-500 font-bold">Sure?</span>
              <button
                onClick={() => onDelete(customer.id)}
                className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-black"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 text-[10px] font-black"
              >
                No
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-stone-400">
            {customer.pets.length} Pet{customer.pets.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => onAddPet(customer)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-600 text-[11px] font-black transition-all"
          >
            + Add Pet
          </button>
        </div>

        <div className="space-y-2">
          {customer.pets.map((pet) => {
            const pLeft =
              pet.appointments.length > 0
                ? (pet.appointments[pet.appointments.length - 1].pLeft ?? 0)
                : 0;
            return (
              <button
                key={pet.id}
                onClick={() => onSelectPet(customer, pet)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-stone-50 hover:bg-teal-50 border border-transparent hover:border-teal-100 transition-all text-left group"
              >
                <span className="text-2xl">{getPetIcon(pet.petType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-stone-700 text-sm group-hover:text-teal-700">
                    {pet.petName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge type={pet.petType} />
                    {pet.breed && (
                      <span className="text-[11px] text-stone-400 truncate">
                        {pet.breed}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`flex-shrink-0 text-center px-2.5 py-1.5 rounded-xl border ${pLeft <= 0 ? "border-amber-200 bg-amber-50" : "border-teal-200 bg-teal-50"}`}
                >
                  <p
                    className={`text-sm font-black leading-none ${pLeft <= 0 ? "text-amber-500" : "text-teal-600"}`}
                  >
                    {pLeft}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-stone-400 mt-0.5">
                    left
                  </p>
                </div>
                <span className="text-stone-300 group-hover:text-teal-400">
                  →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Menu ─────────────────────────────────────────────────────────────
function MobileMenu({
  onBackup,
  onDeleted,
  onSignOut,
  onDashboard,
  onMembers,
  onAccounts,
}: {
  onBackup: () => void;
  onDeleted: () => void;
  onSignOut: () => void;
  onDashboard: () => void;
  onMembers: () => void;
  onAccounts: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-all"
      >
        <span className="text-lg leading-none">⋯</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-11 z-40 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden w-44"
            style={{ animation: "popIn .15s ease-out" }}
          >
            <a
              href="/bookings"
              className="block px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-stone-50"
            >
              Bookings
            </a>
            <a
              href="/staff"
              className="block px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-stone-50"
            >
              Users & permissions
            </a>
            <button
              onClick={() => {
                onDashboard();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors border-b border-stone-50"
            >
              📊 <span>Dashboard</span>
            </button>
            <button
              onClick={() => {
                onMembers();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors border-b border-stone-50"
            >
              🏅 <span>Members</span>
            </button>
            <button
              onClick={() => {
                onAccounts();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors border-b border-stone-50"
            >
              🔑 <span>Customer Accounts</span>
            </button>
            <button
              onClick={() => {
                onBackup();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors border-b border-stone-50"
            >
              💾 <span>Backup</span>
            </button>
            <button
              onClick={() => {
                onDeleted();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors border-b border-stone-50"
            >
              🗑 <span>Deleted Log</span>
            </button>
            <button
              onClick={() => {
                onSignOut();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              ↩ <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function PetMan({
  session,
  loading,
}: {
  session: Session | null;
  loading: boolean;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { view, setView } = useContext(AdminNavigation);
  const router = useRouter();
  useEffect(() => {
    const section = router.query.section;
    setView(
      typeof section === "string" &&
        [
          "list",
          "members",
          "accounts",
          "backup",
          "deleted",
          "dashboard",
        ].includes(section)
        ? section
        : "list",
    );
  }, [router.query.section, setView]);
  const [selected, setSelected] = useState<{
    customer: Customer | null;
    pet: Pet | null;
  }>({ customer: null, pet: null });
  const [showModal, setShowModal] = useState(false);
  const [addPetFor, setAddPetFor] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [userRole, setUserRole] = useState<"admin" | "customer" | null>(null);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    const {
      customers: dbC,
      pets: dbP,
      appointments: dbA,
    } = await fetchAllData();
    setCustomers(mapData(dbC, dbP, dbA));
    setDataLoading(false);
  }, []);

  // Detect role from DB — never trust JWT metadata (can be forged)
  const detectRole = useCallback(async () => {
    if (!session) return;
    const { data } = await database
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    // Missing roles fail closed; the Worker independently enforces authorization.
    setUserRole((data?.role as "admin" | "customer") ?? "customer");
  }, [session]);

  useEffect(() => {
    if (session) {
      detectRole();
      loadData();
    } else {
      setDataLoading(false);
      setUserRole(null);
    }
  }, [session, loadData, detectRole]);

  if (loading || (session && (dataLoading || userRole === null))) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#f0faf9,#e0f2ef)" }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">
            <Icon name="paw" size={22} />
          </div>
          <p className="text-stone-400 font-semibold text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  // ── Customer portal — read-only view of their own data ───────────────────────
  if (userRole === "customer") {
    return <CustomerPortal session={session} />;
  }

  const handleAdd = (nc: Customer) => {
    setCustomers((p) => [...p, nc]);
    setShowModal(false);
    setSelected({ customer: nc, pet: nc.pets[0] });
    setView("detail");
  };

  const handleAddPet = (newPet: Pet) => {
    if (!addPetFor) return;
    const updated = { ...addPetFor, pets: [...addPetFor.pets, newPet] };
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
    setAddPetFor(null);
    setSelected({ customer: updated, pet: newPet });
    setView("detail");
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {await workspaceApi('/customers/'+customerId+'/archive',{});}catch(error){window.dispatchEvent(new CustomEvent('petman-error',{detail:error instanceof Error?error.message:'Unable to archive customer'}));return;}
    setCustomers((p) => p.filter((c) => c.id !== customerId));
  };

  const handleRestore = () => {void loadData();setView('list');};

  const handleSavePet = (cId: string, updatedPet: Pet) => {
    setCustomers((p) =>
      p.map((c) =>
        c.id === cId
          ? {
              ...c,
              pets: c.pets.map((p) =>
                p.id === updatedPet.id ? updatedPet : p,
              ),
            }
          : c,
      ),
    );
    setSelected((s) => ({
      ...s,
      pet: updatedPet,
      customer:
        s.customer?.id === cId
          ? {
              ...s.customer,
              pets: s.customer.pets.map((p) =>
                p.id === updatedPet.id ? updatedPet : p,
              ),
            }
          : s.customer,
    }));
  };

  if (view === "backup")
    return (
      <div className="admin-legacy">
        <BackupPage onBack={() => setView("list")} />
      </div>
    );
  if (view === "deleted")
    return (
      <div className="admin-legacy">
        <DeletedLog onBack={() => setView("list")} onRestore={handleRestore} />
      </div>
    );
  if (view === "dashboard")
    return (
      <div className="admin-legacy">
        <DashboardPage
          onBack={() => setView("list")}
          onGoMembers={() => setView("members")}
        />
      </div>
    );
  if (view === "members")
    return (
      <div className="admin-legacy">
        <MembersPage onBack={() => setView("list")} />
      </div>
    );
  if (view === "accounts")
    return (
      <div className="admin-legacy">
        <AccountsPage onBack={() => setView("list")} session={session} />
      </div>
    );
  return (
    <>
      <CustomerWorkspace
        customers={customers}
        onAdd={() => setShowModal(true)}
        onAddPet={setAddPetFor}
        onOpen={(customer, pet) => {
          setSelected({ customer, pet });
          setView("detail");
        }}
        onDelete={handleDeleteCustomer}
      />
      {view === "detail" && selected.customer && selected.pet && (
        <Drawer title={selected.pet.petName} onClose={() => setView("list")}>
          <div className="pm-pet-tabs">
            {selected.customer.pets.map((p) => (
              <button
                key={p.id}
                className={selected.pet?.id === p.id ? "is-active" : ""}
                onClick={() => setSelected((s) => ({ ...s, pet: p }))}
              >
                {p.petName}
              </button>
            ))}
          </div>
          <div className="pm-pet-record">
            <PetDetail
              key={selected.pet.id}
              customer={selected.customer}
              pet={selected.pet}
              onBack={() => setView("list")}
              onSave={handleSavePet}
            />
          </div>
        </Drawer>
      )}
      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}
      {addPetFor && (
        <AddPetModal
          customer={addPetFor}
          onClose={() => setAddPetFor(null)}
          onAdd={handleAddPet}
        />
      )}
    </>
  );
}
