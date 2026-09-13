'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Receipt, HeartHandshake, ArrowRight } from 'lucide-react'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#112233] border border-white/10 rounded-xl px-3 py-2 text-sm shadow-xl">
      {label && <p className="text-white/50 text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#4EC6C6' }} className="font-semibold">
          {p.name ? `${p.name}: ` : ''}Rs {p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  )
}

const EXPENSE_PALETTE = ['#f97316', '#a855f7', '#4EC6C6', '#f5a623', '#38bdf8', '#f472b6', '#94a3b8']

function monthKey(d: string) { return d?.slice(0, 7) }
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(+y, +m - 1).toLocaleDateString('en', { month: 'short' })
}

export default function FinancePage() {
  const supabase = createClient()
  const permitted = usePermissionGuard('finance')
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [income, setIncome] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: i }, { data: e }] = await Promise.all([
      supabase.from('payments').select('amount, status, confirmed_at').eq('status', 'paid'),
      supabase.from('income').select('amount, date, source'),
      supabase.from('expenses').select('amount, date, category'),
    ])
    setPayments(p ?? [])
    setIncome(i ?? [])
    setExpenses(e ?? [])
    setLoading(false)
  }

  if (loading || !permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  const thisMonth = new Date().toISOString().slice(0, 7)
  const feesThisMonth = payments.filter(p => monthKey(p.confirmed_at) === thisMonth).reduce((s, p) => s + p.amount, 0)
  const incomeThisMonth = income.filter(i => monthKey(i.date) === thisMonth).reduce((s, i) => s + i.amount, 0)
  const expensesThisMonth = expenses.filter(e => monthKey(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0)
  const netThisMonth = feesThisMonth + incomeThisMonth - expensesThisMonth

  const feesAllTime = payments.reduce((s, p) => s + p.amount, 0)
  const incomeAllTime = income.reduce((s, i) => s + i.amount, 0)
  const expensesAllTime = expenses.reduce((s, e) => s + e.amount, 0)
  const balance = feesAllTime + incomeAllTime - expensesAllTime

  // Last 6 months trend
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const trend = months.map(m => ({
    month: monthLabel(m),
    'In': payments.filter(p => monthKey(p.confirmed_at) === m).reduce((s, p) => s + p.amount, 0)
      + income.filter(i => monthKey(i.date) === m).reduce((s, i) => s + i.amount, 0),
    'Out': expenses.filter(e => monthKey(e.date) === m).reduce((s, e) => s + e.amount, 0),
  }))

  // Expense breakdown by category (all time)
  const byCategory: Record<string, number> = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount })
  const categoryData = Object.entries(byCategory).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Finance</h1>
        <p className="text-white/30 text-sm mt-1">Player fees, donations, and expenses in one place</p>
      </div>

      {/* Balance + this month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-white/40 text-sm">Club Balance</p>
          <p className={`text-3xl font-black font-condensed mt-1 ${balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
            Rs {balance.toLocaleString()}
          </p>
          <p className="text-white/20 text-xs mt-1">All time</p>
        </div>
        <div className="card p-5">
          <p className="text-white/40 text-sm">This Month</p>
          <p className={`text-3xl font-black font-condensed mt-1 ${netThisMonth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netThisMonth >= 0 ? '+' : ''}Rs {netThisMonth.toLocaleString()}
          </p>
          <p className="text-white/20 text-xs mt-1">Net</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-green-400"><TrendingUp size={16}/><p className="text-sm">In</p></div>
          <p className="text-2xl font-black font-condensed text-white mt-1">Rs {(feesThisMonth + incomeThisMonth).toLocaleString()}</p>
          <p className="text-white/20 text-xs mt-1">Fees + donations, this month</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-red-400"><TrendingDown size={16}/><p className="text-sm">Out</p></div>
          <p className="text-2xl font-black font-condensed text-white mt-1">Rs {expensesThisMonth.toLocaleString()}</p>
          <p className="text-white/20 text-xs mt-1">Expenses, this month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Cash Flow — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Line type="monotone" dataKey="In" stroke="#4ADE80" strokeWidth={2} dot={{ r: 3 }}/>
              <Line type="monotone" dataKey="Out" stroke="#F2685F" strokeWidth={2} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expense breakdown */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Expenses by Category</h2>
          {categoryData.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-16">No expenses recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} width={100}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {categoryData.map((entry, i) => (
                    <Cell key={entry.name} fill={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/coach/payments" className="card card-hover p-5 flex items-center justify-between group">
          <div>
            <p className="text-white font-semibold text-sm">Player Payments</p>
            <p className="text-white/30 text-xs mt-1">Entry &amp; monthly fees</p>
          </div>
          <Wallet size={20} className="text-teal-400"/>
        </Link>
        <Link href="/coach/income" className="card card-hover p-5 flex items-center justify-between group">
          <div>
            <p className="text-white font-semibold text-sm">Income &amp; Donations</p>
            <p className="text-white/30 text-xs mt-1">Sponsors, fundraisers</p>
          </div>
          <HeartHandshake size={20} className="text-green-400"/>
        </Link>
        <Link href="/coach/expenses" className="card card-hover p-5 flex items-center justify-between group">
          <div>
            <p className="text-white font-semibold text-sm">Expenses</p>
            <p className="text-white/30 text-xs mt-1">Everything the club spends</p>
          </div>
          <Receipt size={20} className="text-amber-400"/>
        </Link>
      </div>
    </div>
  )
}
