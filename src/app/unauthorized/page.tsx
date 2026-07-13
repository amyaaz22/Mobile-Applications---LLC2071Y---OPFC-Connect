import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-gradient">
      <div className="text-center max-w-sm">
        <ShieldOff className="text-red-400 mx-auto mb-4" size={56}/>
        <h1 className="text-2xl font-black font-condensed text-white mb-2">Access Denied</h1>
        <p className="text-white/40 text-sm mb-6">
          You don't have permission to view this page. Contact your coach if you think this is a mistake.
        </p>
        <Link href="/" className="btn-primary">Go to Dashboard</Link>
      </div>
    </div>
  )
}
