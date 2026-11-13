import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// The installed @supabase/ssr version (0.3.0, pinned in package-lock.json)
// only recognizes the older get/set/remove cookie adapter shape — its own
// createServerClient checks `typeof cookies.get === 'function'` etc.
// internally, so a getAll/setAll adapter (the newer API from later
// @supabase/ssr versions) is silently never called at all: every cookie
// read returns nothing, auth.getUser() always resolves to no session, and
// every API route that gates on "is this caller signed in" (chiefly
// /api/staff/invite) always 401s with "Not signed in" — confirmed live
// against a real logged-in session via a temporary read-only diagnostic
// route before landing this fix, not just reasoned from the library source.
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
