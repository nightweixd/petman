import { useEffect, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import CustomerLayout from "@/components/CustomerLayout";
import Icon from "@/components/Icon";
import CustomerLogin from "./login";
import { signOut, type Session } from "@/lib/database";
import {
  customerHome,
  displayDate,
  ringgit,
  type CustomerHome,
} from "@/lib/customer";

export default function CustomerPortal({
  session,
  loading: sessionLoading = false,
}: {
  session: Session | null;
  loading?: boolean;
}) {
  const [data, setData] = useState<CustomerHome | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"overview" | "bookings" | "visits">(
      "overview",
    ),
    [petId, setPet] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    if (!session) return;
    const controller = new AbortController();
    setBusy(true);
    customerHome(controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [session?.user.id, attempt]);
  if (!session && !sessionLoading)
    return <CustomerLogin session={null} loading={false} />;
  const spend = data?.totals.spend ?? 0;
  const tier = data?.tiers.filter((t) => spend >= t.min_spend).at(-1);
  const nextTier = data?.tiers.find((t) => t.min_spend > spend);
  const visits = data?.visits.filter((v) => !petId || v.pet_id === petId) ?? [];
  const upcoming =
    data?.bookings
      .filter((b) => ["pending", "confirmed"].includes(b.status))
      .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)) ?? [];
  async function leave() {
    try {
      await signOut();
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }
  return (
    <CustomerLayout signedIn={!!session} active="portal">
      <Head>
        <title>My account · PetMan</title>
      </Head>
      <main className="pc-content">
        <div className="pc-page-heading">
          <div>
            <p className="pc-eyebrow">Your customer account</p>
            <h1>
              Hello,{" "}
              {data?.customer?.customer_name || session?.user.name || "there"}.
            </h1>
            <p>A little overview of your pet's care, all in one place.</p>
          </div>
          <button className="pc-button" onClick={leave}>
            <Icon name="logout" size={17} />
            Sign out
          </button>
        </div>
        {error && (
          <div className="pc-error" role="alert">
            {error}{" "}
            <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </div>
        )}
        {sessionLoading || busy ? (
          <div className="pc-empty" role="status">
            Loading your account…
          </div>
        ) : (
          data && (
            <>
              <section className="pc-welcome">
                <div>
                  <span className="pc-icon-tile">
                    <Icon name="paw" size={27} />
                  </span>
                  <h2>Ready for their next fresh start?</h2>
                  <p>
                    Pick their favourite package. We'll take care of the rest.
                  </p>
                </div>
                <Link href="/book" className="pc-button pc-primary">
                  <Icon name="calendar" size={18} />
                  Book a visit
                </Link>
              </section>
              <nav className="pc-tabs" aria-label="Account sections">
                {(["overview", "bookings", "visits"] as const).map((t) => (
                  <button
                    key={t}
                    aria-current={tab === t ? "page" : undefined}
                    onClick={() => setTab(t)}
                  >
                    {t === "overview"
                      ? "Overview"
                      : t === "bookings"
                        ? "My bookings (" + data.bookings.length + ")"
                        : "Visit history"}
                  </button>
                ))}
                <button
                  className="pc-refresh"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Refresh
                </button>
              </nav>
              <div className="pc-portal-grid">
                <div>
                  {tab === "overview" && (
                    <section className="pc-card">
                      <div className="pc-section-heading">
                        <h2>My pets</h2>
                        <span>{data.pets.length} on record</span>
                      </div>
                      {data.pets.length ? (
                        <div className="pc-pet-grid">
                          {data.pets.map((p) => (
                            <div className="pc-pet" key={p.id}>
                              <span className="pc-icon-tile">
                                <Icon name="paw" size={24} />
                              </span>
                              <h3>{p.pet_name}</h3>
                              <p>
                                {[p.pet_type, p.breed]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <small>
                                {
                                  data.visits.filter((v) => v.pet_id === p.id)
                                    .length
                                }{" "}
                                recorded visits
                                {p.birthday
                                  ? " · Born " + displayDate(p.birthday)
                                  : ""}
                              </small>
                              <Link
                                href={{
                                  pathname: "/book",
                                  query: { pet: p.id },
                                }}
                              >
                                Book for {p.pet_name}
                                <Icon name="chevron" size={15} />
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pc-empty">
                          <Icon name="paw" size={30} />
                          <h3>Their story starts here</h3>
                          <p>
                            No pets on record yet. Add their details when you
                            book your first visit.
                          </p>
                          <Link href="/book" className="pc-button">
                            Book a visit
                          </Link>
                        </div>
                      )}
                    </section>
                  )}
                  {(tab === "overview" || tab === "bookings") && (
                    <section className="pc-card">
                      <div className="pc-section-heading">
                        <h2>
                          {tab === "overview" ? "Next visits" : "My bookings"}
                        </h2>
                        <span>Salon's local time</span>
                      </div>
                      {(tab === "overview" ? upcoming : data.bookings)
                        .length ? (
                        <div className="pc-records">
                          {(tab === "overview" ? upcoming : data.bookings).map(
                            (b) => (
                              <article className="pc-record" key={b.id}>
                                <span className="pc-icon-tile">
                                  <Icon name="calendar" />
                                </span>
                                <div>
                                  <h3>{b.service_name}</h3>
                                  <p>
                                    {b.pet_name} · {displayDate(b.date)} at{" "}
                                    {b.slot}
                                  </p>
                                  <small>
                                    Ref: {b.id.slice(0, 8).toUpperCase()}
                                  </small>
                                </div>
                                <div className="pc-record-end">
                                  <span className={"pc-status " + b.status}>
                                    {b.status === "pending"
                                      ? "Awaiting confirmation"
                                      : b.status}
                                  </span>
                                  <strong>
                                    {ringgit(b.price_cents / 100)}
                                  </strong>
                                </div>
                              </article>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="pc-empty">
                          <Icon name="calendar" size={30} />
                          <h3>No bookings here yet</h3>
                          <p>
                            Your account bookings will appear here once you send
                            a request.
                          </p>
                          <Link href="/book" className="pc-button">
                            Choose a visit
                          </Link>
                        </div>
                      )}
                      <p className="pc-card-note">
                        Need to change a booking? Contact the salon. Pending
                        requests need staff confirmation.
                      </p>
                    </section>
                  )}
                  {tab === "visits" && (
                    <section className="pc-card">
                      <div className="pc-section-heading">
                        <h2>Visit history</h2>
                        <label className="pc-sr-only" htmlFor="visit-pet">
                          Filter visits by pet
                        </label>
                        <select
                          id="visit-pet"
                          value={petId}
                          onChange={(e) => setPet(e.target.value)}
                        >
                          <option value="">All pets</option>
                          {data.pets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.pet_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {visits.length ? (
                        <div className="pc-records">
                          {visits.map((v) => (
                            <article className="pc-record" key={v.id}>
                              <span className="pc-icon-tile">
                                <Icon name="paw" />
                              </span>
                              <div>
                                <h3>{v.type || "Salon visit"}</h3>
                                <p>
                                  {v.pet_name} · {displayDate(v.date)}
                                </p>
                                {v.groomer && <small>With {v.groomer}</small>}
                              </div>
                              <strong className="pc-record-end">
                                {v.price == null ? "—" : ringgit(v.price)}
                              </strong>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="pc-empty">
                          <h3>No visits recorded yet</h3>
                          <p>
                            Completed visits will appear here after the salon
                            records them.
                          </p>
                        </div>
                      )}
                    </section>
                  )}
                </div>
                <aside>
                  <section className="pc-card pc-membership">
                    <Icon name="award" size={28} />
                    <p className="pc-eyebrow">Your membership</p>
                    <h2>{tier?.name || "Welcome to PetMan"}</h2>
                    <p>
                      {tier?.perks ||
                        "Every visit adds to your pet’s care story."}
                    </p>
                    <dl>
                      <div>
                        <dt>Recorded spending</dt>
                        <dd>{ringgit(spend)}</dd>
                      </div>
                      <div>
                        <dt>Visits</dt>
                        <dd>{data.totals.visits}</dd>
                      </div>
                      {tier && (
                        <div>
                          <dt>Member discount</dt>
                          <dd>{tier.discount_pct}%</dd>
                        </div>
                      )}
                    </dl>
                    {nextTier && (
                      <p className="pc-tier-progress">
                        {ringgit(Math.max(0, nextTier.min_spend - spend))} to{" "}
                        {nextTier.name}
                      </p>
                    )}
                    <small>
                      Ask the salon about eligible perks. Discounts are applied
                      by staff.
                    </small>
                  </section>
                  <section className="pc-card pc-help-card">
                    <Icon name="help" size={22} />
                    <h3>We're here to help</h3>
                    <p>
                      For appointment changes, profile updates, or birthday
                      offers, contact your salon directly.
                    </p>
                    <p>
                      Guest requests from before your account was linked may
                      need staff to match them to your record.
                    </p>
                  </section>
                </aside>
              </div>
            </>
          )
        )}
      </main>
    </CustomerLayout>
  );
}
