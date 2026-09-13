import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Fetches an admin-configurable dropdown list from club_settings (see
// Club Settings → Dropdown Lists). Returns `fallback` until the real
// value loads, and forever if that key was never saved.
export function useConfigList(key: string, fallback: string[]): string[] {
  const [list, setList] = useState<string[]>(fallback)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('club_settings').select('value').eq('key', key).single()
      .then(({ data }) => { if (data?.value) setList(data.value as string[]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return list
}
