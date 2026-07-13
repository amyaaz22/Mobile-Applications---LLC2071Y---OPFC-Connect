'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { paymentStatusColor, formatDate, getCurrentMonth, getMonthLabel, monthlyFeeAmount } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { CheckCircle, Clock, AlertTriangle, Plus } from 'lucide-react'

export default function PaymentsPage() {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(getCurrentMonth())

  useEffect(() => { fetchData() }, [month])

  async function fetchData() {
    setLoading(true)
    const { data: ps } = await supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name')
    const { data: pays } = await supabase.from('payments').select('*, confirmed_by_profile:profiles(full_name)').eq('month', month)
    setPlayers(ps ?? [])
    setPayments(pays ?? [])
    setLoading(false)
  }

  function getPayment(playerId: string) {
    return payments.find(p => p.player_id === playerId)
  }

  async function markPaid(playerId: string, category: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const existingPayment = getPayment(playerId)
    if (existingPayment) {
      await supabase.from('payments').update({ status: 'paid', confirmed_by: user?.id, confirmed_at: new Date().toISOString() }).eq('id', existingPayment.id)
    } else {
      await supabase.from('payments').insert({
        player_id: playerId, type: 'monthly', month,
        amount: monthlyFeeAmount(category), status: 'paid',
        confirmed_by: user?.id, confirmed_at: new Date().toISOString(),
      })
    }
    toast.success('Marked as paid')
    fetchData()
  }

  async function markPending(playerId: string) {
    const p = getPayment(playerId)
    if (!p) return
    await supabase.from('payments').update({ status: 'pending', confirmed_by: null, confirmed_at: null }).eq('id', p.id)
    toast.success('Reset to pending')
    fetchData()
  }

  const paid = players.filter(p => getPayment(p.id)?.status === 'paid').length
  const pending = players.length - paid

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="page-title mb-2">Payments</h1>
      <p className="text-white/30 text-sm mb-6">Track monthly fees and entry payments</p>

      {/* Month selector + summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className="label mb-1.5 block">Month</label>
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)}/>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-green-400">{paid}</div>
          <div className="text-white/40 text-xs mt-1">Paid</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-black font-condensed text-amber-400">{pending}</div>
          <div className="text-white/40 text-xs mt-1">Pending</div>
        </div>
      </div>

      {/* Player payment table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-white font-bold">{getMonthLabel(month)} — Monthly Fees</h2>
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
                  {['Player', 'Category', 'Fee', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => {
                  const pay = getPayment(p.id)
                  const status = pay?.status ?? 'pending'
                  return (
                    <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{p.full_name}</div>
                        <div className="text-white/30 text-xs font-mono">{p.player_code}</div>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{p.category}</td>
                      <td className="px-4 py-3 text-white font-semibold text-sm">Rs {monthlyFeeAmount(p.category)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${paymentStatusColor(status)}`}>{status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {status !== 'paid' ? (
                          <button onClick={() => markPaid(p.id, p.category)}
                            className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
                            <CheckCircle size={14}/> Mark Paid
                          </button>
                        ) : (
                          <button onClick={() => markPending(p.id)}
                            className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm transition-colors">
                            <Clock size={14}/> Reset
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

      <p className="text-white/20 text-xs text-center mt-4">
        Payment gateway (Stripe / MCB Juice) will be integrated in Phase 2
      </p>
    </div>
  )
}
