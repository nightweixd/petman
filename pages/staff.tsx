import Drawer from "@/components/Drawer";
import Icon from "@/components/Icon";
import { useEffect, useState } from "react";
type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  staff_role: string;
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

  const [creating, setCreating] = useState(false);
  return (
    <div className="pm-staff-page">
      <section className="pm-table-card">
        <div className="pm-table-toolbar">
          <div>
            <h2>
              Team & customer access <span>{users.length}</span>
            </h2>
            <p>Manage who can sign in and access salon records.</p>
          </div>
          <button
            className="pm-button pm-primary"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={16} />
            Add staff member
          </button>
        </div>
        {error && (
          <p role="alert" className="pm-inline-error">
            {error}
          </p>
        )}
        <div className="pm-table-scroll">
          <table className="pm-data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="pm-right">Account access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="pm-customer-name">
                      <span className="pm-avatar">
                        {u.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <strong>{u.full_name}</strong>
                        <small>{u.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{u.role === "admin" ? u.staff_role : "Customer"}</td>
                  <td>
                    <span
                      className={
                        "pm-status " + (u.is_active ? "member" : "neutral")
                      }
                    >
                      <i />
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="pm-right">
                    <button
                      disabled={busy}
                      className="pm-button"
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
                          setError(
                            e instanceof Error ? e.message : "Update failed",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {u.is_active ? "Disable account" : "Enable account"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pm-table-footer">
          <span>
            Owners manage the system. Receptionists manage customer care and
            invoices. Groomers use the day board.
          </span>
          <a className="pm-text-button" href="/?section=accounts">
            Create customer login
          </a>
        </div>
      </section>
      <div className="pm-password-section">
        <PasswordForm />
      </div>
      {creating && (
        <Drawer
          title="New staff member"
          eyebrow="Users & permissions"
          onClose={() => setCreating(false)}
        >
          <form
            className="pm-drawer-form"
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
                setCreating(false);
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
            <p>
              Choose the access this person needs. Share the initial password
              privately.
            </p>
            <label>
              Staff role
              <select name="staffRole" defaultValue="receptionist">
                <option value="receptionist">
                  Receptionist · customers, bookings and invoices
                </option>
                <option value="groomer">Groomer · day board</option>
                <option value="owner">Owner · full access</option>
              </select>
            </label>
            {[
              ["name", "Full name", "text"],
              ["email", "Email address", "email"],
              ["password", "Initial password", "password"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type={type}
                  required
                  minLength={name === "password" ? 12 : undefined}
                  autoComplete={name === "password" ? "new-password" : name}
                />
                {name === "password" && <small>At least 12 characters.</small>}
              </label>
            ))}
            {error && (
              <p role="alert" className="pm-inline-error">
                {error}
              </p>
            )}
            <div className="pm-drawer-actions">
              <button
                type="button"
                className="pm-button"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button disabled={busy} className="pm-button pm-primary">
                {busy ? "Creating…" : "Create administrator"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
export function PasswordForm() {
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
