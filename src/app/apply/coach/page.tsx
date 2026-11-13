'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { useRegistrationWindow, RegistrationClosedNotice } from '@/components/RegistrationGate'

// Public, unauthenticated "apply to coach" form — same shape of flow as
// the player registration form at /apply: a submission lands in
// coach_applications (schema_v16_additions.sql), NOT directly as a staff
// account. A 'staff'-permitted admin reviews it from Staff & Parents →
// Applications and either rejects it or approves it, which sends the real
// invite via the existing /api/staff/invite route (same path "Invite
// Coach" already uses) rather than creating an account from here.
//
// Categories are a plain hardcoded fallback, not useConfigList — the live
// club_settings 'categories' list isn't anon-readable (its SELECT policy
// is `auth.uid() is not null`), same reason /apply hardcodes its
// relationship options instead of fetching them.
const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']

export default function ApplyCoachPage() {
  const supabase = createClient()
  const windowStatus = useRegistrationWindow('coach_registration')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', date_of_birth: '', address: '',
    categories_interested: [] as string[], qualifications: '', experience: '',
    availability: '', motivation: '',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  function toggleCategory(cat: string) {
    setForm(f => ({
      ...f,
      categories_interested: f.categories_interested.includes(cat)
        ? f.categories_interested.filter(c => c !== cat)
        : [...f.categories_interested, cat],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // Generate the id client-side rather than reading it back via
    // .select() — an anonymous submitter has no SELECT access on
    // coach_applications (only a 'staff'-permitted account does), and
    // Postgres RLS still evaluates the table's SELECT policy for an
    // INSERT ... RETURNING, which would otherwise fail for an anon
    // caller even though the insert itself succeeded. Same gotcha as
    // /apply — see CLAUDE.md "Player Registration" notes.
    const { error } = await supabase.from('coach_applications').insert({
      id: crypto.randomUUID(),
      ...form,
      date_of_birth: form.date_of_birth || null,
      categories_interested: form.categories_interested.length ? form.categories_interested : null,
    })
    if (error) {
      toast.error('Could not submit — please check your connection and try again')
      setSubmitting(false)
      return
    }
    setDone(true)
    setSubmitting(false)
  }

  if (windowStatus === null) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )
  if (!windowStatus.open) return <RegistrationClosedNotice status={windowStatus} title="Coach applications aren't open right now"/>

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle className="text-teal-400 mx-auto mb-4" size={48}/>
          <h1 className="text-white font-bold text-xl mb-2">Application received!</h1>
          <p className="text-white/50 text-sm mb-1">
            Thank you, {form.full_name.split(' ')[0] || 'coach'} — your application has been sent to Oasis Pailles Football Club for review.
          </p>
          <p className="text-white/30 text-xs mb-6">
            Our staff will contact you on {form.phone} once it's been reviewed.
          </p>
          <Link href="/login" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={14}/> Back to sign in
          </Link>
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
          <h1 className="text-3xl font-black font-condensed text-white">Coach Application</h1>
          <p className="text-white/40 text-sm mt-1">Oasis Pailles Football Club</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="text-white font-bold">Your Information</h2>
            <div>
              <label className="label mb-1.5 block">Full Name *</label>
              <input className="input" required value={form.full_name} onChange={e => set('full_name', e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Phone (WhatsApp) *</label>
                <input className="input" required value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="5X XXX XXX"/>
              </div>
              <div>
                <label className="label mb-1.5 block">Email *</label>
                <input type="email" className="input" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.mu"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Date of Birth</label>
                <input type="date" className="input" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/>
              </div>
              <div>
                <label className="label mb-1.5 block">Address</label>
                <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, locality, Pailles"/>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-white font-bold">Coaching Interest</h2>
            <div>
              <label className="label mb-2 block">Which categories would you like to coach?</label>
              <div className="flex gap-2 flex-wrap">
                {FALLBACK_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${form.categories_interested.includes(cat) ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/40 hover:text-white'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label mb-1.5 block">Coaching qualifications / certifications</label>
              <textarea className="input" rows={2} value={form.qualifications} onChange={e => set('qualifications', e.target.value)} placeholder="e.g. CAF C License, First Aid certified, none yet…"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Playing / coaching experience</label>
              <textarea className="input" rows={2} value={form.experience} onChange={e => set('experience', e.target.value)} placeholder="Clubs, years, age groups…"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Availability</label>
              <input className="input" value={form.availability} onChange={e => set('availability', e.target.value)} placeholder="e.g. Weekday evenings, Saturday mornings"/>
            </div>
            <div>
              <label className="label mb-1.5 block">Why do you want to coach at OPFC?</label>
              <textarea className="input" rows={3} value={form.motivation} onChange={e => set('motivation', e.target.value)}/>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Application'}
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
