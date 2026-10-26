import "@/pages/globals.css";
import "@fontsource-variable/manrope";
import "@/styles/admin.css";
import "@/styles/operations.css";
import "@/styles/customer.css";
import "@/styles/theme.css";
import AdminShell, { AdminNavigation } from "@/components/AdminShell";
import { useRouter } from "next/router";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { database } from "@/lib/database";
import type { Session } from "@/lib/database";

export default function App({ Component, pageProps }: AppProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState("owner");
  const [view, setView] = useState("list");
  const router = useRouter();
  useEffect(() => {
    let current = true;
    setRole(null);
    if (session)
      void database
        .from("user_profiles")
        .select("role,staff_role")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (current) {
            setRole(data?.role ?? null);
            setStaffRole(data?.staff_role ?? "owner");
          }
        });
    return () => {
      current = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    database.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to check your session. Please reload.");
        setLoading(false);
      });

    const {
      data: { subscription },
    } = database.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const show = (event: Event) =>
      setError((event as CustomEvent<string>).detail);
    window.addEventListener("petman-error", show);
    return () => window.removeEventListener("petman-error", show);
  }, []);
  const publicPage = ["/", "/book", "/setup", "/login", "/portal"].includes(
    router.pathname,
  );
  if (!publicPage && (loading || (session && !role)))
    return <p className="ops-empty">Checking your session…</p>;
  if (!publicPage && !session)
    return (
      <main className="ops-pad">
        <h1>Sign in required</h1>
        <a href="/">Sign in to PetMan</a>
      </main>
    );
  if (
    session &&
    role === "admin" &&
    staffRole === "groomer" &&
    !["/today", "/account"].includes(router.pathname)
  )
    return (
      <main className="ops-pad">
        <a href="/today">Open your appointment board</a>
      </main>
    );
  if (
    session &&
    role === "admin" &&
    staffRole === "receptionist" &&
    ["/schedule", "/staff"].includes(router.pathname)
  )
    return (
      <main className="ops-pad">
        <p>Owner access required.</p>
        <a href="/today">Appointment board</a>
      </main>
    );
  return (
    <>
      {error && (
        <div
          role="alert"
          className="sticky top-0 z-[100] bg-red-50 text-red-900 border-b border-red-200 p-4 flex justify-between gap-4"
        >
          {error}
          <button onClick={() => setError("")} className="underline">
            Dismiss
          </button>
        </div>
      )}
      <AdminNavigation.Provider value={{ view, setView }}>
        {session &&
        role === "admin" &&
        !["/book", "/setup", "/login", "/portal"].includes(router.pathname) ? (
          <AdminShell session={session} staffRole={staffRole}>
            <Component
              {...pageProps}
              session={session}
              loading={loading}
              accountRole={role}
            />
          </AdminShell>
        ) : (
          <Component
            {...pageProps}
            session={session}
            loading={loading}
            accountRole={role}
          />
        )}
      </AdminNavigation.Provider>
    </>
  );
}
