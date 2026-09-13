import { Suspense } from 'react'
import LiveScanner from './LiveScanner'

export default function LiveScannerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
        <div className="animate-spin w-10 h-10 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
      </div>
    }>
      <LiveScanner/>
    </Suspense>
  )
}
