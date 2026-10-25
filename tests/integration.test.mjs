import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
const origin = process.env.TEST_ORIGIN ?? "http://localhost:8787";
if (new URL(origin).hostname !== "localhost")
  throw new Error("Tests must use a local database");
const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const fixturePath = ".wrangler/test-credentials.json";
const initial = !existsSync(fixturePath);
const credentials = initial
  ? {
      email: `test-admin-${randomUUID()}@example.test`,
      password: randomBytes(24).toString("hex"),
      name: "Local test administrator",
    }
  : JSON.parse(readFileSync(fixturePath, "utf8"));
async function call(path, body, cookie = "") {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    r,
    data,
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}
test("D1 accounts, membership records, isolation, revocation and API boundaries", async () => {
  if (initial) {
    const setup = await call("/api/setup", {
      ...credentials,
      token: vars.SETUP_TOKEN,
    });
    assert.equal(setup.r.status, 201, JSON.stringify(setup.data));
    writeFileSync(fixturePath, JSON.stringify(credentials));
  }
  const login = await call("/api/auth/sign-in/email", {
    email: credentials.email,
    password: credentials.password,
  });
  assert.equal(login.r.status, 200, JSON.stringify(login.data));
  assert.ok(login.cookie);
  assert.match(login.r.headers.get("set-cookie"), /HttpOnly/i);
  const admin = login.cookie;
  assert.equal(
    (
      await call("/api/auth/sign-up/email", {
        email: "bad@example.test",
        password: credentials.password,
        name: "Bad",
      })
    ).r.status,
    404,
  );
  assert.equal(
    (await call("/api/data", { table: "customers", action: "select" })).r
      .status,
    401,
  );
  const q = async (table, action, extra = {}, cookie = admin) =>
    call("/api/data", { table, action, ...extra }, cookie);
  const first = randomUUID(),
    second = randomUUID(),
    pet = randomUUID();
  const customers = await q("customers", "insert", {
    rows: [
      { id: first, customer_name: "TEST Owner A", customer_id: first },
      { id: second, customer_name: "TEST Owner B", customer_id: second },
    ],
  });
  assert.equal(customers.r.status, 200, JSON.stringify(customers.data));
  assert.equal(
    (
      await q("pets", "insert", {
        rows: [
          {
            id: pet,
            customer_id: first,
            pet_name: "TEST Pet",
            pet_type: "Dog",
            contact: "TEST ONLY",
          },
        ],
      })
    ).r.status,
    200,
  );
  assert.equal(
    (
      await q("appointments", "insert", {
        rows: [{ pet_id: pet, date: "2026-10-25", price: 50 }],
      })
    ).r.status,
    200,
  );
  assert.equal(
    (
      await q("members", "insert", {
        rows: [
          {
            customer_id: first,
            marketing_consent: true,
            email: "member@example.test",
          },
        ],
      })
    ).r.status,
    200,
  );
  const member = await q("members", "select", {
    filters: [{ column: "customer_id", op: "eq", value: first }],
    single: true,
  });
  assert.equal(member.data.data.marketing_consent, true);
  const join = await q("appointments", "select", {
    select: "price, date, pets(customer_id)",
  });
  assert.ok(join.data.data.some((a) => a.pets.customer_id === first));
  const email = `test-customer-${randomUUID()}@example.test`,
    password = randomBytes(24).toString("hex");
  const created = await call(
    "/api/admin/create-customer-account",
    { email, password, customerId: first },
    admin,
  );
  assert.equal(created.r.status, 201, JSON.stringify(created.data));
  const customerLogin = await call("/api/auth/sign-in/email", {
    email,
    password,
  });
  assert.equal(customerLogin.r.status, 200, JSON.stringify(customerLogin.data));
  const customer = customerLogin.cookie;
  const own = await q("customers", "select", {}, customer);
  assert.deepEqual(
    own.data.data.map((c) => c.id),
    [first],
  );
  const other = await q(
    "customers",
    "select",
    { filters: [{ column: "id", op: "eq", value: second }] },
    customer,
  );
  assert.deepEqual(other.data.data, []);
  assert.equal(
    (
      await q(
        "customers",
        "update",
        {
          filters: [{ column: "id", op: "eq", value: first }],
          values: { customer_name: "unauthorized" },
        },
        customer,
      )
    ).r.status,
    403,
  );
  assert.equal(
    (
      await q(
        "user_profiles",
        "update",
        {
          filters: [{ column: "customer_id", op: "eq", value: first }],
          values: { role: "admin" },
        },
        customer,
      )
    ).r.status,
    403,
  );
  assert.equal((await q("user", "select")).r.status, 403);
  assert.equal(
    (await q("customers", "select", { select: "id; DROP TABLE customers" })).r
      .status,
    403,
  );
  assert.equal(
    (await call("/api/admin/users", undefined, customer)).r.status,
    403,
  );
  const users = await call("/api/admin/users", undefined, admin);
  const customerId = users.data.find((u) => u.email === email).id;
  assert.equal(
    (
      await call(
        "/api/admin/toggle-user",
        { userId: customerId, active: false },
        admin,
      )
    ).r.status,
    200,
  );
  assert.ok(
    [401, 403].includes(
      (await q("customers", "select", {}, customer)).r.status,
    ),
  );
  assert.equal(
    (
      await call(
        "/api/admin/toggle-user",
        { userId: customerId, active: true },
        admin,
      )
    ).r.status,
    200,
  );
  const relog = await call("/api/auth/sign-in/email", { email, password });
  assert.equal(relog.r.status, 200);
  assert.equal(
    (
      await call(
        "/api/admin/reset-customer-password",
        { userId: customerId, newPassword: randomBytes(24).toString("hex") },
        admin,
      )
    ).r.status,
    200,
  );
  assert.ok(
    [401, 403].includes(
      (await q("customers", "select", {}, relog.cookie)).r.status,
    ),
  );
  const badOrigin = await fetch(origin + "/api/data", {
    method: "POST",
    headers: {
      Origin: "https://other.example",
      "Content-Type": "application/json",
      Cookie: admin,
    },
    body: JSON.stringify({ table: "customers", action: "select" }),
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(
    (await call("/api/workspace/customers/" + first + "/archive", {}, admin)).r
      .status,
    200,
  );
  const logs = await q("deleted_customers", "select");
  const recovery = logs.data.data.find((l) => l.original_id === first);
  assert.ok(recovery);
  const hidden = await q("customers", "select", {
    filters: [{ column: "id", op: "eq", value: first }],
  });
  assert.deepEqual(hidden.data.data, []);
  assert.equal(
    (await call("/api/workspace/restore", { id: recovery.id }, admin)).r.status,
    200,
  );
  const restored = await q("customers", "select", {
    filters: [{ column: "id", op: "eq", value: first }],
  });
  assert.equal(restored.data.data[0].id, first);
  const restoredPets = await q("pets", "select", {
    filters: [{ column: "id", op: "eq", value: pet }],
  });
  assert.equal(restoredPets.data.data[0].id, pet);
  // Concurrent guest bookings compete for the same database-enforced slot.
  const service = randomUUID();
  assert.equal(
    (
      await q("services", "insert", {
        rows: [
          {
            id: service,
            name: "TEST service",
            description: "Test only",
            price_cents: 5000,
          },
        ],
      })
    ).r.status,
    200,
  );
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const publicSlots = await call("/api/public/slots?date=" + date);
  assert.ok(publicSlots.data.slots.length);
  const bookingInput = {
    serviceId: service,
    date,
    slot: publicSlots.data.slots[0],
    name: "TEST Booking Owner",
    phone: "+60123456789",
    email: "booking@example.test",
    birthday: "1990-01-01",
    petName: "TEST Booking Pet",
    petType: "Dog",
    consent: true,
  };
  const attempts = await Promise.all([
    call("/api/public/book", bookingInput),
    call("/api/public/book", bookingInput),
  ]);
  assert.deepEqual(attempts.map((a) => a.r.status).sort(), [201, 409]);
  const booking = attempts.find((a) => a.r.status === 201).data.id;
  assert.equal(
    (
      await call(
        "/api/admin/booking-status",
        { id: booking, status: "confirmed" },
        admin,
      )
    ).r.status,
    200,
  );
  const bookingRows = await call("/api/admin/bookings", undefined, admin),
    saved = bookingRows.data.find((b) => b.id === booking);
  const captured = await q("members", "select", {
    filters: [{ column: "customer_id", op: "eq", value: saved.customer_id }],
    single: true,
  });
  assert.equal(captured.data.data.marketing_consent, true);
  assert.equal(captured.data.data.date_of_birth, "1990-01-01");
  assert.equal(
    (
      await call(
        "/api/admin/booking-status",
        { id: booking, status: "completed" },
        admin,
      )
    ).r.status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/admin/booking-status",
        { id: booking, status: "completed" },
        admin,
      )
    ).r.status,
    400,
  );
  const visits = await q("appointments", "select", {
    filters: [{ column: "id", op: "eq", value: "booking-" + booking }],
  });
  assert.equal(visits.data.data.length, 1);
  assert.equal(visits.data.data[0].price, 50);
  const backup = await call("/api/admin/backup", undefined, admin);
  assert.ok(backup.data.data.members);
  assert.equal(backup.data.data.user, undefined);
  // A failed import must roll back earlier writes in the same batch.
  const rollback = randomUUID();
  const broken = await call(
    "/api/admin/import",
    {
      version: 2,
      data: {
        customers: [{ id: rollback, customer_name: "TEST must roll back" }],
        pets: [
          {
            id: randomUUID(),
            customer_id: "missing-owner",
            pet_name: "Broken",
          },
        ],
      },
    },
    admin,
  );
  assert.equal(broken.r.status, 400);
  const rolledBack = await q("customers", "select", {
    filters: [{ column: "id", op: "eq", value: rollback }],
  });
  assert.deepEqual(rolledBack.data.data, []);
  await operationsChecks(call, admin, q, first, pet, service);
  assert.equal((await call("/api/auth/sign-out", {}, admin)).r.status, 200);
  assert.equal((await q("customers", "select", {}, admin)).r.status, 401);
});

async function operationsChecks(call, admin, q, customerId, petId, serviceId) {
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  // Invoice math, partial payments, refunds, duplicate retries and immutable snapshots.
  const created = await call(
    "/api/workspace/invoices",
    {
      customerId,
      issuedDate: date,
      dueDate: date,
      discountCents: 500,
      taxCents: 0,
      items: [{ description: "Grooming", quantity: 2, unitCents: 5000 }],
    },
    admin,
  );
  assert.equal(created.r.status, 201, JSON.stringify(created.data));
  const invoiceId = created.data.id;
  let invoice = await call(
    "/api/workspace/invoices/" + invoiceId,
    undefined,
    admin,
  );
  assert.equal(invoice.data.invoice.total_cents, 9500);
  const payment = {
    id: randomUUID(),
    invoiceId,
    kind: "payment",
    amountCents: 4000,
    method: "cash",
    reference: "TEST",
    receivedDate: date,
  };
  assert.equal(
    (await call("/api/workspace/payments", payment, admin)).r.status,
    200,
  );
  assert.equal(
    (await call("/api/workspace/payments", payment, admin)).r.status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/workspace/payments",
        { ...payment, id: randomUUID(), amountCents: 6000 },
        admin,
      )
    ).r.status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/workspace/payments",
        { ...payment, id: randomUUID(), kind: "refund", amountCents: 5000 },
        admin,
      )
    ).r.status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/workspace/payments",
        { ...payment, id: randomUUID(), kind: "refund", amountCents: 1000 },
        admin,
      )
    ).r.status,
    200,
  );
  invoice = await call(
    "/api/workspace/invoices/" + invoiceId,
    undefined,
    admin,
  );
  assert.equal(invoice.data.invoice.collected_cents, 3000);
  assert.equal(invoice.data.payments.length, 2);
  assert.equal(
    (await call("/api/workspace/invoices/" + invoiceId + "/void", {}, admin)).r
      .status,
    409,
  );
  // Backup includes booking and invoice history and can be merged twice without duplicating payments.
  const backup = await call("/api/admin/backup", undefined, admin);
  assert.ok(backup.data.data.bookings.length);
  assert.ok(backup.data.data.invoice_payments.length);
  assert.equal(
    (await call("/api/admin/import", backup.data, admin)).r.status,
    200,
  );
  assert.equal(
    (await call("/api/admin/import", backup.data, admin)).r.status,
    200,
  );
  invoice = await call(
    "/api/workspace/invoices/" + invoiceId,
    undefined,
    admin,
  );
  assert.equal(invoice.data.invoice.collected_cents, 3000);
  // Existing-pet matching keeps a returning pet's identity.
  const available = await call(
    "/api/public/slots?date=" + date + "&serviceId=" + serviceId,
  );
  const booking = await call("/api/public/book", {
    serviceId,
    date,
    slot: available.data.slots[0],
    name: "Existing owner",
    phone: "+60123456789",
    email: "",
    petName: "Existing pet",
    petType: "Dog",
    consent: false,
  });
  assert.equal(booking.r.status, 201, JSON.stringify(booking.data));
  assert.equal(
    (
      await call(
        "/api/admin/booking-status",
        { id: booking.data.id, status: "confirmed", customerId, petId },
        admin,
      )
    ).r.status,
    200,
  );
  const bookings = await call("/api/admin/bookings", undefined, admin);
  assert.equal(
    bookings.data.find((b) => b.id === booking.data.id).pet_id,
    petId,
  );
  // Archiving and restoring retains invoice references and membership IDs.
  const memberBefore = await q("members", "select", {
    filters: [{ column: "customer_id", op: "eq", value: customerId }],
  });
  await call("/api/workspace/customers/" + customerId + "/archive", {}, admin);
  const logs = await q("deleted_customers", "select");
  const log = logs.data.data.find((l) => l.original_id === customerId);
  assert.equal(
    (await call("/api/workspace/restore", { id: log.id }, admin)).r.status,
    200,
  );
  const memberAfter = await q("members", "select", {
    filters: [{ column: "customer_id", op: "eq", value: customerId }],
  });
  assert.deepEqual(memberAfter.data.data, memberBefore.data.data);
  // Staff roles are enforced by the API, not only by navigation.
  for (const role of ["groomer", "receptionist"]) {
    const email = "test-" + role + "-" + randomUUID() + "@example.test",
      password = randomBytes(24).toString("hex");
    const staff = await call(
      "/api/admin/create-staff",
      { name: "TEST " + role, email, password, staffRole: role },
      admin,
    );
    assert.equal(staff.r.status, 201, JSON.stringify(staff.data));
    const login = await call("/api/auth/sign-in/email", { email, password });
    assert.equal(login.r.status, 200);
    assert.equal(
      (await call("/api/admin/backup", undefined, login.cookie)).r.status,
      403,
    );
    assert.equal(
      (await call("/api/workspace/settings", undefined, login.cookie)).r.status,
      403,
    );
    assert.equal(
      (await call("/api/workspace/today?date=" + date, undefined, login.cookie))
        .r.status,
      200,
    );
    assert.equal(
      (await call("/api/workspace/invoices", undefined, login.cookie)).r.status,
      role === "groomer" ? 403 : 200,
    );
  }
  // Duration/buffer overlap and holiday closures.
  await q("services", "update", {
    filters: [{ column: "id", op: "eq", value: serviceId }],
    values: { duration_minutes: 90, buffer_minutes: 15 },
  });
  const nextDate = new Date(Date.now() + 4 * 86400000)
    .toISOString()
    .slice(0, 10);
  const slots = await call(
    "/api/public/slots?date=" + nextDate + "&serviceId=" + serviceId,
  );
  const slot = slots.data.slots[0];
  const request = {
    serviceId,
    date: nextDate,
    slot,
    name: "Overlap test",
    phone: "+60123456789",
    email: "",
    petName: "Test",
    petType: "Dog",
    consent: false,
  };
  assert.equal((await call("/api/public/book", request)).r.status, 201);
  const remaining = await call(
    "/api/public/slots?date=" + nextDate + "&serviceId=" + serviceId,
  );
  const start = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3));
  assert.ok(
    remaining.data.slots.every(
      (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) >= start + 105,
    ),
  );
  await call(
    "/api/workspace/closures",
    { date: nextDate, reason: "TEST closed" },
    admin,
  );
  assert.deepEqual(
    (
      await call(
        "/api/public/slots?date=" + nextDate + "&serviceId=" + serviceId,
      )
    ).data.slots,
    [],
  );
}
