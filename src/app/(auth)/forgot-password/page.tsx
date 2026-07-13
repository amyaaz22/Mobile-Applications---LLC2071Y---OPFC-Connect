'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-navy-900 font-black text-lg font-condensed">OPFC</span>
          </div>
          <h1 className="text-3xl font-black font-condensed text-white">Reset Password</h1>
          <p className="text-white/40 text-sm mt-1">OPFC Connect</p>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="text-teal-400 mx-auto mb-4" size={48}/>
              <h2 className="text-white font-bold text-lg mb-2">Check your email</h2>
              <p className="text-white/50 text-sm mb-6">
                We sent a password reset link to <strong className="text-white">{email}</strong>.
                Check your inbox and follow the link.
              </p>
              <Link href="/login" className="btn-primary inline-flex items-center gap-2">
                <ArrowLeft size={16}/> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Forgot your password?</h2>
              <p className="text-white/40 text-sm mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <Link href="/login" className="text-white/40 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
                  <ArrowLeft size={14}/> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
