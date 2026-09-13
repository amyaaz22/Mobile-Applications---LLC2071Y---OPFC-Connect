'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react'

interface CheckIn {
  name: string
  code: string
  time: Date
  success: boolean
  message?: string
}

export default function LiveScanner() {
  const params = useSearchParams()
  const sessionId = params.get('session')
  const token = params.get('token')
  const [session, setSession] = useState<any>(null)
  const [error, setError] = useState('')
  const [lastCheckin, setLastCheckin] = useState<CheckIn | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const cooldownRef = useRef(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))
    if (sessionId && token) loadSession()
  }, [sessionId, token])

  async function loadSession() {
    const res = await fetch(`/api/scan/verify?session=${sessionId}&token=${token}`)
    const data = await res.json()
    if (!data.session) { setError(data.error ?? 'Invalid scanner link'); return }
    setSession(data.session)
    setTimeout(() => initScanner(), 500)
  }

  async function initScanner() {
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        async (decodedText: string) => {
          if (cooldownRef.current) return
          cooldownRef.current = true
          const playerId = decodedText.startsWith('opfc://player/')
            ? decodedText.replace('opfc://player/', '')
            : decodedText
          await handleScan(playerId)
          setTimeout(() => { cooldownRef.current = false }, 3000)
        },
        undefined
      )
    } catch {
      setError('Camera access denied. Please allow camera access and refresh.')
    }
  }

  async function handleScan(playerId: string) {
    try {
      const res = await fetch('/api/scan/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, token, player_id: playerId }),
      })
      const data = await res.json()
      setLastCheckin({
        name: data.player_name ?? 'Unknown',
        code: data.player_code ?? '',
        time: new Date(),
        success: data.success,
        message: data.message,
      })
      if (data.success) setTotalCount(c => c + 1)
    } catch {
      setLastCheckin({ name: 'Error', code: '', time: new Date(), success: false, message: 'Network error' })
    }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="text-center">
        <XCircle size={48} className="text-red-400 mx-auto mb-4"/>
        <h1 className="text-white font-bold text-xl mb-2">Invalid Scanner Link</h1>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="animate-spin w-10 h-10 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-6" style={{ background: '#0D1B2A', maxWidth: 480, margin: '0 auto' }}>
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center">
            <span style={{ color: '#0D1B2A', fontWeight: 900, fontSize: 8 }}>OPFC</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">{session.title}</p>
            <p className="text-white/30 text-xs">{new Date(session.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {isOnline ? <Wifi size={10}/> : <WifiOff size={10}/>}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="bg-teal-400/10 border border-teal-400/20 px-3 py-1 rounded-lg">
            <span className="text-teal-400 font-bold text-sm">{totalCount} ✓</span>
          </div>
        </div>
      </div>

      <div className="relative w-full rounded-2xl overflow-hidden mb-4" style={{ background: '#000', minHeight: 300 }}>
        <div id="qr-reader" className="w-full"/>
        <div className="absolute inset-0 pointer-events-none">
          {(['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'] as const).map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-8 h-8`}>
              <div className={`absolute w-full h-0.5 bg-teal-400 ${i < 2 ? 'top-0' : 'bottom-0'}`}/>
              <div className={`absolute h-full w-0.5 bg-teal-400 ${i % 2 === 0 ? 'left-0' : 'right-0'}`}/>
            </div>
          ))}
        </div>
      </div>

      {lastCheckin && (
        <div className={`w-full p-4 rounded-2xl border mb-4 ${lastCheckin.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-3">
            {lastCheckin.success
              ? <CheckCircle size={28} className="text-green-400 flex-shrink-0"/>
              : <XCircle size={28} className="text-red-400 flex-shrink-0"/>
            }
            <div>
              <p className={`font-bold text-lg ${lastCheckin.success ? 'text-green-300' : 'text-red-300'}`}>
                {lastCheckin.success ? '✓ Checked In!' : '✕ Error'}
              </p>
              <p className="text-white font-semibold">{lastCheckin.name}</p>
              {lastCheckin.code && <p className="text-white/40 text-sm font-mono">{lastCheckin.code}</p>}
              {lastCheckin.message && <p className="text-white/40 text-xs mt-0.5">{lastCheckin.message}</p>}
            </div>
          </div>
        </div>
      )}

      <p className="text-white/20 text-xs text-center">Point camera at player QR card · 3s cooldown</p>
      <p className="text-white/10 text-xs text-center mt-1">OPFC Connect · Omnis Tactus, Officium</p>
    </div>
  )
}
