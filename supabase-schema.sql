-- ============================================================
-- PetMan - Supabase Database Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. CUSTOMERS TABLE
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(50) UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PETS TABLE
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  pet_name VARCHAR(255) NOT NULL,
  pet_type VARCHAR(100),
  breed VARCHAR(255),
  age DECIMAL(4,1),
  address TEXT,
  medical_history TEXT,
  contact VARCHAR(50),
  preferred_groomer VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. APPOINTMENTS TABLE
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  day VARCHAR(20),
  date DATE,
  type VARCHAR(100),
  groomer VARCHAR(255),
  price DECIMAL(10,2),
  p_buy INTEGER,
  p_use INTEGER,
  p_left INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INDEXES
CREATE INDEX idx_pets_customer_id ON pets(customer_id);
CREATE INDEX idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX idx_appointments_date ON appointments(date);

-- 5. ROW LEVEL SECURITY
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Public access policies (lock down later with auth)
CREATE POLICY "public_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_pets" ON pets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);

-- 6. AUTO UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. SEED DATA (from your Excel)
INSERT INTO customers (customer_id, customer_name) VALUES
  ('CUST001', 'Boyang'),
  ('CUST002', 'Ryze'),
  ('CUST003', 'hu');

INSERT INTO pets (customer_id, pet_name, pet_type, breed, age, address, medical_history, contact)
SELECT id, 'Bailey', 'Dog', 'Golden Ret', 1.5,
  '418 Bedok North Ave 2 #06-77 S460415', 'None - Too active', '91904812'
FROM customers WHERE customer_name = 'Boyang';

INSERT INTO pets (customer_id, pet_name, pet_type, contact)
SELECT id, 'Jax', 'Dog', '1918284' FROM customers WHERE customer_name = 'Ryze';

INSERT INTO pets (customer_id, pet_name, pet_type, contact)
SELECT id, 'hi', 'Other', 'hi' FROM customers WHERE customer_name = 'hu';

INSERT INTO appointments (pet_id, day, date, type, groomer, price, p_buy, p_use, p_left)
SELECT id, 'Thursday', '2024-10-24', 'BG, BT', 'Tania', 80, 4, 1, 3 FROM pets WHERE pet_name = 'Bailey';

INSERT INTO appointments (pet_id, day, date, type, p_use, p_left)
SELECT id, 'Wednesday', '2026-02-11', 'FG, BT', 1, 2 FROM pets WHERE pet_name = 'Bailey';

INSERT INTO appointments (pet_id, day, date, p_use, p_left)
SELECT id, 'Monday', '2026-02-16', 1, 1 FROM pets WHERE pet_name = 'Bailey';

INSERT INTO appointments (pet_id, day, date, p_use, p_left)
SELECT id, 'Tuesday', '2026-02-17', 0, 1 FROM pets WHERE pet_name = 'Bailey';
