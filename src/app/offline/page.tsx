export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-teal-400/10 border border-teal-400/20 flex items-center justify-center mx-auto mb-6">
          <span style={{ fontSize: 36 }}>📡</span>
        </div>
        <h1 className="text-2xl font-black font-condensed text-white mb-2">You're Offline</h1>
        <p className="text-white/40 text-sm mb-6 leading-relaxed">
          No internet connection detected. The QR scanner will still work — 
          attendance records will sync automatically when you're back online.
        </p>
        <div className="card p-4 text-left mb-6">
          <p className="text-teal-400 text-xs font-bold mb-2">AVAILABLE OFFLINE</p>
          <div className="space-y-1.5">
            {['QR Attendance Scanner', 'Cached player list', 'Previously loaded pages'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-green-400 text-xs">✓</span>
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary w-full"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
