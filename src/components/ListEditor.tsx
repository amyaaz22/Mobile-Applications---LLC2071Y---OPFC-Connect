'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export default function ListEditor({
  items, onChange, placeholder = 'Add option…',
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (!t || items.includes(t)) return
    onChange([...items, t])
    setDraft('')
  }

  function remove(item: string) {
    onChange(items.filter(x => x !== item))
  }

  function rename(old: string, next: string) {
    const t = next.trim()
    if (!t || t === old) return
    if (items.includes(t)) return
    onChange(items.map(x => x === old ? t : x))
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        {items.map(item => (
          <div key={item} className="flex items-center gap-3">
            <input
              className="input flex-1"
              defaultValue={item}
              onBlur={e => { if (e.target.value !== item) rename(item, e.target.value) }}
            />
            <button onClick={() => remove(item)}
              className="p-2 text-red-400/50 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
              <Trash2 size={15}/>
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-white/20 text-xs">No options yet — add one below.</p>}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}/>
        <button type="button" onClick={add} className="btn-secondary flex items-center gap-2 text-sm">
          <Plus size={14}/> Add
        </button>
      </div>
    </div>
  )
}
