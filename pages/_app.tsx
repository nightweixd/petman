import "@/pages/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { database } from "@/lib/database";
import type { Session } from "@/lib/database";

export default function App({ Component, pageProps }: AppProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <Component {...pageProps} session={session} loading={loading} />
    </>
  );
}
