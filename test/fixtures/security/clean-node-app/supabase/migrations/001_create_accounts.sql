-- Migration: Create accounts table WITH Row Level Security enabled
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Row Level Security strictly enabled
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own account"
  ON public.accounts
  FOR ALL
  USING (auth.uid() = user_id);
