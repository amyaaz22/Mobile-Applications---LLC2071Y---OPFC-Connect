'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, Download, Upload, Receipt } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useConfigList } from '@/hooks/useConfigList'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'

const FALLBACK_CATEGORIES = ['Equipment', 'Referee Fees', 'Transport', 'Medical', 'Venue / Pitch Hire', 'Administration', 'Other']

export default function ExpensesPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const permitted = usePermissionGuard('finance')
  const CATEGORIES = useConfigList('expense_categories', FALLBACK_CATEGORIES)
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], category: 'Equipment',
    description: '', amount: '', paid_by: '', notes: '',
  })

  useEffect(() => { fetchExpenses() }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }

  async function addExpense() {
    if (!form.description.trim() || !form.amount || +form.amount <= 0) { toast.error('Description and amount are required'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('expenses').insert({ ...form, amount: +form.amount, created_by: user?.id })
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Expense recorded')
    setForm({ date: new Date().toISOString().split('T')[0], category: 'Equipment', description: '', amount: '', paid_by: '', notes: '' })
    setShowForm(false)
    fetchExpenses()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    toast.success('Deleted')
    fetchExpenses()
  }

  function exportExcel() {
    const rows = filtered.map(e => ({
      'Date': e.date, 'Category': e.category, 'Description': e.description,
      'Amount (Rs)': e.amount, 'Paid By': e.paid_by ?? '', 'Notes': e.notes ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 32 }, { wch: 12 }, { wch: 18 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, `OPFC_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} expenses exported`)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws) as any[]
      const { data: { user } } = await supabase.auth.getUser()
      const records = json
        .filter(r => r['Description'] && r['Amount (Rs)'])
        .map(r => ({
          date: r['Date'] || new Date().toISOString().split('T')[0],
          category: CATEGORIES.includes(r['Category']) ? r['Category'] : 'Other',
          description: String(r['Description']),
          amount: Number(r['Amount (Rs)']),
          paid_by: r['Paid By'] || null,
          notes: r['Notes'] || null,
          created_by: user?.id,
        }))
      if (!records.length) { toast.error('No valid rows found'); return }
      const { error } = await supabase.from('expenses').insert(records)
      if (error) { toast.error('Import failed: ' + error.message); return }
      toast.success(`${records.length} expenses imported`)
      if (fileRef.current) fileRef.current.value = ''
      fetchExpenses()
    }
    reader.readAsBinaryString(file)
  }

  const filtered = useMemo(() =>
    categoryFilter === 'All' ? expenses : expenses.filter(e => e.category === categoryFilter)
  , [expenses, categoryFilter])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const totalThisMonth = expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0)
  const totalAllTime = expenses.reduce((s, e) => s + e.amount, 0)

  if (!permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-white/30 text-sm mt-1">Referee fees, transport, equipment, and everything the club spends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14}/> Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport}/>
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Export
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14}/> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-amber-400">Rs {totalThisMonth.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">This month</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-white">Rs {totalAllTime.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">All time</div>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 space-y-4">
          <h2 className="text-white font-bold">Record Expense</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Date</label>
              <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
            </div>
            <div>
              <label className="label mb-1.5 block">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">Description *</label>
            <input className="input" placeholder="e.g. Match balls (x6)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Amount (Rs) *</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}/>
            </div>
            <div>
              <label className="label mb-1.5 block">Paid By</label>
              <input className="input" placeholder="e.g. Amyaaz, Club account" value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}/>
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
          </div>
          <div className="flex gap-3">
            <button onClick={addExpense} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Expense'}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${categoryFilter === c ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/30 gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-white/30">
            <Receipt size={40} className="mx-auto mb-3 opacity-30"/>
            <p>No expenses recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date', 'Category', 'Description', 'Amount', 'Paid By', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3"><span className="badge bg-white/5 text-white/50 border-white/10 text-xs">{e.category}</span></td>
                    <td className="px-4 py-3">
                      <div className="text-white text-sm">{e.description}</div>
                      {e.notes && <div className="text-white/30 text-xs">{e.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-white font-semibold text-sm whitespace-nowrap">Rs {e.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{e.paid_by ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteExpense(e.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
