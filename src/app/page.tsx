'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace('/login')
        return
      }
      supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile) { window.location.replace('/login'); return }
          if (profile.role === 'admin' || profile.role === 'coach') {
            window.location.replace('/coach')
          } else if (profile.role === 'parent') {
            window.location.replace('/parent')
          } else if (profile.role === 'player') {
            window.location.replace('/player')
          } else {
            window.location.replace('/login')
          }
        })
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.4)' }}>
        <div style={{
          width: 24, height: 24, border: '2px solid rgba(78,198,198,0.3)',
          borderTop: '2px solid #4EC6C6', borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}/>
        <span>Loading…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
