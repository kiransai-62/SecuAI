-- Migration: Create accounts table without RLS (SEC-CFG-001)
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Note: Intentionally missing ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
