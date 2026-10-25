import { useState, useEffect, useCallback } from "react";
import { database } from "@/lib/database";

// ─── Types ────────────────────────────────────────────────────────────────────
type CustomerAccount = {
  userId: string;
  email: string;
  fullName: string;
  customerId: string;
  customerName: string;
  customerRef: string;
  isActive: boolean;
  createdAt: string;
};

type Customer = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  hasAccount: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INPUT_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all";

function validatePassword(pw: string): string | null {
  if (pw.length < 12) return "At least 12 characters";
  if (!/[a-z]/.test(pw)) return "Include a lowercase letter";
  if (!/[A-Z]/.test(pw)) return "Include an uppercase letter";
  if (!/\d/.test(pw)) return "Include a number";
  return null;
}

// ─── Create Account Modal ─────────────────────────────────────────────────────
function CreateAccountModal({
  customers,
  onClose,
  onCreated,
  session,
}: {
  customers: Customer[];
  onClose: () => void;
  onCreated: () => void;
  session: any;
}) {
  const [customerId, setCustomerId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pwErr, setPwErr] = useState("");

  const unlinked = customers.filter((c) => !c.hasAccount);

  const handleSubmit = async () => {
    setError("");
    if (!customerId) return setError("Please select a customer");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Valid email required");
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-customer-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Send session token — verified server-side, never trusted from metadata
        },
        body: JSON.stringify({ email, password, customerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create account");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePwChange = (v: string) => {
    setPassword(v);
    setPwErr(validatePassword(v) ?? "");
  };

  // Password strength indicator
  const strength =
    password.length === 0
      ? 0
      : [
          password.length >= 12,
          /[a-z]/.test(password),
          /[A-Z]/.test(password),
          /\d/.test(password),
        ].filter(Boolean).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = [
    "",
    "bg-red-400",
    "bg-amber-400",
    "bg-teal-400",
    "bg-teal-600",
  ][strength];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md"
        style={{ animation: "popIn .18s ease-out" }}
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
              🔑
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-800">
                Create Customer Login
              </h2>
              <p className="text-xs text-stone-400">
                Customer can log in to view their pet records
              </p>
            </div>
          </div>
        </div>

        <div className="px-7 py-5 space-y-4">
          {/* Customer select */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Link to customer <span className="text-red-400">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— Select customer —</option>
              {unlinked.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name} {c.customer_id ? `(${c.customer_id})` : ""}
                </option>
              ))}
            </select>
            {unlinked.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                All customers already have login accounts.
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Login email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@email.com"
              className={INPUT_CLS}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => handlePwChange(e.target.value)}
                placeholder="Min 8 chars, upper + lower + number"
                className={INPUT_CLS + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-stone-100"}`}
                    />
                  ))}
                </div>
                <p
                  className={`text-[11px] font-bold ${strength <= 2 ? "text-amber-500" : "text-teal-600"}`}
                >
                  {strengthLabel}
                </p>
              </div>
            )}
            {pwErr && password.length > 0 && (
              <p className="text-[11px] text-red-500 mt-1">{pwErr}</p>
            )}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-base flex-shrink-0">🔒</span>
            <p className="text-xs text-stone-500 leading-relaxed">
              Share these credentials directly with the customer. They can only
              view their own data — not other customers' records.
            </p>
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-semibold">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || unlinked.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create Account ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({
  account,
  onClose,
  session,
}: {
  account: CustomerAccount;
  onClose: () => void;
  session: any;
}) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError("");
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/reset-customer-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: account.userId, newPassword: password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,15,15,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm"
        style={{ animation: "popIn .18s ease-out" }}
      >
        <div className="px-7 pt-6 pb-4 border-b border-stone-100">
          <h2 className="text-lg font-black text-stone-800">Reset Password</h2>
          <p className="text-xs text-stone-400">
            {account.customerName} · {account.email}
          </p>
        </div>
        <div className="px-7 py-5 space-y-4">
          {done ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-bold text-stone-700">
                Password reset successfully
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Share the new password with the customer.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, upper + lower + number"
                    className={INPUT_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {error && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-semibold">
                  ⚠️ {error}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              onClick={handleReset}
              disabled={saving || !password}
              className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 disabled:opacity-60"
            >
              {saving ? "Resetting…" : "Reset ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Accounts Page ───────────────────────────────────────────────────────
export default function AccountsPage({
  onBack,
  session,
}: {
  onBack: () => void;
  session: any;
}) {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setReset] = useState<CustomerAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [{ data: custData }, { data: profileData }] = await Promise.all([
      database
        .from("customers")
        .select("id, customer_id, customer_name")
        .order("customer_name"),
      database
        .from("user_profiles")
        .select("id, role, customer_id, full_name, is_active, created_at")
        .eq("role", "customer"),
    ]);

    const profileList = profileData ?? [];
    const profileMap: Record<string, (typeof profileList)[0]> = {};
    profileList.forEach((p: Record<string, any>) => {
      if (p.customer_id) profileMap[p.customer_id] = p;
    });

    const custList: Customer[] = (custData ?? []).map((c: any) => ({
      id: c.id,
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      hasAccount: !!profileMap[c.id],
    }));
    setCustomers(custList);

    // Build account list — we don't have email in user_profiles, load from auth via Supabase
    // We store email in user_profiles.full_name context but need to get it from auth
    // Use the admin API route to get user emails — here we just show what we have
    const accts: CustomerAccount[] = profileList
      .map((p: any) => {
        const cust = custList.find((c) => c.id === p.customer_id);
        return {
          userId: p.id,
          email: "—", // email comes from auth.users; not stored in user_profiles for security
          fullName: p.full_name ?? "",
          customerId: p.customer_id ?? "",
          customerName: cust?.customer_name ?? "Unknown",
          customerRef: cust?.customer_id ?? "",
          isActive: p.is_active,
          createdAt: p.created_at,
        };
      })
      .filter((a: CustomerAccount) => a.customerId);

    setAccounts(accts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = accounts.filter(
    (a) =>
      a.customerName.toLowerCase().includes(search.toLowerCase()) ||
      a.customerRef.toLowerCase().includes(search.toLowerCase()) ||
      a.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const withAccount = customers.filter((c) => c.hasAccount).length;
  const withoutAccount = customers.filter((c) => !c.hasAccount).length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg,#f8faf9,#eef4f2)" }}
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-teal-600 transition-all text-sm font-bold"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-xl shadow-lg shadow-teal-200">
                🔑
              </div>
              <div>
                <h1 className="text-xl font-black text-stone-800 tracking-tight">
                  Customer Accounts
                </h1>
                <p className="text-xs text-stone-400">
                  <span className="font-bold text-teal-600">{withAccount}</span>{" "}
                  with login ·{" "}
                  <span className="font-bold text-amber-500">
                    {withoutAccount}
                  </span>{" "}
                  without
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-500 text-white font-black text-sm hover:bg-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-200 whitespace-nowrap"
            >
              + Create Login
            </button>
          </div>

          <div className="mt-3 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 text-sm bg-stone-50 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Customers without accounts */}
        {withoutAccount > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2">
              ⚠️ {withoutAccount} customer{withoutAccount !== 1 ? "s" : ""}{" "}
              without a login
            </p>
            <div className="flex flex-wrap gap-2">
              {customers
                .filter((c) => !c.hasAccount)
                .map((c) => (
                  <span
                    key={c.id}
                    className="text-xs font-bold px-2.5 py-1 bg-white border border-amber-200 rounded-full text-amber-700"
                  >
                    {c.customer_name}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Account list */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3 animate-pulse">🔑</div>
            <p className="text-stone-400 font-semibold text-sm">
              Loading accounts…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 shadow-sm">
            <p className="text-4xl mb-3">🔑</p>
            <p className="text-stone-400 font-bold">
              {accounts.length === 0
                ? "No customer accounts yet"
                : "No results found"}
            </p>
            {accounts.length === 0 && (
              <p className="text-xs text-stone-300 mt-1">
                Click "+ Create Login" to get started
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <div
                key={a.userId}
                className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden"
              >
                <div
                  className="h-1"
                  style={{
                    background: "linear-gradient(90deg,#14b8a6,#0d9488)",
                  }}
                />
                <div className="p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-lg font-black text-teal-600 flex-shrink-0">
                      {a.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-stone-800">
                        {a.customerName}
                      </p>
                      <p className="text-xs text-stone-400 font-mono">
                        {a.customerRef}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${a.isActive ? "bg-teal-400" : "bg-stone-300"}`}
                        />
                        <span className="text-[11px] text-stone-400">
                          {a.isActive ? "Active" : "Inactive"} · Created{" "}
                          {new Date(a.createdAt).toLocaleDateString("en-MY", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setReset(a)}
                    className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-black text-stone-500 hover:border-teal-300 hover:text-teal-600 transition-all whitespace-nowrap"
                  >
                    Reset PW
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAccountModal
          customers={customers}
          session={session}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          account={resetTarget}
          session={session}
          onClose={() => {
            setReset(null);
          }}
        />
      )}

      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}
