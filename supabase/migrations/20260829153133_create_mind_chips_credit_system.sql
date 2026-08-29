/*
# Create Mind Chips credit system

1. New Tables
- `user_credits`
  - `user_id` (uuid, primary key, references auth.users with cascade delete)
  - `balance` (integer, not null, default 0 — stores the user's Mind Chips balance)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
- `credit_transactions`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, references auth.users with cascade delete)
  - `amount` (integer, not null — positive for credits added, negative for credits spent)
  - `description` (text, not null — human-readable description like "Welcome Bonus", "Text Generation", etc.)
  - `type` (text, not null — 'bonus', 'generation', 'refund')
  - `generation_type` (text, nullable — 'text', 'image', or 'video' for generation transactions)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on both tables.
- `user_credits`: owner-scoped SELECT only (users can read their own balance but NEVER write to it — all mutations go through SECURITY DEFINER functions).
- `credit_transactions`: owner-scoped SELECT only (users can read their own transaction history but cannot insert/update/delete).

3. Functions
- `get_user_balance()` — SECURITY DEFINER, returns the caller's balance (or 0 if no row exists).
- `deduct_mind_chips(p_amount integer, p_description text, p_generation_type text)` — SECURITY DEFINER, atomically checks balance, deducts, and records a transaction. Returns the new balance or raises an exception if insufficient.
- `refund_mind_chips(p_amount integer, p_description text)` — SECURITY DEFINER, adds chips back and records a refund transaction.
- `handle_new_user()` — trigger function that creates a `user_credits` row with balance 500 and records a "Welcome Bonus" transaction when a new auth.users row is inserted.

4. Triggers
- `on_auth_user_created` — AFTER INSERT on `auth.users`, calls `handle_new_user()`.

5. Important Notes
- The 500 Mind Chips welcome bonus is granted exactly once, automatically, when the account is first created via the database trigger.
- Users can never manually modify their balance — RLS blocks all writes from the client; only SECURITY DEFINER functions (running with elevated privileges) can modify the balance.
- All deduction and refund logic is server-side only.
*/

CREATE TABLE IF NOT EXISTS user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credits" ON user_credits;
CREATE POLICY "select_own_credits" ON user_credits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('bonus', 'generation', 'refund')),
  generation_type text CHECK (generation_type IS NULL OR generation_type IN ('text', 'image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON credit_transactions;
CREATE POLICY "select_own_transactions" ON credit_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Auto-update updated_at on user_credits
CREATE OR REPLACE FUNCTION update_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_credits_updated_at ON user_credits;
CREATE TRIGGER trg_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_credits_updated_at();

-- SECURITY DEFINER: get the caller's balance (returns 0 if no row)
CREATE OR REPLACE FUNCTION get_user_balance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
BEGIN
  SELECT balance INTO bal FROM user_credits WHERE user_id = auth.uid();
  RETURN COALESCE(bal, 0);
END;
$$;

-- SECURITY DEFINER: deduct Mind Chips atomically
CREATE OR REPLACE FUNCTION deduct_mind_chips(
  p_amount integer,
  p_description text,
  p_generation_type text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;

  SELECT balance INTO current_balance FROM user_credits WHERE user_id = auth.uid() FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found';
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: You need % Mind Chips to generate this. You currently have %.', p_amount, current_balance;
  END IF;

  new_balance := current_balance - p_amount;

  UPDATE user_credits SET balance = new_balance WHERE user_id = auth.uid();

  INSERT INTO credit_transactions (user_id, amount, description, type, generation_type)
  VALUES (auth.uid(), -p_amount, p_description, 'generation', p_generation_type);

  RETURN new_balance;
END;
$$;

-- SECURITY DEFINER: refund Mind Chips
CREATE OR REPLACE FUNCTION refund_mind_chips(
  p_amount integer,
  p_description text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  SELECT balance INTO current_balance FROM user_credits WHERE user_id = auth.uid() FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'No credit account found';
  END IF;

  new_balance := current_balance + p_amount;

  UPDATE user_credits SET balance = new_balance WHERE user_id = auth.uid();

  INSERT INTO credit_transactions (user_id, amount, description, type)
  VALUES (auth.uid(), p_amount, p_description, 'refund');

  RETURN new_balance;
END;
$$;

-- Trigger: grant 500 Mind Chips on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance)
  VALUES (NEW.id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO credit_transactions (user_id, amount, description, type)
  VALUES (NEW.id, 500, 'Welcome Bonus', 'bonus')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant execute on the SECURITY DEFINER functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_mind_chips(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_mind_chips(integer, text) TO authenticated;