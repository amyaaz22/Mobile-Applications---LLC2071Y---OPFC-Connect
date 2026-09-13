import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, PermissionArea } from '@/lib/permissions'

// For pages already behind CoachGuard (coach OR admin) that should ALSO be
// narrowed for a restricted admin account. Coaches are untouched — this
// only ever blocks an admin whose `permissions` doesn't include `area`.
// Redirects to /unauthorized when blocked; renders nothing until checked.
export function usePermissionGuard(area: PermissionArea) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      supabase.from('profiles').select('role, permissions').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role === 'admin' && !hasPermission(data, area)) { router.replace('/unauthorized'); return }
          setChecked(true)
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area])

  return checked
}
