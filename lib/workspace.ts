export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/workspace" + path, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal,
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    cents / 100,
  );
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function toCents(raw: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
    throw new Error("Enter a positive amount with at most two decimal places");
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export type Customer = {
  id: string;
  customer_name: string;
  customer_id: string;
  phone: string;
  address: string;
  tags: string;
  pet_count: number;
};
export type Invoice = {
  id: string;
  number: number;
  customer_name: string;
  customer_address: string;
  business_snapshot: string;
  issued_date: string;
  due_date: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  collected_cents: number;
  status: string;
  notes: string;
};
export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_cents: number;
};
export type Payment = {
  id: string;
  kind: string;
  amount_cents: number;
  method: string;
  reference: string;
  received_date: string;
};
export const invoiceNumber = (n: number) => "INV-" + String(n).padStart(6, "0");
