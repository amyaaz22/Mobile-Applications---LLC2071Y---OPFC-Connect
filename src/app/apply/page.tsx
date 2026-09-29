'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Plus, X, Users } from 'lucide-react'

// Public, unauthenticated self-service registration — replaces the club's
// Google Form. A guardian fills their own contact info once, then adds one
// repeated "child" block per player they're registering, instead of
// filling the whole form once per child. Submissions land in
// player_applications/player_application_children (see
// schema_v13_additions.sql), NOT directly in players/guardians — a coach
// reviews, edits if needed, and approves or rejects each child from
// /coach/registrations before it becomes a real player.
const FALLBACK_RELATIONSHIPS = ['Parent', 'Father', 'Mother', 'Uncle', 'Aunt', 'Sibling', 'Other']

type ChildDraft = {
  full_name: string
  date_of_birth: string
  school_grade: string
  medical_conditions: string
  takes_medication: string
}

function emptyChild(): ChildDraft {
  return { full_name: '', date_of_birth: '', school_grade: '', medical_conditions: '', takes_medication: '' }
}

export default function ApplyPage() {
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [guardian, setGuardian] = useState({
    guardian_name: '', relationship: 'Parent', phone_primary: '',
    phone_secondary: '', email: '', address_line1: '', address_line2: '',
  })
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()])

  const setG = (k: string, v: string) => setGuardian(g => ({ ...g, [k]: v }))
  const setC = (i: number, k: keyof ChildDraft, v: string) =>
    setChildren(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c))

  function addChild() { setChildren(cs => [...cs, emptyChild()]) }
  function removeChild(i: number) { setChildren(cs => cs.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // Generate the id client-side rather than reading it back via
    // .select() — an anonymous submitter has no SELECT access on
    // player_applications (by design: no one but the club's coaches can
    // browse other families' submissions), and Postgres RLS still
    // evaluates the table's SELECT policy for an INSERT ... RETURNING,
    // which would otherwise fail for an anon caller.
    const applicationId = crypto.randomUUID()
    const { error: ae } = await supabase.from('player_applications')
      .insert({ id: applicationId, ...guardian })
    if (ae) {
      toast.error('Could not submit — please check your connection and try again')
      setSubmitting(false)
      return
    }
    const { error: ce } = await supabase.from('player_application_children').insert(
      children.map(c => ({ ...c, application_id: applicationId }))
    )
    if (ce) {
      toast.error('Guardian info saved but player details failed — please contact the club')
      setSubmitting(false)
      return
    }
    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle className="text-teal-400 mx-auto mb-4" size={48}/>
          <h1 className="text-white font-bold text-xl mb-2">Registration received!</h1>
          <p className="text-white/50 text-sm mb-1">
            Thank you — {children.length > 1 ? `all ${children.length} players have` : 'your registration has'} been sent to Oasis Pailles Football Club for review.
          </p>
          <p className="text-white/30 text-xs mb-6">
            Our coaching staff will contact you on {guardian.phone_primary} once it's been vetted.
          </p>
          <button onClick={() => { setDone(false); setGuardian({ guardian_name: '', relationship: 'Parent', phone_primary: '', phone_secondary: '', email: '', address_line1: '', address_line2: '' }); setChildren([emptyChild()]) }}
            className="btn-secondary inline-flex items-center gap-2">
            Submit another registration
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-4 py-8" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#0D1B2A] font-black text-lg font-condensed">OPFC</span>
          </div>
          <h1 className="text-3xl font-black font-condensed text-white">Player Registration</h1>
          <p className="text-white/40 text-sm mt-1">Oasis Pailles Football Club</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="text-white font-bold">Parent / Guardian Information</h2>
            <div>
              <label className="label mb-1.5 block">Guardian Full Name *</label>
              <input className="input" required value={guardian.guardian_name} onChange={e => setG('guardian_name', e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Relationship *</label>
                <select className="input" value={guardian.relationship} onChange={e => setG('relationship', e.target.value)}>
                  {FALLBACK_RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Primary Phone (WhatsApp) *</label>
                <input className="input" required value={guardian.phone_primary} onChange={e => setG('phone_primary', e.target.value)} placeholder="5X XXX XXX"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Secondary Phone (Optional)</label>
                <input className="input" value={guardian.phone_secondary} onChange={e => setG('phone_secondary', e.target.value)}/>
              </div>
              <div>
                <label className="label mb-1.5 block">Email (Optional)</label>
                <input type="email" className="input" value={guardian.email} onChange={e => setG('email', e.target.value)} placeholder="parent@email.mu"/>
              </div>
            </div>
            <div>
              <label className="label mb-1.5 block">Address Line 1 *</label>
              <input className="input" required value={guardian.address_line1} onChange={e => setG('address_line1', e.target.value)} placeholder="Street, locality, Pailles"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Address Line 2 (Optional)</label>
              <input className="input" value={guardian.address_line2} onChange={e => setG('address_line2', e.target.value)}/>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <Users size={16} className="text-teal-400"/>
            <h2 className="text-white font-bold">Player{children.length > 1 ? 's' : ''} to Register</h2>
          </div>

          {children.map((child, i) => (
            <div key={i} className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white/70 font-semibold text-sm">Player {i + 1}</h3>
                {children.length > 1 && (
                  <button type="button" onClick={() => removeChild(i)}
                    className="text-white/30 hover:text-red-400 transition-colors p-1">
                    <X size={16}/>
                  </button>
                )}
              </div>
              <div>
                <label className="label mb-1.5 block">Full Name of Player *</label>
                <input className="input" required value={child.full_name} onChange={e => setC(i, 'full_name', e.target.value)}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Date of Birth *</label>
                  <input type="date" className="input" required value={child.date_of_birth} onChange={e => setC(i, 'date_of_birth', e.target.value)}/>
                </div>
                <div>
                  <label className="label mb-1.5 block">Class / Grade at School</label>
                  <input className="input" value={child.school_grade} onChange={e => setC(i, 'school_grade', e.target.value)} placeholder="e.g. Grade 5"/>
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Does the player have any allergies or medical conditions we should know of?</label>
                <input className="input" value={child.medical_conditions} onChange={e => setC(i, 'medical_conditions', e.target.value)} placeholder="No, or please describe"/>
              </div>
              <div>
                <label className="label mb-1.5 block">Does the player usually take any medication during or before physical activity?</label>
                <input className="input" value={child.takes_medication} onChange={e => setC(i, 'takes_medication', e.target.value)} placeholder="No, or please describe"/>
              </div>
            </div>
          ))}

          <button type="button" onClick={addChild}
            className="btn-secondary w-full flex items-center justify-center gap-2">
            <Plus size={16}/> Add Another Child
          </button>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : `Submit Registration${children.length > 1 ? ` (${children.length} players)` : ''}`}
          </button>

          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-white/30 hover:text-white text-sm transition-colors">
              <ArrowLeft size={14}/> Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
