# Invite Code System

## Overview
The app uses invite codes to limit signups. Users must provide a valid, unused invite code along with their email to sign up.

## Initial Codes (for testing)
The following 10 codes were generated in the migration:

```
COMMANDO-2026-ALPHA-7X9K
COMMANDO-2026-ALPHA-3M5P
COMMANDO-2026-ALPHA-8R2W
COMMANDO-2026-ALPHA-4N6Q
COMMANDO-2026-ALPHA-9L1T
COMMANDO-2026-ALPHA-5H8D
COMMANDO-2026-ALPHA-2V7B
COMMANDO-2026-ALPHA-6F3J
COMMANDO-2026-ALPHA-1K9C
COMMANDO-2026-ALPHA-7P4M
```

## How It Works

1. User enters invite code + email on sign-in page
2. App validates the code is valid and unused
3. If valid, stores code in localStorage and sends magic link
4. After user completes sign-in via magic link, code is marked as used
5. Code cannot be reused

## Database Schema

```sql
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used_by_user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Managing Codes

### Via Supabase Dashboard
1. Go to Table Editor → `invite_codes`
2. Add new rows with random codes
3. View which codes have been used

### Via SQL
```sql
-- Generate new codes
INSERT INTO public.invite_codes (code) VALUES
  ('COMMANDO-2026-BETA-X1Y2'),
  ('COMMANDO-2026-BETA-A3B4');

-- Check unused codes
SELECT code, created_at 
FROM public.invite_codes 
WHERE used_by_user_id IS NULL
ORDER BY created_at DESC;

-- Check used codes
SELECT code, used_at, used_by_user_id 
FROM public.invite_codes 
WHERE used_by_user_id IS NOT NULL
ORDER BY used_at DESC;
```

## Security Notes

- Codes are case-insensitive (automatically uppercased)
- Row-level security prevents users from seeing used codes
- Validation happens server-side (immune to client tampering)
- Concurrent usage of same code is prevented by database constraints
