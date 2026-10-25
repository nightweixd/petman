import "@/pages/globals.css";
import "@fontsource-variable/manrope";
import "@/styles/admin.css";
import "@/styles/customer.css";
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
  const [view, setView] = useState("list");
  const router = useRouter();
  useEffect(() => {
    let current = true;
    setRole(null);
    if (session)
      void database
        .from("user_profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (current) setRole(data?.role ?? null);
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
          <AdminShell session={session}>
            <Component {...pageProps} session={session} loading={loading} />
          </AdminShell>
        ) : (
          <Component {...pageProps} session={session} loading={loading} />
        )}
      </AdminNavigation.Provider>
    </>
  );
}
