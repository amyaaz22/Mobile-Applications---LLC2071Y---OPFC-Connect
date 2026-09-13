'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { paymentStatusColor, formatDate, getCurrentMonth, getMonthLabel, monthlyFeeAmount, categoryColor } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { CheckCircle, Clock, Plus, X, Download, Wallet, Receipt } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useConfigList } from '@/hooks/useConfigList'

const FALLBACK_METHODS = ['Cash', 'Bank Transfer', 'Mobile Money', 'Other']

function RecordPaymentModal({ players, entryFee, feeFor, methods, onClose, onSaved }: {
  players: any[]; entryFee: number; feeFor: (cat: string) => number; methods: string[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    player_id: '', type: 'monthly', month: getCurrentMonth(),
    amount: '', method: 'Cash', status: 'paid', notes: '', reference: '',
  })
  const [saving, setSaving] = useState(false)
  const player = players.find(p => p.id === form.player_id)

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function onTypeOrPlayerChange(nextType: string, nextPlayerId: string) {
    const p = players.find(pl => pl.id === nextPlayerId) ?? player
    const amount = nextType === 'entry' ? entryFee : nextType === 'monthly' && p ? feeFor(p.category) : ''
    setForm(f => ({ ...f, type: nextType, player_id: nextPlayerId, amount: amount ? String(amount) : f.amount }))
  }

  async function save() {
    if (!form.player_id) { toast.error('Select a player'); return }
    if (!form.amount || +form.amount <= 0) { toast.error('Enter an amount'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('payments').insert({
      player_id: form.player_id,
      type: form.type,
      month: form.type === 'monthly' ? form.month : null,
      amount: +form.amount,
      method: form.method,
      status: form.status,
      notes: form.notes || null,
      reference: form.reference || null,
      confirmed_by: form.status === 'paid' ? user?.id : null,
      confirmed_at: form.status === 'paid' ? new Date().toISOString() : null,
    })
    setSaving(false)
    if (error) { toast.error('Failed to record payment: ' + error.message); return }
    toast.success('Payment recorded!')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Record Payment</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={18}/></button>
        </div>

        <div>
          <label className="label mb-1.5 block">Player *</label>
          <select className="input" value={form.player_id} onChange={e => onTypeOrPlayerChange(form.type, e.target.value)}>
            <option value="">Select player…</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.category}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Type</label>
            <select className="input" value={form.type} onChange={e => onTypeOrPlayerChange(e.target.value, form.player_id)}>
              <option value="monthly">Monthly Fee</option>
              <option value="entry">Entry Fee</option>
              <option value="other">Other</option>
            </select>
          </div>
          {form.type === 'monthly' ? (
            <div>
              <label className="label mb-1.5 block">Month</label>
              <input type="month" className="input" value={form.month} onChange={e => set('month', e.target.value)}/>
            </div>
          ) : (
            <div>
              <label className="label mb-1.5 block">Method</label>
              <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
                {methods.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>

        {form.type === 'monthly' && (
          <div>
            <label className="label mb-1.5 block">Method</label>
            <select className="input" value={form.method} onChange={e => set('method', e.target.value)}>
              {methods.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Amount (Rs) *</label>
            <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0"/>
          </div>
          <div>
            <label className="label mb-1.5 block">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label mb-1.5 block">Transaction Reference (optional)</label>
          <input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="e.g. bank transfer ref, Juice transaction ID…"/>
        </div>

        <div>
          <label className="label mb-1.5 block">Note (optional)</label>
          <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Kit deposit, partial payment…"/>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Payment'}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [entryPayments, setEntryPayments] = useState<any[]>([])
  const [allPayments, setAllPayments] = useState<any[]>([])
  const [monthlyFees, setMonthlyFees] = useState<Record<string, number>>({})
  const [entryFee, setEntryFee] = useState(300)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(getCurrentMonth())
  const [tab, setTab] = useState<'grid' | 'ledger'>('grid')
  const [showModal, setShowModal] = useState(false)
  const [ledgerFilter, setLedgerFilter] = useState({ type: 'all', status: 'all' })
  const methods = useConfigList('payment_methods', FALLBACK_METHODS)

  useEffect(() => { fetchData() }, [month])
  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'fees').single()
      .then(({ data }) => {
        if (data?.value) {
          setMonthlyFees((data.value as any).monthly ?? {})
          setEntryFee((data.value as any).entry ?? 300)
        }
      })
    fetchLedger()
  }, [])

  function feeFor(category: string) {
    return monthlyFees[category] ?? monthlyFeeAmount(category)
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: ps }, { data: pays }, { data: entries }] = await Promise.all([
      supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name'),
      supabase.from('payments').select('*').eq('month', month).eq('type', 'monthly'),
      supabase.from('payments').select('*').eq('type', 'entry'),
    ])
    setPlayers(ps ?? [])
    setPayments(pays ?? [])
    setEntryPayments(entries ?? [])
    setLoading(false)
  }

  async function fetchLedger() {
    const { data } = await supabase
      .from('payments')
      .select('*, player:players(full_name, player_code, category)')
      .order('created_at', { ascending: false })
      .limit(500)
    setAllPayments(data ?? [])
  }

  function getPayment(playerId: string) {
    return payments.find(p => p.player_id === playerId)
  }
  function getEntryPayment(playerId: string) {
    return entryPayments.find(p => p.player_id === playerId)
  }

  async function markPaid(playerId: string, category: string, type: 'monthly' | 'entry' = 'monthly') {
    const { data: { user } } = await supabase.auth.getUser()
    const existingPayment = type === 'monthly' ? getPayment(playerId) : getEntryPayment(playerId)
    if (existingPayment) {
      await supabase.from('payments').update({ status: 'paid', confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq('id', existingPayment.id)
    } else {
      await supabase.from('payments').insert({
        player_id: playerId, type,
        month: type === 'monthly' ? month : null,
        amount: type === 'monthly' ? feeFor(category) : entryFee,
        status: 'paid', confirmed_by: user?.id, confirmed_at: new Date().toISOString(),
      })
    }
    toast.success('Marked as paid')
    fetchData(); fetchLedger()
  }

  async function markPending(playerId: string, type: 'monthly' | 'entry' = 'monthly') {
    const p = type === 'monthly' ? getPayment(playerId) : getEntryPayment(playerId)
    if (!p) return
    await supabase.from('payments').update({ status: 'pending', confirmed_by: null, confirmed_at: null }).eq('id', p.id)
    toast.success('Reset to pending')
    fetchData(); fetchLedger()
  }

  function exportLedger() {
    const rows = allPayments.map((p: any) => ({
      'Date': formatDate(p.created_at),
      'Player': p.player?.full_name ?? '',
      'Player Code': p.player?.player_code ?? '',
      'Category': p.player?.category ?? '',
      'Type': p.type,
      'Month': p.month ?? '',
      'Amount (Rs)': p.amount,
      'Method': p.method ?? '',
      'Reference': p.reference ?? '',
      'Status': p.status,
      'Notes': p.notes ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Payments')
    XLSX.writeFile(wb, `OPFC_Payments_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} payments exported`)
  }

  const filteredLedger = useMemo(() => allPayments.filter(p =>
    (ledgerFilter.type === 'all' || p.type === ledgerFilter.type) &&
    (ledgerFilter.status === 'all' || p.status === ledgerFilter.status)
  ), [allPayments, ledgerFilter])

  const paid = players.filter(p => getPayment(p.id)?.status === 'paid').length
  const pending = players.length - paid
  const entriesOutstanding = players.filter(p => getEntryPayment(p.id)?.status !== 'paid').length
  const totalCollected = allPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-white/30 text-sm mt-1">Track entry fees, monthly fees, and one-off payments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16}/> Record Payment
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-green-400">{paid}</div>
          <div className="text-white/40 text-xs mt-1">Paid this month</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-amber-400">{pending}</div>
          <div className="text-white/40 text-xs mt-1">Pending this month</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-red-400/80">{entriesOutstanding}</div>
          <div className="text-white/40 text-xs mt-1">Entry fees outstanding</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-teal-400">Rs {totalCollected.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">Total collected</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('grid')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'grid' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <Wallet size={14}/> By Player
        </button>
        <button onClick={() => setTab('ledger')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'ledger' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <Receipt size={14}/> All Payments
        </button>
      </div>

      {tab === 'grid' ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-white font-bold">{getMonthLabel(month)}</h2>
            <input type="month" className="input w-auto" value={month} onChange={e => setMonth(e.target.value)}/>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
              Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Player', 'Category', 'Entry Fee', 'Monthly Fee', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => {
                    const pay = getPayment(p.id)
                    const status = pay?.status ?? 'pending'
                    const entryPay = getEntryPayment(p.id)
                    const entryStatus = entryPay?.status ?? 'pending'
                    return (
                      <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white text-sm">{p.full_name}</div>
                          <div className="text-white/30 text-xs font-mono">{p.player_code}</div>
                        </td>
                        <td className="px-4 py-3"><span className={`badge text-xs ${categoryColor(p.category)}`}>{p.category}</span></td>
                        <td className="px-4 py-3">
                          <button onClick={() => entryStatus === 'paid' ? markPending(p.id, 'entry') : markPaid(p.id, p.category, 'entry')}
                            className={`badge text-xs cursor-pointer ${paymentStatusColor(entryStatus)}`}>
                            {entryStatus === 'paid' ? '✓ Paid' : `Rs ${entryFee}`}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => status === 'paid' ? markPending(p.id, 'monthly') : markPaid(p.id, p.category, 'monthly')}
                            className={`badge text-xs cursor-pointer ${paymentStatusColor(status)}`}>
                            {status === 'paid' ? '✓ Paid' : `Rs ${feeFor(p.category)}`}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {status !== 'paid' ? (
                            <button onClick={() => markPaid(p.id, p.category, 'monthly')}
                              className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs font-medium transition-colors">
                              <CheckCircle size={13}/> Mark month paid
                            </button>
                          ) : (
                            <button onClick={() => markPending(p.id, 'monthly')}
                              className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-xs transition-colors">
                              <Clock size={13}/> Reset
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <select className="input w-auto text-sm" value={ledgerFilter.type} onChange={e => setLedgerFilter(f => ({ ...f, type: e.target.value }))}>
                <option value="all">All types</option>
                <option value="entry">Entry</option>
                <option value="monthly">Monthly</option>
                <option value="other">Other</option>
              </select>
              <select className="input w-auto text-sm" value={ledgerFilter.status} onChange={e => setLedgerFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <button onClick={exportLedger} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14}/> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date', 'Player', 'Type', 'Month', 'Amount', 'Method', 'Reference', 'Status', 'Notes'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-white/30">No payments recorded yet</td></tr>
                ) : filteredLedger.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white text-sm">{p.player?.full_name ?? '—'}</div>
                      <div className="text-white/30 text-xs font-mono">{p.player?.player_code}</div>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm capitalize">{p.type}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{p.month ?? '—'}</td>
                    <td className="px-4 py-3 text-white font-semibold text-sm whitespace-nowrap">Rs {p.amount}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-white/40 text-xs font-mono max-w-[140px] truncate">{p.reference ?? '—'}</td>
                    <td className="px-4 py-3"><span className={`badge text-xs ${paymentStatusColor(p.status)}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-white/40 text-xs max-w-[180px] truncate">{p.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <RecordPaymentModal
          players={players} entryFee={entryFee} feeFor={feeFor} methods={methods}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData(); fetchLedger() }}
        />
      )}
    </div>
  )
}
