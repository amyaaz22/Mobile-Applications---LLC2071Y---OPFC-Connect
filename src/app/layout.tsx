import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import PWAInit from '@/components/PWAInit'

export const metadata: Metadata = {
  title: 'OPFC Connect',
  description: 'Oasis Pailles Football Club — Academy Management System',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0D1B2A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWAInit/>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#112233', color: '#fff', border: '1px solid rgba(78,198,198,0.2)' },
            success: { iconTheme: { primary: '#4EC6C6', secondary: '#0D1B2A' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0D1B2A' } },
          }}
        />
      </body>
    </html>
  )
}
