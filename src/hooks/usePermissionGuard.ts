import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, PermissionArea } from '@/lib/permissions'

// Gates a page behind one granular area. Applies to BOTH admin and coach —
// used inside pages already behind CoachGuard (which only lets admin/coach
// through in the first place), so a parent/player never reaches this check.
// Redirects to /unauthorized when blocked; renders nothing until checked.
export function usePermissionGuard(area: PermissionArea) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      // select('*') so a pending migration fails open here rather than
      // throwing — CoachGuard already gated entry as coach/admin, so worst
      // case a narrowed account briefly keeps access they should lose.
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (!hasPermission(data, area)) { router.replace('/unauthorized'); return }
          setChecked(true)
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area])

  return checked
}
