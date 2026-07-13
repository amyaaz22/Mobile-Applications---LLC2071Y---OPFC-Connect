'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Hard reload to root — server will read session and redirect to correct dashboard
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-400/30">
            <span className="text-[#0D1B2A] font-black text-lg">OPFC</span>
          </div>
          <h1 className="text-3xl font-black font-condensed text-white tracking-wide">OPFC CONNECT</h1>
          <p className="text-white/40 text-sm mt-1">Oasis Pailles Football Club</p>
        </div>

        <div className="card p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Sign In</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label mb-1.5 block">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-16"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-sm transition-colors"
                  onClick={() => setShowPass(s => !s)}
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#0D1B2A]/30 border-t-[#0D1B2A] rounded-full animate-spin"/>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-teal-400 hover:underline">
              Forgot password?
            </Link>
            <Link href="/register" className="text-white/40 hover:text-white transition-colors">
              Create account
            </Link>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6 italic">Omnis Tactus, Officium</p>
      </div>
    </div>
  )
}
