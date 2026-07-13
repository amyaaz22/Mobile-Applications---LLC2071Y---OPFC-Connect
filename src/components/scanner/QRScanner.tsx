'use client'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface QRScannerProps {
  onScan: (playerId: string) => Promise<{ success: boolean; playerName: string; message?: string }>
  sessionId: string
}

interface ScanResult {
  type: 'success' | 'error' | 'already'
  playerName: string
  message?: string
}

export default function QRScanner({ onScan, sessionId }: QRScannerProps) {
  const scannerRef = useRef<any>(null)
  const [scanning, setScanning] = useState(true)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const cooldownRef = useRef(false)

  useEffect(() => {
    let scanner: any

    async function initScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            if (cooldownRef.current || processing) return
            cooldownRef.current = true

            // Parse QR — expect format: opfc://player/{id}
            const playerId = decodedText.startsWith('opfc://player/')
              ? decodedText.replace('opfc://player/', '')
              : decodedText

            setProcessing(true)
            try {
              const result = await onScan(playerId)
              setLastResult({
                type: result.success ? 'success' : 'error',
                playerName: result.playerName,
                message: result.message,
              })
            } catch {
              setLastResult({ type: 'error', playerName: 'Unknown', message: 'Failed to record attendance' })
            } finally {
              setProcessing(false)
            }

            // 3 second cooldown before next scan
            setTimeout(() => { cooldownRef.current = false }, 3000)
          },
          undefined
        )
      } catch (err) {
        console.error('Scanner error:', err)
      }
    }

    if (scanning) initScanner()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [scanning])

  function resetResult() {
    setLastResult(null)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Scanner viewport */}
      <div className="relative w-full max-w-sm">
        <div id="qr-reader" className="w-full rounded-2xl overflow-hidden bg-black" style={{ minHeight: 300 }}/>

        {/* Overlay when processing */}
        {processing && (
          <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
            <div className="text-teal-400 text-center">
              <RefreshCw className="animate-spin mx-auto mb-2" size={32}/>
              <p className="text-sm font-medium">Recording…</p>
            </div>
          </div>
        )}

        {/* Corner markers */}
        <div className="absolute inset-0 pointer-events-none">
          {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-6 h-6`}>
              <div className={`absolute w-full h-0.5 bg-teal-400 ${i < 2 ? 'top-0' : 'bottom-0'}`}/>
              <div className={`absolute h-full w-0.5 bg-teal-400 ${i % 2 === 0 ? 'left-0' : 'right-0'}`}/>
            </div>
          ))}
        </div>
      </div>

      {/* Result toast */}
      {lastResult && (
        <div className={`w-full max-w-sm p-4 rounded-2xl border flex items-start gap-3 transition-all
          ${lastResult.type === 'success'
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'}`}>
          {lastResult.type === 'success'
            ? <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20}/>
            : <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20}/>}
          <div className="flex-1">
            <p className={`font-bold text-sm ${lastResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
              {lastResult.type === 'success' ? '✓ Attendance Recorded' : '✕ Error'}
            </p>
            <p className="text-white/70 text-sm mt-0.5">{lastResult.playerName}</p>
            {lastResult.message && <p className="text-white/40 text-xs mt-1">{lastResult.message}</p>}
          </div>
          <button onClick={resetResult} className="text-white/30 hover:text-white/60 transition-colors text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-center text-white/30 text-sm max-w-xs">
        Point your camera at a player's attendance card QR code to record their presence.
        Each scan has a 3-second cooldown.
      </div>
    </div>
  )
}
