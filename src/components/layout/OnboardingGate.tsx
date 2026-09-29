'use client'
import { useEffect, useState } from 'react'
import { usePWA } from '@/hooks/usePWA'
import { Download, Bell, CheckCircle2, Share } from 'lucide-react'

// One-time, blocking onboarding step shown right after a user first reaches
// their dashboard — asks them to install the app and enable notifications
// before continuing. Tracked per-browser in localStorage (there's no
// reliable cross-platform signal for "did they actually install", so this
// is the honest version of "mandatory": every account sees it once per
// device, and can't reach the dashboard without acting on both steps —
// but on iOS/browsers with no install API, "acting on" the install step
// means self-confirming they followed the manual instructions, since no
// JS API can trigger or detect an iOS home-screen install.
const STORAGE_KEY = 'opfc_onboarded_v1'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}
function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isInstallable, installApp } = usePWA()
  const [ready, setReady] = useState(false)
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [installDone, setInstallDone] = useState(false)
  const [notifStatus, setNotifStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default')

  useEffect(() => {
    let alreadyOnboarded = false
    try { alreadyOnboarded = localStorage.getItem(STORAGE_KEY) === '1' } catch { /* private browsing */ }
    const standalone = isStandalone()
    if (standalone) setInstallDone(true)
    setNotifStatus(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission as any : 'unsupported')
    setShow(!alreadyOnboarded && !standalone)
    setReady(true)
  }, [])

  async function handleInstall() {
    if (isInstallable) {
      await installApp()
    }
    setInstallDone(true)
  }

  async function handleNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) { setNotifStatus('unsupported'); finish(); return }
    const perm = await Notification.requestPermission()
    setNotifStatus(perm as any)
    finish()
  }

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* private browsing */ }
    setShow(false)
  }

  if (!ready || !show) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-teal-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#0D1B2A] font-black text-lg font-condensed">OPFC</span>
          </div>
          <h1 className="text-2xl font-black font-condensed text-white">Get the Full Experience</h1>
          <p className="text-white/40 text-sm mt-1">Two quick steps before you continue</p>
        </div>

        <div className="flex gap-2 mb-5">
          {['Install App', 'Notifications'].map((label, i) => (
            <div key={i} className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold text-center border transition-all
              ${step === i + 1 ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                : step > i + 1 ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'border-white/10 text-white/30'}`}>
              {step > i + 1 ? '✓ ' : `${i + 1}. `}{label}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="card p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center mx-auto mb-4">
              <Download className="text-teal-400" size={26}/>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Install OPFC Connect</h2>
            <p className="text-white/50 text-sm mb-5">
              Add the app to your home screen for one-tap access, offline attendance scanning, and a faster experience.
            </p>

            {installDone ? (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium mb-5">
                <CheckCircle2 size={16}/> Ready to go
              </div>
            ) : isInstallable ? (
              <button onClick={handleInstall} className="btn-primary w-full mb-5 flex items-center justify-center gap-2">
                <Download size={16}/> Install Now
              </button>
            ) : isIOS() ? (
              <div className="text-left bg-white/5 rounded-xl p-4 mb-5 space-y-2">
                <p className="text-white/70 text-xs flex items-center gap-2">
                  <Share size={14} className="text-teal-400 flex-shrink-0"/> 1. Tap the <b className="text-white">Share</b> icon in Safari
                </p>
                <p className="text-white/70 text-xs">2. Scroll down and tap <b className="text-white">Add to Home Screen</b></p>
              </div>
            ) : (
              <div className="text-left bg-white/5 rounded-xl p-4 mb-5">
                <p className="text-white/70 text-xs">Open your browser menu and choose <b className="text-white">Install app</b> (or <b className="text-white">Add to Home Screen</b>).</p>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!installDone && isInstallable}
              className="btn-secondary w-full">
              {installDone ? 'Next: Notifications →' : "I've added it to my home screen →"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="card p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center mx-auto mb-4">
              <Bell className="text-teal-400" size={26}/>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Enable Notifications</h2>
            <p className="text-white/50 text-sm mb-5">
              Stay on top of new announcements, payment reminders, and session updates.
            </p>

            {notifStatus === 'granted' && (
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium mb-5">
                <CheckCircle2 size={16}/> Notifications enabled
              </div>
            )}
            {notifStatus === 'denied' && (
              <p className="text-amber-300/70 text-xs mb-5">
                Notifications are blocked — you can turn them on later from your browser's site settings.
              </p>
            )}
            {notifStatus === 'unsupported' && (
              <p className="text-white/30 text-xs mb-5">Notifications aren't supported in this browser.</p>
            )}

            {notifStatus === 'default' ? (
              <button onClick={handleNotifications} className="btn-primary w-full flex items-center justify-center gap-2">
                <Bell size={16}/> Allow Notifications
              </button>
            ) : (
              <button onClick={finish} className="btn-primary w-full">
                Continue to Dashboard →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
