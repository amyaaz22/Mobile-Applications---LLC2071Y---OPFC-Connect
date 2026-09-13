import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Soft UI scoping: if the signed-in coach is limited to specific categories
// (profiles.assigned_categories), narrow what they see/pick across pages to
// just those. Not an RLS boundary — see CLAUDE.md RBAC notes. Unscoped
// coaches/admins (assigned_categories null/empty) see everything, same as before.
export function useScopedCategories(allCategories: string[]) {
  const supabase = createClient()
  const [scopedCategories, setScopedCategories] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data?.assigned_categories?.length) setScopedCategories(data.assigned_categories) })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleCategories = useMemo(
    () => scopedCategories.length ? scopedCategories : allCategories,
    [scopedCategories, allCategories]
  )
  const inScope = useCallback((category: string | null | undefined) =>
    !scopedCategories.length || !category || category === 'All' || scopedCategories.includes(category),
    [scopedCategories]
  )

  return { scopedCategories, visibleCategories, inScope }
}
