'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface AttendanceChartProps {
  data: { label: string; present: number; total: number; rate: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#112233] border border-white/10 rounded-xl px-3 py-2 text-sm">
        <p className="text-white font-bold">{label}</p>
        <p className="text-teal-400">{payload[0]?.value}% attendance</p>
        <p className="text-white/40 text-xs">{payload[0]?.payload?.present}/{payload[0]?.payload?.total} sessions</p>
      </div>
    )
  }
  return null
}

export default function AttendanceChart({ data }: AttendanceChartProps) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-white/20 text-sm">No attendance data yet</div>
  )

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
        <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
        <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
        <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.rate >= 80 ? '#4EC6C6' : entry.rate >= 60 ? '#60a5fa' : '#f87171'}/>
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
