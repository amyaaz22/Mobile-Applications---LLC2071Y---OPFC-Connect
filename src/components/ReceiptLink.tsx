'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Paperclip } from 'lucide-react'

// `path` is the object path inside the private 'receipts' bucket (not a
// public URL) — a fresh signed URL is generated on click so it never goes stale.
export default function ReceiptLink({ path }: { path: string }) {
  const supabase = createClient()
  const [opening, setOpening] = useState(false)

  async function open() {
    setOpening(true)
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
    setOpening(false)
    if (error || !data) { toast.error('Could not open receipt'); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <button onClick={open} disabled={opening}
      className="flex items-center gap-1 text-teal-400/80 hover:text-teal-300 text-xs transition-colors">
      <Paperclip size={12}/> {opening ? 'Opening…' : 'Receipt'}
    </button>
  )
}
