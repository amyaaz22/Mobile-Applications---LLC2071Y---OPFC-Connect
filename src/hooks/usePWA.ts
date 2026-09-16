'use client'
import { useEffect, useState } from 'react'

export interface OfflineAttendanceRecord {
  id: string
  session_id: string
  player_id: string
  player_name: string
  scanned_at: string
  status: 'present'
}

export function usePWA() {
  const [isOnline, setIsOnline] = useState(true)
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Online/offline detection
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }

    // Install prompt
    const handleInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handleInstall)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstall)
    }
  }, [])

  async function installApp() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  // Queue attendance record for offline sync
  async function queueOfflineAttendance(record: OfflineAttendanceRecord) {
    try {
      const db = await openDB()
      await addToQueue(db, record)
      // Register background sync
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        await (reg as any).sync.register('sync-attendance')
      }
    } catch (e) {
      console.error('Failed to queue offline record', e)
    }
  }

  // Get all queued offline records
  async function getOfflineQueue(): Promise<OfflineAttendanceRecord[]> {
    try {
      const db = await openDB()
      return await getAllFromQueue(db)
    } catch {
      return []
    }
  }

  // Remove one record once it's been synced (or can never sync — e.g. its
  // session was deleted). Without this, the foreground sync path
  // (syncOfflineRecords in scan/page.tsx) never actually shrinks the queue —
  // only the service worker's own background `sync` event handler did, which
  // isn't supported on every browser (notably iOS Safari has no Background
  // Sync API at all), so already-synced scans kept getting re-submitted.
  async function removeOfflineAttendance(id: string) {
    try {
      const db = await openDB()
      await removeFromQueue(db, id)
    } catch (e) {
      console.error('Failed to remove synced offline record', e)
    }
  }

  return { isOnline, isInstallable, installApp, queueOfflineAttendance, getOfflineQueue, removeOfflineAttendance }
}

// ── IndexedDB helpers ─────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('opfc-offline', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function addToQueue(db: IDBDatabase, record: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function getAllFromQueue(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function removeFromQueue(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
