import { useState } from "react";
export default function Setup() {
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="pm-login pm-setup">
      <section className="pm-login-card">
        <h1 className="text-2xl font-bold mb-3">Set up PetMan</h1>
        <p className="text-stone-600 mb-6">
          Create the first administrator. Setup is available once and requires
          your private setup token.
        </p>
        {done ? (
          <p>
            Administrator created.{" "}
            <a href="/" className="underline text-teal-700">
              Go to sign in
            </a>
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const body = Object.fromEntries(new FormData(e.currentTarget));
              try {
                const r = await fetch("/api/setup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const d = (await r.json()) as any;
                if (!r.ok) throw new Error(d.error);
                setDone(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Setup failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {[
              ["token", "Setup token", "password"],
              ["name", "Your name", "text"],
              ["email", "Email", "email"],
              ["password", "Password (at least 12 characters)", "password"],
            ].map(([name, label, type]) => (
              <label key={name} className="block font-medium">
                {label}
                <input
                  name={name}
                  type={type}
                  required
                  minLength={name === "password" ? 12 : undefined}
                  autoComplete={
                    name === "password"
                      ? "new-password"
                      : name === "token"
                        ? "off"
                        : name
                  }
                  className="mt-1 border border-stone-300 rounded-lg p-3 w-full"
                />
              </label>
            ))}
            <p role="alert" className="text-red-700">
              {error}
            </p>
            <button
              disabled={busy}
              className="w-full p-3 rounded-lg bg-teal-700 text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create administrator"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
