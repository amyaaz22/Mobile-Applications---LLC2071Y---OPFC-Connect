'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function CoachGuard({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<{ role: string; full_name: string; permissions?: string[] | null } | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.replace('/login'); return }
      // select('*') rather than naming columns: this guard runs in front of
      // every /coach/* page, so it must not break if a newer migration
      // (e.g. profiles.permissions, schema_v4) hasn't been applied yet —
      // an unrecognized-column error here used to bounce straight back to
      // /login with no explanation.
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data, error }) => {
          if (error) {
            console.error('CoachGuard: failed to load profile — likely a pending Supabase migration', error)
          }
          if (!data || !['admin', 'coach'].includes(data.role)) {
            window.location.replace('/login')
            return
          }
          setProfile(data)
          setChecked(true)
        })
    })
  }, [])

  if (!checked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(78,198,198,0.3)', borderTop: '2px solid #4EC6C6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
        <span>Loading…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Sidebar role={profile!.role} userName={profile!.full_name} permissions={profile!.permissions}/>
      <MobileNav role={profile!.role}/>
      <main className="md:ml-64 pb-20 md:pb-0 min-h-screen">{children}</main>
    </div>
  )
}
