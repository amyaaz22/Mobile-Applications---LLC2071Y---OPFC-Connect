'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export type RegistrationWindowStatus = { open: boolean; opens_at: string | null; closes_at: string | null }

// Checks whether a public self-service form is currently open, via the
// registration_window_status() RPC — the only thing an anonymous visitor
// is allowed to read about club_settings (see schema_v16_additions.sql;
// club_settings itself requires auth.uid() is not null to SELECT). The
// real enforcement is server-side RLS on the insert — this is only for
// showing the right message instead of a dead form. `key` is the
// club_settings row key ('player_registration' / 'coach_registration').
// Returns null while loading, so a closed form never flashes open.
export function useRegistrationWindow(key: string) {
  const [status, setStatus] = useState<RegistrationWindowStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.rpc('registration_window_status', { p_key: key }).then(({ data }) => {
      if (!cancelled) setStatus((data as RegistrationWindowStatus) ?? { open: true, opens_at: null, closes_at: null })
    })
    return () => { cancelled = true }
  }, [key])
  return status
}

export function RegistrationClosedNotice({ status, title }: { status: RegistrationWindowStatus; title: string }) {
  const now = new Date()
  const opensAt = status.opens_at ? new Date(status.opens_at) : null
  const closesAt = status.closes_at ? new Date(status.closes_at) : null
  const notYetOpen = !!opensAt && opensAt > now

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <span className="text-white/30 text-2xl">⏳</span>
          </div>
          <h1 className="text-white font-bold text-xl mb-2">{title}</h1>
          <p className="text-white/50 text-sm mb-1">
            {notYetOpen
              ? `This isn't open yet — it opens ${opensAt!.toLocaleString()}.`
              : closesAt
                ? `This closed on ${closesAt.toLocaleString()}.`
                : "This isn't currently open — please check back later."}
          </p>
          <p className="text-white/30 text-xs mt-4">Contact the club directly if you have an urgent question.</p>
          <Link href="/login" className="btn-secondary inline-flex items-center gap-2 mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
