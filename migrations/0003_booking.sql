ALTER TABLE pets ADD COLUMN birthday TEXT;
ALTER TABLE members ADD COLUMN consent_at TEXT;
CREATE TABLE services (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents >= 0), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE bookings (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), service_name TEXT NOT NULL, price_cents INTEGER NOT NULL, date TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')), details TEXT NOT NULL, customer_id TEXT REFERENCES customers(id), pet_id TEXT REFERENCES pets(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX booking_slot ON bookings(date,slot) WHERE status != 'cancelled';
CREATE INDEX booking_date ON bookings(date);
CREATE TABLE booking_transitions(booking_id TEXT NOT NULL REFERENCES bookings(id),from_status TEXT NOT NULL,PRIMARY KEY(booking_id,from_status));
-- No packages are seeded. An admin must enter actual packages before bookings open.
