export type CustomerPet = {
  id: string;
  pet_name: string;
  pet_type: string;
  breed: string | null;
  birthday: string | null;
  contact: string | null;
};
export type CustomerVisit = {
  id: string;
  pet_id: string;
  pet_name: string;
  date: string | null;
  type: string | null;
  groomer: string | null;
  price: number | null;
};
export type CustomerBooking = {
  id: string;
  service_name: string;
  price_cents: number;
  date: string;
  slot: string;
  status: string;
  pet_name: string;
};
export type CustomerHome = {
  customer: { customer_name: string } | null;
  pets: CustomerPet[];
  visits: CustomerVisit[];
  member: {
    email: string;
    date_of_birth: string | null;
    marketing_consent: boolean;
  } | null;
  tiers: {
    id: string;
    name: string;
    min_spend: number;
    discount_pct: number;
    perks: string;
  }[];
  bookings: CustomerBooking[];
  totals: { spend: number; visits: number };
};
export async function customerHome(
  signal?: AbortSignal,
): Promise<CustomerHome> {
  const response = await fetch("/api/customer/home", { signal });
  const data = (await response.json()) as CustomerHome & { error?: string };
  if (!response.ok)
    throw new Error(
      data.error || "Unable to load your account. Please try again.",
    );
  return data;
}
export const ringgit = (amount: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    amount,
  );
export function displayDate(date: string | null) {
  return date
    ? new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date not recorded";
}
