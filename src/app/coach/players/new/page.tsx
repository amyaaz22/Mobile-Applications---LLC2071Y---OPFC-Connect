'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewPlayerPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)

  const [player, setPlayer] = useState({
    full_name: '', date_of_birth: '', category: 'U9', position: 'FWD',
    nationality: 'Mauritian', school: '', address: '', medical_notes: ''
  })
  const [guardian, setGuardian] = useState({
    full_name: '', relationship: 'Father', phone_primary: '',
    phone_secondary: '', email: ''
  })

  function setP(k: string, v: string) { setPlayer(p => ({ ...p, [k]: v })) }
  function setG(k: string, v: string) { setGuardian(g => ({ ...g, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: newPlayer, error: pe } = await supabase.from('players').insert(player).select().single()
    if (pe || !newPlayer) { toast.error('Failed to create player'); setSaving(false); return }
    const { error: ge } = await supabase.from('guardians').insert({ ...guardian, player_id: newPlayer.id })
    if (ge) { toast.error('Player created but guardian failed'); setSaving(false); return }
    toast.success(`${player.full_name} registered!`)
    router.push(`/coach/players/${newPlayer.id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href="/coach/players" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Players
      </Link>
      <h1 className="page-title mb-2">Register New Player</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {['Player Info', 'Guardian Info', 'Confirm'].map((label, i) => (
          <div key={i} className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold text-center border transition-all
            ${step === i + 1 ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
              : step > i + 1 ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'border-white/10 text-white/30'}`}>
            {step > i + 1 ? '✓ ' : `${i + 1}. `}{label}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-white font-bold">Player Information</h2>
            <div>
              <label className="label mb-1.5 block">Full Name *</label>
              <input className="input" required value={player.full_name} onChange={e => setP('full_name', e.target.value)} placeholder="Full name of player"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Date of Birth *</label>
                <input type="date" className="input" required value={player.date_of_birth} onChange={e => setP('date_of_birth', e.target.value)}/>
              </div>
              <div>
                <label className="label mb-1.5 block">Nationality</label>
                <input className="input" value={player.nationality} onChange={e => setP('nationality', e.target.value)}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Category *</label>
                <select className="input" value={player.category} onChange={e => setP('category', e.target.value)}>
                  <option value="U9">U9</option>
                  <option value="U13">U13</option>
                  <option value="First Team">First Team</option>
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Position *</label>
                <select className="input" value={player.position} onChange={e => setP('position', e.target.value)}>
                  <option value="GK">GK — Goalkeeper</option>
                  <option value="DEF">DEF — Defender</option>
                  <option value="MID">MID — Midfielder</option>
                  <option value="FWD">FWD — Forward</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label mb-1.5 block">School / Grade</label>
              <input className="input" value={player.school} onChange={e => setP('school', e.target.value)} placeholder="e.g. Grade 6 — Raffray Government School"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Address</label>
              <input className="input" value={player.address} onChange={e => setP('address', e.target.value)} placeholder="Avenue…, Pailles"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Medical Notes</label>
              <textarea className="input resize-none" rows={2} value={player.medical_notes} onChange={e => setP('medical_notes', e.target.value)} placeholder="Allergies, conditions, medication…"/>
            </div>
            <button type="button" onClick={() => setStep(2)} disabled={!player.full_name || !player.date_of_birth}
              className="btn-primary w-full">Next: Guardian Info →</button>
          </div>
        )}

        {step === 2 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-white font-bold">Parent / Guardian Information</h2>
            <div>
              <label className="label mb-1.5 block">Guardian Full Name *</label>
              <input className="input" required value={guardian.full_name} onChange={e => setG('full_name', e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Relationship *</label>
                <select className="input" value={guardian.relationship} onChange={e => setG('relationship', e.target.value)}>
                  {['Father','Mother','Uncle','Aunt','Sibling','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Primary Phone (WhatsApp) *</label>
                <input className="input" required value={guardian.phone_primary} onChange={e => setG('phone_primary', e.target.value)} placeholder="5X XXX XXX"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Secondary Phone</label>
                <input className="input" value={guardian.phone_secondary} onChange={e => setG('phone_secondary', e.target.value)}/>
              </div>
              <div>
                <label className="label mb-1.5 block">Email (for player card)</label>
                <input type="email" className="input" value={guardian.email} onChange={e => setG('email', e.target.value)} placeholder="parent@email.mu"/>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
              <button type="button" onClick={() => setStep(3)} disabled={!guardian.full_name || !guardian.phone_primary}
                className="btn-primary flex-1">Review →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card p-6 space-y-5">
            <h2 className="text-white font-bold">Confirm Registration</h2>
            <div className="space-y-3">
              {[
                ['Player', player.full_name],
                ['Date of Birth', player.date_of_birth],
                ['Category', player.category],
                ['Position', player.position],
                ['Nationality', player.nationality],
                ['Guardian', guardian.full_name],
                ['Relationship', guardian.relationship],
                ['Phone', guardian.phone_primary],
                ['Email', guardian.email || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/40 text-sm">{label}</span>
                  <span className="text-white text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
            {player.medical_notes && (
              <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-xl">
                <p className="text-amber-300 text-xs font-bold">⚠ Medical Notes</p>
                <p className="text-white/70 text-sm mt-1">{player.medical_notes}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Registering…' : '✓ Register Player'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
