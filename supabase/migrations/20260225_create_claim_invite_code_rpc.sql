-- Claim an invite code as the currently authenticated user.
-- Uses auth.uid() on the database side to satisfy RLS checks consistently.
CREATE OR REPLACE FUNCTION public.claim_invite_code(input_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.invite_codes
  SET
    used_by_user_id = auth.uid(),
    used_at = NOW()
  WHERE code = UPPER(TRIM(input_code))
    AND used_by_user_id IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invite_code(TEXT) TO authenticated;
