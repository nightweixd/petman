import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import CustomerLayout from "@/components/CustomerLayout";
import Icon from "@/components/Icon";
import type { Session } from "@/lib/database";
import {
  customerHome,
  displayDate,
  ringgit,
  type CustomerHome,
} from "@/lib/customer";
type Service = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
};
const steps = ["Package", "Date", "Time", "Details"];
const emptyDetails = {
  name: "",
  phone: "",
  email: "",
  birthday: "",
  petName: "",
  petBirthday: "",
  petType: "Dog",
  consent: false,
};
export default function Book({
  session,
  loading: sessionLoading,
}: {
  session: Session | null;
  loading: boolean;
}) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]),
    [serviceId, setService] = useState(""),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState(""),
    [slots, setSlots] = useState<string[]>([]);
  const [step, setStep] = useState(0),
    [timezone, setTimezone] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState(""),
    [loading, setLoading] = useState(true),
    [slotsLoading, setSlotsLoading] = useState(false),
    [reload, setReload] = useState(0);
  const [home, setHome] = useState<CustomerHome | null>(null),
    [accountLoading, setAccountLoading] = useState(false),
    [accountError, setAccountError] = useState(""),
    [petId, setPet] = useState(""),
    [details, setDetails] = useState(emptyDetails);
  const [limits, setLimits] = useState({ min: "", max: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/public/services", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Unable to load packages. Please try again.");
        return r.json() as Promise<Service[]>;
      })
      .then(setServices)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    setHome(null);
    setAccountError("");
    setPet("");
    if (!session) {
      setAccountLoading(false);
      return;
    }
    setAccountLoading(true);
    customerHome(controller.signal)
      .then((d) => {
        setHome(d);
        setDetails((current) => ({
          ...current,
          name: d.customer?.customer_name ?? session.user.name,
          email: d.member?.email || session.user.email,
          birthday: d.member?.date_of_birth ?? "",
          phone: d.pets[0]?.contact ?? "",
          consent: !!d.member?.marketing_consent,
        }));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setAccountError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountLoading(false);
      });
    return () => controller.abort();
  }, [session?.user.id]);
  useEffect(() => {
    if (!home) return;
    const selected = home.pets.find((p) => p.id === router.query.pet);
    if (selected) {
      setPet(selected.id);
      setDetails((d) => ({
        ...d,
        petName: selected.pet_name,
        petType: ["Dog", "Cat"].includes(selected.pet_type)
          ? selected.pet_type
          : "Other",
        petBirthday: selected.birthday ?? "",
        phone: selected.contact || d.phone,
      }));
    }
  }, [home, router.query.pet]);
  useEffect(() => {
    setSlot("");
    setSlots([]);
    setSlotsLoading(false);
    if (!date) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    fetch("/api/public/slots?date=" + date, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Unable to load times. Try another date or retry.");
        return r.json() as Promise<{ slots: string[]; timezone: string }>;
      })
      .then((d) => {
        setSlots(d.slots);
        setTimezone(d.timezone);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsLoading(false);
      });
    return () => controller.abort();
  }, [date, reload]);
  useEffect(() => {
    const zone = timezone || "Asia/Kuala_Lumpur";
    const day = (d: Date) => {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .formatToParts(d)
          .map((p) => [p.type, p.value]),
      );
      return p.year + "-" + p.month + "-" + p.day;
    };
    setLimits({
      min: day(new Date()),
      max: day(new Date(Date.now() + 90 * 86400000)),
    });
  }, [timezone]);
  function changeStep(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function choosePet(id: string) {
    setPet(id);
    const pet = home?.pets.find((p) => p.id === id);
    setDetails((d) => ({
      ...d,
      petName: pet?.pet_name ?? "",
      petType: pet
        ? ["Dog", "Cat"].includes(pet.pet_type)
          ? pet.pet_type
          : "Other"
        : "Dog",
      petBirthday: pet?.birthday ?? "",
      phone: pet?.contact || d.phone,
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!serviceId || !date || !slot) {
      setError("Choose a package, date and time before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      ...details,
      serviceId,
      date,
      slot,
      ...(petId ? { petId } : {}),
      birthday: details.birthday || undefined,
      petBirthday: details.petBirthday || undefined,
    };
    try {
      const response = await fetch(
        home ? "/api/customer/book" : "/api/public/book",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as { id: string; error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setSlot("");
          setStep(2);
          setReload((n) => n + 1);
        }
        throw new Error(
          result.error || "Unable to send your booking. Please try again.",
        );
      }
      setReference(result.id);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send your request.");
    } finally {
      setBusy(false);
    }
  }
  const service = services.find((s) => s.id === serviceId);
  return (
    <CustomerLayout signedIn={!!session} active="book">
      <Head>
        <title>Book a visit · PetMan</title>
      </Head>
      <main className="pc-content pc-book-content">
        <div className="pc-page-heading">
          <div>
            <p className="pc-eyebrow">Make a little time for them</p>
            <h1>Book their next good hair day.</h1>
            <p>A fresh trim, a little pamper, and a very happy pet.</p>
          </div>
          {home && (
            <Link href="/portal" className="pc-button">
              Back to my account
            </Link>
          )}
        </div>
        {reference ? (
          <section className="pc-card pc-success" role="status">
            <span className="pc-icon-tile">
              <Icon name="check" size={32} />
            </span>
            <h2 ref={heading} tabIndex={-1}>
              Your request is in.
            </h2>
            <p>
              The salon will review it and contact you to confirm your visit.
            </p>
            <div className="pc-success-detail">
              <strong>{service?.name}</strong>
              <p>
                {displayDate(date)} at {slot}
                {timezone ? " · " + timezone : ""}
              </p>
              <p>For {details.petName}</p>
              <small>Booking reference</small>
              <code>{reference}</code>
            </div>
            <p>
              No payment has been collected. Your request is awaiting
              confirmation.
            </p>
            <div className="pc-actions">
              {home && (
                <Link className="pc-button pc-primary" href="/portal">
                  View my bookings
                </Link>
              )}
              <button
                className="pc-button"
                onClick={() => {
                  setReference("");
                  setSlot("");
                  setDate("");
                  setService("");
                  changeStep(0);
                }}
              >
                Book another visit
              </button>
            </div>
          </section>
        ) : (
          <div className="pc-book-grid">
            <section className="pc-card pc-book-form">
              <ol className="pc-steps" aria-label="Booking progress">
                {steps.map((label, i) => (
                  <li
                    key={label}
                    aria-current={step === i ? "step" : undefined}
                  >
                    <button
                      disabled={i > step || busy}
                      onClick={() => changeStep(i)}
                    >
                      <span>
                        {i < step ? <Icon name="check" size={15} /> : i + 1}
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="pc-step-heading">
                <p className="pc-eyebrow">Step {step + 1} of 4</p>
                <h2 ref={heading} tabIndex={-1}>
                  {
                    [
                      "Choose their care",
                      "Find a day that works",
                      "Pick a little pamper time",
                      "A few details, then you’re done",
                    ][step]
                  }
                </h2>
                <p>
                  {
                    [
                      "A package for every kind of fresh start.",
                      "Appointments are available up to 90 days ahead.",
                      "Choose an available one-hour appointment.",
                      "Review your contact details so the salon can confirm your visit.",
                    ][step]
                  }
                </p>
              </div>
              {error && (
                <div className="pc-error" role="alert">
                  {error}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setReload((n) => n + 1);
                    }}
                  >
                    Retry loading
                  </button>
                </div>
              )}
              {step === 0 && (
                <>
                  <div
                    className="pc-packages"
                    role="group"
                    aria-label="Service package"
                  >
                    {loading ? (
                      <p role="status">Loading packages…</p>
                    ) : (
                      services.map((s) => (
                        <button
                          key={s.id}
                          className={
                            "pc-package " +
                            (serviceId === s.id ? "selected" : "")
                          }
                          aria-pressed={serviceId === s.id}
                          onClick={() => setService(s.id)}
                        >
                          <span className="pc-radio" aria-hidden="true" />
                          <span>
                            <strong>{s.name}</strong>
                            <small>
                              {s.description ||
                                "A little extra care for your pet."}
                            </small>
                          </span>
                          <b>{ringgit(s.price_cents / 100)}</b>
                        </button>
                      ))
                    )}
                  </div>
                  {!loading && !services.length && !error && (
                    <div className="pc-empty">
                      <h3>Bookings will open soon</h3>
                      <p>
                        No packages are available right now. Please contact the
                        salon to arrange a visit.
                      </p>
                    </div>
                  )}
                  <div className="pc-actions">
                    <button
                      className="pc-button pc-primary"
                      disabled={!serviceId || loading}
                      onClick={() => changeStep(1)}
                    >
                      Choose a date
                      <Icon name="chevron" size={17} />
                    </button>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <label className="pc-date-label">
                    Appointment date
                    <input
                      type="date"
                      value={date}
                      min={limits.min}
                      max={limits.max}
                      required
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <p className="pc-help">
                    Choose between {displayDate(limits.min || null)} and{" "}
                    {displayDate(limits.max || null)}. Available times appear in
                    the next step.
                  </p>
                  <div className="pc-actions">
                    <button className="pc-button" onClick={() => changeStep(0)}>
                      Back
                    </button>
                    <button
                      className="pc-button pc-primary"
                      disabled={!date || date < limits.min || date > limits.max}
                      onClick={() => changeStep(2)}
                    >
                      Choose a time
                      <Icon name="chevron" size={17} />
                    </button>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <p className="pc-timezone">
                    <Icon name="clock" size={16} />
                    {timezone ? timezone : "Loading salon time…"} ·{" "}
                    {displayDate(date)}
                  </p>
                  <div
                    className="pc-slots"
                    role="group"
                    aria-label="Available times"
                  >
                    {slotsLoading ? (
                      <p role="status">Checking available times…</p>
                    ) : (
                      slots.map((time) => (
                        <button
                          className={slot === time ? "selected" : ""}
                          key={time}
                          aria-pressed={slot === time}
                          onClick={() => setSlot(time)}
                        >
                          {time}
                        </button>
                      ))
                    )}
                  </div>
                  {!slotsLoading && !slots.length && !error && (
                    <div className="pc-empty">
                      <h3>No times left for this day</h3>
                      <p>Try another date to find their next visit.</p>
                      <button
                        className="pc-button"
                        onClick={() => changeStep(1)}
                      >
                        Change date
                      </button>
                    </div>
                  )}
                  <div className="pc-actions">
                    <button className="pc-button" onClick={() => changeStep(1)}>
                      Back
                    </button>
                    <button
                      className="pc-button pc-primary"
                      disabled={!slot || slotsLoading}
                      onClick={() => changeStep(3)}
                    >
                      Your details
                      <Icon name="chevron" size={17} />
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <form className="pc-form" onSubmit={submit}>
                  {accountLoading || sessionLoading ? (
                    <p role="status">Loading account details…</p>
                  ) : home ? (
                    <p className="pc-account-note">
                      <Icon name="check" size={18} />
                      This request will be linked to your customer account.
                    </p>
                  ) : (
                    <p className="pc-account-note">
                      {accountError || "Booking as a guest? No problem."}{" "}
                      {!session && <Link href="/login">Member sign in</Link>}
                    </p>
                  )}
                  {home && home.pets.length > 0 && (
                    <label>
                      Who is coming in?
                      <select
                        value={petId}
                        onChange={(e) => choosePet(e.target.value)}
                      >
                        <option value="">A new pet</option>
                        {home.pets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.pet_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <fieldset disabled={busy}>
                    <legend>Your contact details</legend>
                    <div className="pc-fields">
                      <label>
                        Your name
                        <input
                          required
                          autoComplete="name"
                          maxLength={100}
                          value={details.name}
                          onChange={(e) =>
                            setDetails((d) => ({ ...d, name: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Phone number
                        <input
                          required
                          autoComplete="tel"
                          type="tel"
                          minLength={7}
                          maxLength={30}
                          pattern="[+0-9 ()-]+"
                          value={details.phone}
                          onChange={(e) =>
                            setDetails((d) => ({ ...d, phone: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Email <small>(optional)</small>
                        <input
                          type="email"
                          autoComplete="email"
                          maxLength={254}
                          value={details.email}
                          onChange={(e) =>
                            setDetails((d) => ({ ...d, email: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Your birthday <small>(optional)</small>
                        <input
                          type="date"
                          max={limits.min}
                          value={details.birthday}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              birthday: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                  <fieldset disabled={busy}>
                    <legend>About your pet</legend>
                    <div className="pc-fields">
                      <label>
                        Pet name
                        <input
                          required
                          maxLength={100}
                          readOnly={!!petId}
                          value={details.petName}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              petName: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Pet type
                        <select
                          disabled={!!petId}
                          value={details.petType}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              petType: e.target.value,
                            }))
                          }
                        >
                          <option>Dog</option>
                          <option>Cat</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label>
                        Pet birthday <small>(optional)</small>
                        <input
                          type="date"
                          readOnly={!!petId}
                          max={limits.min}
                          value={details.petBirthday}
                          onChange={(e) =>
                            setDetails((d) => ({
                              ...d,
                              petBirthday: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                  <label className="pc-consent">
                    <input
                      type="checkbox"
                      checked={details.consent}
                      disabled={busy}
                      onChange={(e) =>
                        setDetails((d) => ({ ...d, consent: e.target.checked }))
                      }
                    />
                    <span>
                      I'd like birthday offers and membership promotions.
                      <small>
                        Optional. Contact the salon to withdraw consent.
                        Existing membership preferences are kept until staff
                        update them.
                      </small>
                    </span>
                  </label>
                  <p className="pc-help">
                    We use your details to manage this visit and your membership
                    record. The salon reviews your request before confirming.
                  </p>
                  <div className="pc-actions">
                    <button
                      type="button"
                      className="pc-button"
                      disabled={busy}
                      onClick={() => changeStep(2)}
                    >
                      Back
                    </button>
                    <button
                      className="pc-button pc-primary"
                      disabled={
                        busy ||
                        accountLoading ||
                        sessionLoading ||
                        (!!session && !home)
                      }
                    >
                      {busy ? "Sending request…" : "Request booking"}
                      <Icon name="check" size={17} />
                    </button>
                  </div>
                </form>
              )}
            </section>
            <aside className="pc-book-summary">
              <section className="pc-card">
                <p className="pc-eyebrow">Their next little pamper</p>
                <h2>Your visit</h2>
                <dl>
                  <div>
                    <dt>Package</dt>
                    <dd>{service?.name || "Choose a package"}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{date ? displayDate(date) : "Choose a date"}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{slot || "Choose a time"}</dd>
                  </div>
                  {details.petName && (
                    <div>
                      <dt>Pet</dt>
                      <dd>{details.petName}</dd>
                    </div>
                  )}
                </dl>
                <div className="pc-summary-price">
                  <span>Package price</span>
                  <strong>
                    {service ? ringgit(service.price_cents / 100) : "—"}
                  </strong>
                </div>
                <p>
                  Final charges and eligible membership discounts are confirmed
                  by the salon.
                </p>
                <div className="pc-summary-note">
                  <Icon name="clock" size={19} />
                  <span>
                    Request now. We'll confirm with you.
                    <small>No online payment required.</small>
                  </span>
                </div>
              </section>
              <p className="pc-help">
                Need a different arrangement? Contact the salon directly and
                we'll help you find a time.
              </p>
            </aside>
          </div>
        )}
      </main>
    </CustomerLayout>
  );
}
