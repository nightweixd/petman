import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Drawer from "@/components/Drawer";
import { Empty, ErrorMessage, Field, Heading } from "@/components/Operations";
import {
  api,
  money,
  today,
  toCents,
  invoiceNumber,
  type Customer,
  type Invoice,
  type InvoiceItem,
  type Payment,
} from "@/lib/workspace";
type Detail = { invoice: Invoice; items: InvoiceItem[]; payments: Payment[] };
type Draft = {
  key: string;
  description: string;
  quantity: number;
  price: string;
};
export default function Invoices() {
  const router = useRouter();
  const [rows, setRows] = useState<Invoice[]>([]),
    [offset, setOffset] = useState(0),
    [detail, setDetail] = useState<Detail | null>(null),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [month, setMonth] = useState(() => today().slice(0, 7)),
    [stats, setStats] = useState<Record<string, number>>({});
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        api<Invoice[]>("/invoices?offset=" + offset),
        api<Record<string, number>>("/finance?month=" + month),
      ]);
      setRows(list);
      setStats(summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offset, month]);
  const open = useCallback(async (id: string) => {
    try {
      setDetail(await api<Detail>("/invoices/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (typeof router.query.id === "string") void open(router.query.id);
  }, [router.query.id, open]);
  const refresh = async () => {
    await load();
    if (detail) await open(detail.invoice.id);
  };
  return (
    <div className="ops-workspace">
      <section className="pm-table-card">
        <Heading
          title="Invoices & payments"
          description="Create invoices, record collections and track outstanding balances."
        >
          <button
            className="pm-button pm-primary"
            onClick={() => setCreating(true)}
          >
            New invoice
          </button>
        </Heading>
        <ErrorMessage error={error} />
        <div className="ops-filter">
          <Field label="Reporting month">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        </div>
        <div className="ops-metrics">
          {[
            ["Invoiced sales", stats.sales_cents],
            ["Net collected", stats.collected_cents],
            ["Outstanding on month’s invoices", stats.outstanding_cents],
            ["Refunds", stats.refund_cents],
          ].map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{money(Number(value ?? 0))}</strong>
            </div>
          ))}
        </div>
        <div className="pm-table-scroll">
          <table className="pm-data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Issued / due</th>
                <th>Total</th>
                <th>Collected</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((i) => (
                <tr key={i.id}>
                  <td>
                    <button
                      className="pm-text-button"
                      onClick={() => void open(i.id)}
                    >
                      {invoiceNumber(i.number)}
                    </button>
                  </td>
                  <td>{i.customer_name}</td>
                  <td>
                    {i.issued_date}
                    <small className="ops-muted">Due {i.due_date}</small>
                  </td>
                  <td>{money(i.total_cents)}</td>
                  <td>{money(i.collected_cents)}</td>
                  <td>
                    {i.status === "void"
                      ? "—"
                      : money(i.total_cents - i.collected_cents)}
                  </td>
                  <td>
                    {i.status === "void"
                      ? "Void"
                      : i.collected_cents >= i.total_cents
                        ? "Paid"
                        : i.collected_cents
                          ? "Part paid"
                          : i.due_date < today()
                            ? "Overdue"
                            : "Unpaid"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty>
            {loading
              ? "Loading invoices…"
              : "No invoices yet. Create your first invoice."}
          </Empty>
        )}
        <div className="pm-table-footer">
          <button
            className="pm-button"
            disabled={!offset || loading}
            onClick={() => setOffset((n) => Math.max(0, n - 25))}
          >
            Previous
          </button>
          <span>Page {offset / 25 + 1}</span>
          <button
            className="pm-button"
            disabled={rows.length <= 25 || loading}
            onClick={() => setOffset((n) => n + 25)}
          >
            Next
          </button>
        </div>
      </section>
      {creating && (
        <InvoiceForm
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await load();
            await open(id);
          }}
        />
      )}
      {detail && (
        <Drawer
          title={invoiceNumber(detail.invoice.number)}
          eyebrow="Invoice"
          onClose={() => setDetail(null)}
        >
          <div className="ops-actions ops-no-print">
            <button className="pm-button" onClick={() => window.print()}>
              Print / Save PDF
            </button>
            {detail.invoice.status === "issued" && !detail.payments.length && (
              <button
                className="pm-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/invoices/" + detail.invoice.id + "/void", {});
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Void invoice
              </button>
            )}
          </div>
          <InvoiceDocument detail={detail} />
          {detail.invoice.status === "issued" && (
            <PaymentForm detail={detail} onSaved={refresh} />
          )}
        </Drawer>
      )}
    </div>
  );
}
function InvoiceForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]),
    [search, setSearch] = useState(""),
    [customer, setCustomer] = useState<Customer | null>(null),
    [lines, setLines] = useState<Draft[]>(() => [
      { key: crypto.randomUUID(), description: "", quantity: 1, price: "0.00" },
    ]),
    [discount, setDiscount] = useState("0.00"),
    [tax, setTax] = useState("0.00"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<{ rows: Customer[] }>(
        "/customers?search=" + encodeURIComponent(search),
        undefined,
        controller.signal,
      )
        .then((d) => setCustomers(d.rows))
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  let total = 0;
  try {
    total =
      lines.reduce((s, i) => s + i.quantity * toCents(i.price), 0) -
      toCents(discount) +
      toCents(tax);
  } catch {}
  return (
    <Drawer title="New invoice" eyebrow="Billing" onClose={onClose}>
      <form
        className="ops-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!customer) {
            setError("Choose a customer");
            return;
          }
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const result = await api<{ id: string }>("/invoices", {
              customerId: customer.id,
              issuedDate: f.get("issuedDate"),
              dueDate: f.get("dueDate"),
              notes: f.get("notes"),
              discountCents: toCents(discount),
              taxCents: toCents(tax),
              items: lines.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitCents: toCents(i.price),
              })),
            });
            await onCreated(result.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorMessage error={error} />
        <Field label="Find customer">
          <input
            value={search}
            placeholder="Name, phone or customer reference"
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Bill to">
          <select
            required
            value={customer?.id ?? ""}
            onChange={(e) =>
              setCustomer(
                customers.find((c) => c.id === e.target.value) ?? null,
              )
            }
          >
            <option value="">Choose customer</option>
            {customer && !customers.some((c) => c.id === customer.id) && (
              <option value={customer.id}>{customer.customer_name}</option>
            )}
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.customer_name} · {c.customer_id}
              </option>
            ))}
          </select>
        </Field>
        <div className="ops-grid">
          <Field label="Issue date">
            <input
              required
              type="date"
              name="issuedDate"
              defaultValue={today()}
            />
          </Field>
          <Field label="Due date">
            <input required type="date" name="dueDate" defaultValue={today()} />
          </Field>
        </div>
        <h3>Line items</h3>
        {lines.map((line, index) => (
          <div className="ops-line" key={line.key}>
            <Field label={"Description " + (index + 1)}>
              <input
                required
                maxLength={300}
                value={line.description}
                onChange={(e) =>
                  setLines((l) =>
                    l.map((i) =>
                      i.key === line.key
                        ? { ...i, description: e.target.value }
                        : i,
                    ),
                  )
                }
              />
            </Field>
            <div className="ops-grid">
              <Field label="Quantity">
                <input
                  required
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((l) =>
                      l.map((i) =>
                        i.key === line.key
                          ? { ...i, quantity: Number(e.target.value) }
                          : i,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Unit price (RM)">
                <input
                  required
                  inputMode="decimal"
                  value={line.price}
                  onChange={(e) =>
                    setLines((l) =>
                      l.map((i) =>
                        i.key === line.key
                          ? { ...i, price: e.target.value }
                          : i,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <button
              type="button"
              className="pm-text-button"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((l) => l.filter((i) => i.key !== line.key))
              }
            >
              Remove item {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="pm-button"
          disabled={lines.length >= 50}
          onClick={() =>
            setLines((l) => [
              ...l,
              {
                key: crypto.randomUUID(),
                description: "",
                quantity: 1,
                price: "0.00",
              },
            ])
          }
        >
          Add line item
        </button>
        <div className="ops-grid">
          <Field label="Discount (RM)">
            <input
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </Field>
          <Field label="Tax amount, if applicable (RM)">
            <input
              inputMode="decimal"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea name="notes" maxLength={2000} />
        </Field>
        <strong>Total: {money(total)}</strong>
        <p className="ops-muted">
          Issued invoices keep a snapshot of the customer and business details.
          Set your business details in Salon settings before issuing.
        </p>
        <button className="pm-button pm-primary" disabled={busy}>
          {busy ? "Creating…" : "Issue invoice"}
        </button>
      </form>
    </Drawer>
  );
}
function InvoiceDocument({ detail }: { detail: Detail }) {
  const { invoice: i, items, payments } = detail;
  const b = JSON.parse(i.business_snapshot) as Record<string, string>;
  return (
    <article className="ops-invoice" id="invoice-document">
      <div className="ops-invoice-heading">
        <div>
          <h2>{b.business_name}</h2>
          <p className="ops-pre">{b.address}</p>
          <p>
            {b.phone} {b.email}
          </p>
        </div>
        <div>
          <h2>INVOICE</h2>
          <strong>{invoiceNumber(i.number)}</strong>
          <p>
            {i.status === "void"
              ? "VOID"
              : i.collected_cents >= i.total_cents
                ? "PAID"
                : "PAYMENT DUE"}
          </p>
        </div>
      </div>
      <div className="ops-grid">
        <div>
          <small>Bill to</small>
          <h3>{i.customer_name}</h3>
          <p className="ops-pre">{i.customer_address}</p>
        </div>
        <div>
          <p>Issued: {i.issued_date}</p>
          <p>Due: {i.due_date}</p>
          <p>Currency: MYR</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td>{l.quantity}</td>
              <td>{money(l.unit_cents)}</td>
              <td>{money(l.unit_cents * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ops-totals">
        {[
          ["Subtotal", i.subtotal_cents],
          ["Discount", -i.discount_cents],
          ["Tax", i.tax_cents],
          ["Total", i.total_cents],
          ["Net collected", i.collected_cents],
          [
            "Balance",
            i.status === "void" ? 0 : i.total_cents - i.collected_cents,
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{money(Number(v))}</dd>
          </div>
        ))}
      </dl>
      <p className="ops-pre">{i.notes}</p>
      <p className="ops-muted ops-pre">{b.invoice_footer}</p>
      <h3>Payment history</h3>
      {payments.length ? (
        <ul>
          {payments.map((p) => (
            <li key={p.id}>
              {p.received_date} · {p.kind} · {money(p.amount_cents)} ·{" "}
              {p.method.replaceAll("_", " ")} {p.reference}
            </li>
          ))}
        </ul>
      ) : (
        <p>No payments recorded.</p>
      )}
    </article>
  );
}
function PaymentForm({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <form
      className="ops-form ops-no-print"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget,
          f = new FormData(form);
        try {
          await api("/payments", {
            id: requestId,
            invoiceId: detail.invoice.id,
            kind: f.get("kind"),
            amountCents: toCents(String(f.get("amount"))),
            method: f.get("method"),
            reference: f.get("reference"),
            receivedDate: f.get("date"),
          });
          setRequestId(crypto.randomUUID());
          form.reset();
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Record payment or refund</h3>
      <ErrorMessage error={error} />
      <div className="ops-grid">
        <Field label="Transaction">
          <select name="kind">
            <option value="payment">Payment received</option>
            <option value="refund">Refund paid</option>
          </select>
        </Field>
        <Field label="Amount (RM)">
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
          />
        </Field>
        <Field label="Method">
          <select name="method">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Date">
          <input required name="date" type="date" defaultValue={today()} />
        </Field>
      </div>
      <Field label="Reference / receipt number">
        <input name="reference" maxLength={200} />
      </Field>
      <p className="ops-muted">
        This records a transaction already made. It does not charge a card or
        transfer funds.
      </p>
      <button className="pm-button pm-primary" disabled={busy}>
        {busy ? "Saving…" : "Record transaction"}
      </button>
    </form>
  );
}
