import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import CustomerLayout from "@/components/CustomerLayout";
import Icon from "@/components/Icon";
import PetIllustration from "@/components/PetIllustration";
import { signIn, type Session } from "@/lib/database";

export default function CustomerLogin({
  session,
  loading,
}: {
  session: Session | null;
  loading: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  useEffect(() => {
    if (session) void router.replace("/portal");
  }, [session, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await signIn(
        String(form.get("email")).trim(),
        String(form.get("password")),
      );
      if (error)
        throw new Error(
          error.message || "Check your email and password and try again.",
        );
      await router.replace("/portal");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <CustomerLayout active="login">
      <Head>
        <title>Member sign in · PetMan</title>
      </Head>
      <main className="pc-login-grid">
        <section className="pc-login-story">
          <PetIllustration className="pc-login-pet" />
          <p className="pc-eyebrow">Your pet's little corner</p>
          <h1>
            Good care starts
            <br />
            with staying connected.
          </h1>
          <p>
            Keep up with your pet's visits, check your membership, and make time
            for their next little pamper.
          </p>
          <div className="pc-story-list">
            <div>
              <Icon name="calendar" />
              <span>
                Book their next visit
                <small>Choose a package and a time that suits you.</small>
              </span>
            </div>
            <div>
              <Icon name="paw" />
              <span>
                Their story, in one place
                <small>
                  Pet profiles and past visits, whenever you need them.
                </small>
              </span>
            </div>
            <div>
              <Icon name="award" />
              <span>
                A membership that grows with you
                <small>Keep track of your visits and membership perks.</small>
              </span>
            </div>
          </div>
          <p className="pc-story-note">
            A familiar face. A fresh trim. A happy pet.
          </p>
        </section>
        <section className="pc-login-form">
          <div className="pc-icon-tile">
            <Icon name="lock" size={24} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to your customer account.</p>
          <form onSubmit={submit} className="pc-form">
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@example.com"
                maxLength={254}
              />
            </label>
            <label htmlFor="member-password">Password</label>
            <div className="pc-password">
              <input
                id="member-password"
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-pressed={show}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {error && (
              <p className="pc-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="pc-button pc-primary"
              disabled={busy || loading || !!session}
            >
              {busy
                ? "Signing in…"
                : loading
                  ? "Checking your session…"
                  : "Sign in"}
            </button>
          </form>
          <p className="pc-help">
            Need an account or a password reset? Contact the salon and we'll
            help you get connected.
          </p>
          <div className="pc-login-book">
            <strong>Just here to book?</strong>
            <p>You can request a visit without an account.</p>
            <Link href="/book" className="pc-button">
              Book a visit <Icon name="chevron" size={16} />
            </Link>
          </div>
        </section>
      </main>
    </CustomerLayout>
  );
}
