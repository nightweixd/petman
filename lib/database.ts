import { createAuthClient } from "better-auth/react";
export type Session = {
  user: { id: string; name: string; email: string };
  session: { id: string; expiresAt: Date };
};
const authClient = createAuthClient();
const listeners = new Set<(event: string, session: Session | null) => void>();
async function readSession(): Promise<Session | null> {
  const { data, error } = await authClient.getSession();
  if (error) throw new Error(error.message ?? "Unable to check session");
  return data as Session | null;
}
// Compatibility bridge for the existing screens. All queries are validated and authorized by the Worker.
type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null };
class Query implements PromiseLike<Result> {
  private request: {
    table: string;
    action: string;
    select: string;
    filters: { column: string; op: string; value: unknown }[];
    order?: { column: string; ascending: boolean };
    rows?: Row[];
    values?: Row;
    single: boolean;
    limit?: number;
    offset?: number;
  };
  constructor(table: string) {
    this.request = {
      table,
      action: "select",
      select: "*",
      filters: [],
      single: false,
    };
  }
  select(fields = "*") {
    this.request.select = fields;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.request.action = "insert";
    this.request.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(values: Row) {
    this.request.action = "update";
    this.request.values = values;
    return this;
  }
  delete() {
    this.request.action = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.request.filters.push({ column, op: "eq", value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.request.filters.push({ column, op: "neq", value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.request.filters.push({ column, op: "in", value });
    return this;
  }
  order(column: string, options = { ascending: true }) {
    this.request.order = { column, ascending: options.ascending };
    return this;
  }
  single() {
    this.request.single = true;
    return this;
  }
  range(from: number, to: number) {
    this.request.offset = from;
    this.request.limit = to - from + 1;
    return this;
  }
  limit(n: number) {
    this.request.limit = n;
    return this;
  }
  async run(): Promise<Result> {
    try {
      const paged =
        this.request.action === "select" &&
        !this.request.single &&
        this.request.limit === undefined;
      const all: Row[] = [];
      let offset = 0;
      do {
        const request = paged
          ? { ...this.request, limit: 1000, offset }
          : this.request;
        const response = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const body = (await response.json()) as Result;
        if (!response.ok)
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : (body.error?.message ?? "Request failed"),
          );
        if (!paged) return body;
        const rows = body.data as Row[];
        all.push(...rows);
        if (rows.length < 1000) break;
        offset += 1000;
      } while (offset <= 10000000);
      return { data: all, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent("petman-error", { detail: message }),
        );
      return { data: null, error: { message } };
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}
export const database = {
  from: (table: string) => new Query(table),
  auth: {
    getSession: async () => ({ data: { session: await readSession() } }),
    signInWithPassword: async (input: { email: string; password: string }) => {
      const result = await authClient.signIn.email(input);
      if (!result.error) {
        const session = await readSession();
        listeners.forEach((fn) => fn("SIGNED_IN", session));
      }
      return result;
    },
    signOut: async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      listeners.forEach((fn) => fn("SIGNED_OUT", null));
    },
    onAuthStateChange: (
      fn: (event: string, session: Session | null) => void,
    ) => {
      listeners.add(fn);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(fn);
            },
          },
        },
      };
    },
  },
};
// ─── Types ────────────────────────────────────────────────────────────────────

export type DbCustomer = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  created_at: string;
  updated_at: string;
};

export type DbPet = {
  id: string;
  customer_id: string;
  pet_name: string;
  pet_type: string | null;
  breed: string | null;
  age: number | null;
  address: string | null;
  medical_history: string | null;
  contact: string | null;
  preferred_groomer: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAppointment = {
  id: string;
  pet_id: string;
  day: string | null;
  date: string | null;
  type: string | null;
  groomer: string | null;
  price: number | null;
  p_buy: number | null;
  p_use: number | null;
  p_left: number | null;
  notes: string | null;
  created_at: string;
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await database.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  await database.auth.signOut();
}

export async function getSession() {
  const { data } = await database.auth.getSession();
  return data.session;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

export type DbDeletedCustomer = {
  id: string;
  original_id: string;
  customer_id: string | null;
  customer_name: string;
  snapshot: any;
  deleted_at: string;
};

export async function fetchAllData() {
  const [{ data: customers }, { data: pets }, { data: appointments }] =
    await Promise.all([
      database
        .from("customers")
        .select("*")
        .order("created_at", { ascending: true }),
      database
        .from("pets")
        .select("*")
        .order("created_at", { ascending: true }),
      database
        .from("appointments")
        .select("*")
        .order("date", { ascending: true }),
    ]);
  return {
    customers: customers ?? [],
    pets: pets ?? [],
    appointments: appointments ?? [],
  };
}

export async function fetchDeletedCustomers(): Promise<DbDeletedCustomer[]> {
  const { data } = await database
    .from("deleted_customers")
    .select("*")
    .order("deleted_at", { ascending: false });
  return data ?? [];
}
