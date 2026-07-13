'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-navy-900 font-black text-lg font-condensed">OPFC</span>
          </div>
          <h1 className="text-3xl font-black font-condensed text-white">Create Account</h1>
          <p className="text-white/40 text-sm mt-1">OPFC Connect</p>
        </div>

        <div className="card p-6">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle className="text-teal-400 mx-auto mb-4" size={48}/>
              <h2 className="text-white font-bold text-lg mb-2">Account created!</h2>
              <p className="text-white/50 text-sm mb-2">
                Check your email to confirm your account.
              </p>
              <p className="text-white/30 text-xs mb-6">
                Note: A coach will need to set your role (parent/player) before you can access the portal.
              </p>
              <Link href="/login" className="btn-primary inline-flex items-center gap-2">
                <ArrowLeft size={16}/> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-6">New Account</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label mb-1.5 block">Full Name</label>
                  <input className="input" required placeholder="Your full name"
                    value={form.name} onChange={e => set('name', e.target.value)}/>
                </div>
                <div>
                  <label className="label mb-1.5 block">Email Address</label>
                  <input type="email" className="input" required placeholder="your@email.com"
                    value={form.email} onChange={e => set('email', e.target.value)}/>
                </div>
                <div>
                  <label className="label mb-1.5 block">Password</label>
                  <input type="password" className="input" required placeholder="Min. 6 characters"
                    value={form.password} onChange={e => set('password', e.target.value)}/>
                </div>
                <div>
                  <label className="label mb-1.5 block">Confirm Password</label>
                  <input type="password" className="input" required placeholder="Re-enter password"
                    value={form.confirm} onChange={e => set('confirm', e.target.value)}/>
                </div>
                <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <Link href="/login" className="text-white/40 text-sm hover:text-white transition-colors">
                  Already have an account? Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
