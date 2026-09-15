'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getMonthLabel, paymentStatusColor } from '@/lib/utils'
import { Receipt, Wallet, HeartHandshake, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'

type Transaction = {
  id: string
  date: string
  kind: 'payment' | 'donation'
  description: string
  amount: number
  status: string
  method?: string | null
  reference?: string | null
}

export default function ParentStatementPage() {
  const [player, setPlayer] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: guardian } = await supabase.from('guardians').select('player:players(id, full_name, player_code, category)').eq('profile_id', user.id).single()
      const p = Array.isArray(guardian?.player) ? guardian?.player[0] : guardian?.player
      setPlayer(p ?? null)

      const [{ data: payments }, { data: donations }] = await Promise.all([
        p?.id
          ? supabase.from('payments').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('income').select('*').eq('donor_profile_id', user.id).order('date', { ascending: false }),
      ])

      const paymentTx: Transaction[] = (payments ?? []).map((pay: any) => ({
        id: pay.id,
        date: pay.created_at,
        kind: 'payment',
        description: pay.type === 'entry' ? 'Entry Fee'
          : pay.type === 'monthly' ? `Monthly Fee — ${getMonthLabel(pay.month)}`
          : pay.notes || 'Other Payment',
        amount: pay.amount,
        status: pay.status,
        method: pay.method,
        reference: pay.reference,
      }))

      const donationTx: Transaction[] = (donations ?? []).map((d: any) => ({
        id: d.id,
        date: d.date,
        kind: 'donation',
        description: d.source && d.source !== 'Donation' ? `Donation — ${d.source}` : 'Donation',
        amount: d.amount,
        status: 'received',
      }))

      setTransactions([...paymentTx, ...donationTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setLoading(false)
    }
    load()
  }, [])

  function exportExcel() {
    const rows = transactions.map(t => ({
      'Date': formatDate(t.date), 'Description': t.description,
      'Amount (Rs)': t.amount, 'Status': t.status, 'Method': t.method ?? '', 'Reference': t.reference ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Statement')
    XLSX.writeFile(wb, `OPFC_Statement_${player?.player_code ?? 'account'}.xlsx`)
    toast.success('Statement exported')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
    </div>
  )

  const outstanding = transactions.filter(t => t.kind === 'payment' && t.status !== 'paid').reduce((s, t) => s + t.amount, 0)
  const totalPaid = transactions.filter(t => t.kind === 'payment' && t.status === 'paid').reduce((s, t) => s + t.amount, 0)
  const totalDonated = transactions.filter(t => t.kind === 'donation').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Statement of Account</h1>
          <p className="text-white/30 text-sm mt-1">
            {player ? `${player.full_name} · ${player.player_code}` : 'Fees, payments, and contributions'}
          </p>
        </div>
        {transactions.length > 0 && (
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Export
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 my-6">
        <div className="card p-4 text-center">
          <div className={`text-2xl font-black font-condensed ${outstanding > 0 ? 'text-amber-400' : 'text-green-400'}`}>Rs {outstanding.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">Outstanding</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-white">Rs {totalPaid.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">Total Paid</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-teal-400">Rs {totalDonated.toLocaleString()}</div>
          <div className="text-white/40 text-xs mt-1">Contributed</div>
        </div>
      </div>

      {!player ? (
        <div className="card p-12 text-center text-white/30">
          <Wallet size={40} className="mx-auto mb-3 opacity-30"/>
          <p>No player linked to your account yet.</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <Receipt size={40} className="mx-auto mb-3 opacity-30"/>
          <p>No fees or contributions recorded yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date', 'Description', 'Amount', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-white text-sm flex items-center gap-1.5">
                        {t.kind === 'donation' && <HeartHandshake size={13} className="text-teal-400 flex-shrink-0"/>}
                        {t.description}
                      </div>
                      {(t.method || t.reference) && (
                        <div className="text-white/30 text-xs mt-0.5">{[t.method, t.reference].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white font-semibold text-sm whitespace-nowrap">Rs {t.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${t.kind === 'donation' ? 'bg-teal-500/15 text-teal-300 border-teal-500/25' : paymentStatusColor(t.status)}`}>
                        {t.kind === 'donation' ? 'Thank you!' : t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
