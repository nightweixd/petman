import { useEffect, useState } from "react";
type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: number;
};
async function request(path: string, body?: unknown) {
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
export default function Staff() {
  const [users, setUsers] = useState<User[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    request("/api/admin/users")
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <main className="min-h-screen bg-teal-50 p-4 sm:p-8">
      <section className="max-w-3xl mx-auto space-y-6">
        <a className="text-teal-800 underline" href="/">
          Back to PetMan
        </a>
        <h1 className="text-3xl font-bold">Users & permissions</h1>
        <p className="text-stone-700">
          Admins manage the salon. Customer accounts can view only their linked
          records. Create customer logins from Customer Accounts in PetMan.
        </p>
        <p role="alert" className="text-red-700">
          {error}
        </p>
        <div className="space-y-3">
          {users.map((u) => (
            <article
              key={u.id}
              className="bg-white border rounded-xl p-5 flex flex-wrap gap-4 items-center justify-between"
            >
              <div>
                <h2 className="font-bold">{u.full_name}</h2>
                <p>{u.email}</p>
                <p className="text-sm text-stone-600">
                  {u.role} · {u.is_active ? "Active" : "Disabled"}
                </p>
              </div>
              <button
                disabled={busy}
                className="border rounded-lg px-4 py-3 hover:bg-stone-100 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await request("/api/admin/toggle-user", {
                      userId: u.id,
                      active: !u.is_active,
                    });
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Update failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {u.is_active ? "Disable" : "Enable"}
              </button>
            </article>
          ))}
        </div>
        <form
          className="bg-white border rounded-xl p-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            try {
              await request(
                "/api/admin/create-staff",
                Object.fromEntries(new FormData(form)),
              );
              form.reset();
              await load();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Account creation failed",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="text-xl font-bold">Add administrator</h2>
          <p className="text-sm text-stone-600">
            This account will have full access. Give the initial password to the
            staff member through a private channel.
          </p>
          {[
            ["name", "Name", "text"],
            ["email", "Email", "email"],
            ["password", "Initial password (12+ characters)", "password"],
          ].map(([name, label, type]) => (
            <label key={name} className="block">
              {label}
              <input
                name={name}
                type={type}
                required
                minLength={name === "password" ? 12 : undefined}
                autoComplete={name === "password" ? "new-password" : name}
                className="block w-full p-3 border border-stone-300 rounded-lg mt-1"
              />
            </label>
          ))}
          <button
            disabled={busy}
            className="bg-teal-700 text-white px-5 py-3 rounded-lg disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create administrator"}
          </button>
        </form>
        <PasswordForm />
      </section>
    </main>
  );
}
function PasswordForm() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="bg-white border rounded-xl p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        setBusy(true);
        try {
          await request("/api/auth/change-password", {
            ...Object.fromEntries(new FormData(f)),
            revokeOtherSessions: true,
          });
          setMessage("Password changed.");
          f.reset();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Password change failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">Change your password</h2>
      {[
        ["currentPassword", "Current password"],
        ["newPassword", "New password (12+ characters)"],
      ].map(([name, label]) => (
        <label key={name} className="block">
          {label}
          <input
            name={name}
            required
            type="password"
            minLength={name === "newPassword" ? 12 : undefined}
            autoComplete={
              name === "newPassword" ? "new-password" : "current-password"
            }
            className="block w-full p-3 border rounded-lg"
          />
        </label>
      ))}
      <p role="status">{message}</p>
      <button disabled={busy} className="border rounded-lg px-5 py-3">
        Change password
      </button>
    </form>
  );
}
