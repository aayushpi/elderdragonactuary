-- Create invite codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used_by_user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_unused ON public.invite_codes(code) WHERE used_by_user_id IS NULL;

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can check if a code exists and is unused (for validation)
DROP POLICY IF EXISTS "Anyone can check unused codes" ON public.invite_codes;
CREATE POLICY "Anyone can check unused codes" ON public.invite_codes
  FOR SELECT USING (used_by_user_id IS NULL);

-- Policy: Authenticated users can mark unused codes as used
DROP POLICY IF EXISTS "Users can mark their code as used" ON public.invite_codes;
CREATE POLICY "Users can mark their code as used" ON public.invite_codes
  FOR UPDATE 
  USING (used_by_user_id IS NULL)
  WITH CHECK (used_by_user_id = auth.uid());

-- Insert some initial invite codes (you can generate more as needed)
INSERT INTO public.invite_codes (code) VALUES
  ('COMMANDO-2026-ALPHA-7X9K'),
  ('COMMANDO-2026-ALPHA-3M5P'),
  ('COMMANDO-2026-ALPHA-8R2W'),
  ('COMMANDO-2026-ALPHA-4N6Q'),
  ('COMMANDO-2026-ALPHA-9L1T'),
  ('COMMANDO-2026-ALPHA-5H8D'),
  ('COMMANDO-2026-ALPHA-2V7B'),
  ('COMMANDO-2026-ALPHA-6F3J'),
  ('COMMANDO-2026-ALPHA-1K9C'),
  ('COMMANDO-2026-ALPHA-7P4M')
ON CONFLICT (code) DO NOTHING;
