import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Persistence will be disabled. Add them to frontend/.env'
  )
}

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // Persist the session to localStorage so it survives page reloads
          // and dev-server restarts. This is the default but we set it
          // explicitly to make the intent clear.
          persistSession:   true,
          // Automatically refresh the JWT before it expires so the user
          // is never silently logged out mid-session.
          autoRefreshToken: true,
          // Read the existing session from storage synchronously on init
          // so getSession() always returns a value even before the first
          // network round-trip completes.
          detectSessionInUrl: true,
        },
      })
    : null
