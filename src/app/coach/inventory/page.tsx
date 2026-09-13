'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, Edit3, Download, Upload, Package, AlertTriangle, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const CATEGORIES = ['Jerseys', 'Balls', 'Training Equipment', 'Goals & Nets', 'Medical Kit', 'Bibs & Cones', 'Other']
const CONDITIONS = ['New', 'Good', 'Worn', 'Damaged']

const conditionColor = (c: string) => ({
  New: 'bg-green-500/15 text-green-300 border-green-500/25',
  Good: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  Worn: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  Damaged: 'bg-red-500/15 text-red-300 border-red-500/25',
}[c] ?? 'bg-white/10 text-white/50 border-white/10')

const emptyForm = { name: '', category: 'Training Equipment', quantity: '1', condition: 'Good', location: '', assigned_to: '', min_stock: '0', notes: '' }

export default function InventoryPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: inv }, { data: ps }] = await Promise.all([
      supabase.from('inventory_items').select('*, player:players(full_name, player_code)').order('category').order('name'),
      supabase.from('players').select('id, full_name, player_code').eq('is_active', true).order('full_name'),
    ])
    setItems(inv ?? [])
    setPlayers(ps ?? [])
    setLoading(false)
  }

  function openNew() { setForm(emptyForm); setEditingId(null); setShowForm(true) }
  function openEdit(item: any) {
    setForm({
      name: item.name, category: item.category, quantity: String(item.quantity),
      condition: item.condition, location: item.location ?? '', assigned_to: item.assigned_to ?? '',
      min_stock: String(item.min_stock ?? 0), notes: item.notes ?? '',
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function saveItem() {
    if (!form.name.trim()) { toast.error('Item name is required'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), category: form.category, quantity: +form.quantity || 0,
      condition: form.condition, location: form.location || null,
      assigned_to: form.assigned_to || null, min_stock: +form.min_stock || 0,
      notes: form.notes || null,
    }
    const { error } = editingId
      ? await supabase.from('inventory_items').update(payload).eq('id', editingId)
      : await supabase.from('inventory_items').insert(payload)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success(editingId ? 'Item updated' : 'Item added')
    setShowForm(false)
    fetchAll()
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    toast.success('Deleted')
    fetchAll()
  }

  function exportExcel() {
    const rows = filtered.map(i => ({
      'Name': i.name, 'Category': i.category, 'Quantity': i.quantity, 'Condition': i.condition,
      'Location': i.location ?? '', 'Assigned To': i.player?.full_name ?? '', 'Min Stock': i.min_stock ?? 0, 'Notes': i.notes ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, `OPFC_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} items exported`)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws) as any[]
      const records = json
        .filter(r => r['Name'])
        .map(r => ({
          name: String(r['Name']),
          category: CATEGORIES.includes(r['Category']) ? r['Category'] : 'Other',
          quantity: Number(r['Quantity']) || 0,
          condition: CONDITIONS.includes(r['Condition']) ? r['Condition'] : 'Good',
          location: r['Location'] || null,
          min_stock: Number(r['Min Stock']) || 0,
          notes: r['Notes'] || null,
        }))
      if (!records.length) { toast.error('No valid rows found'); return }
      const { error } = await supabase.from('inventory_items').insert(records)
      if (error) { toast.error('Import failed: ' + error.message); return }
      toast.success(`${records.length} items imported`)
      if (fileRef.current) fileRef.current.value = ''
      fetchAll()
    }
    reader.readAsBinaryString(file)
  }

  const filtered = useMemo(() => items.filter(i =>
    (categoryFilter === 'All' || i.category === categoryFilter) &&
    (!lowStockOnly || i.quantity <= (i.min_stock ?? 0))
  ), [items, categoryFilter, lowStockOnly])

  const lowStockCount = items.filter(i => i.quantity <= (i.min_stock ?? 0)).length

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-white/30 text-sm mt-1">Kit, balls, cones — everything the club owns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14}/> Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport}/>
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Export
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14}/> Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-white">{items.length}</div>
          <div className="text-white/40 text-xs mt-1">Items tracked</div>
        </div>
        <button onClick={() => setLowStockOnly(v => !v)}
          className={`card p-4 text-center transition-all ${lowStockOnly ? 'border-amber-400/40 bg-amber-400/5' : ''}`}>
          <div className="text-2xl font-black font-condensed text-amber-400 flex items-center justify-center gap-1.5">
            {lowStockCount > 0 && <AlertTriangle size={18}/>}{lowStockCount}
          </div>
          <div className="text-white/40 text-xs mt-1">Low stock{lowStockOnly ? ' (showing)' : ''}</div>
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${categoryFilter === c ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold">{editingId ? 'Edit Item' : 'Add Item'}</h2>
            <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white p-1"><X size={16}/></button>
          </div>
          <div>
            <label className="label mb-1.5 block">Name *</label>
            <input className="input" placeholder="e.g. Match balls, U13 home jerseys" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Condition</label>
              <select className="input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Quantity</label>
              <input type="number" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}/>
            </div>
            <div>
              <label className="label mb-1.5 block">Low-stock alert below</label>
              <input type="number" className="input" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Location</label>
              <input className="input" placeholder="e.g. Equipment shed" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}/>
            </div>
            <div>
              <label className="label mb-1.5 block">Assigned to (optional)</label>
              <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Not assigned</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
          </div>
          <div className="flex gap-3">
            <button onClick={saveItem} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/30 gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-white/30">
            <Package size={40} className="mx-auto mb-3 opacity-30"/>
            <p>No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Item', 'Category', 'Qty', 'Condition', 'Location', 'Assigned', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const low = item.quantity <= (item.min_stock ?? 0)
                  return (
                    <tr key={item.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm font-medium">{item.name}</div>
                        {item.notes && <div className="text-white/30 text-xs">{item.notes}</div>}
                      </td>
                      <td className="px-4 py-3"><span className="badge bg-white/5 text-white/50 border-white/10 text-xs">{item.category}</span></td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold text-sm ${low ? 'text-amber-400' : 'text-white'}`}>{item.quantity}</span>
                        {low && <AlertTriangle size={12} className="inline ml-1.5 text-amber-400"/>}
                      </td>
                      <td className="px-4 py-3"><span className={`badge text-xs ${conditionColor(item.condition)}`}>{item.condition}</span></td>
                      <td className="px-4 py-3 text-white/50 text-xs">{item.location ?? '—'}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{item.player?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="text-white/20 hover:text-teal-400 transition-colors p-1">
                            <Edit3 size={14}/>
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
