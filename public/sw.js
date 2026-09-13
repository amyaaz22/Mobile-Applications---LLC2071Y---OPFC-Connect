// OPFC Connect — Service Worker
// Handles offline caching and background sync for attendance

const CACHE_NAME = 'opfc-v1'
const OFFLINE_QUEUE_KEY = 'opfc-offline-queue'

// App shell files to cache immediately
const PRECACHE = [
  '/',
  '/login',
  '/scan',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first with cache fallback ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and Supabase API calls (handle offline via queue)
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses for app pages
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached
          // Return offline page for navigation requests
          if (request.destination === 'document') {
            return caches.match('/offline')
          }
        })
      })
  )
})

// ── Background sync: flush offline attendance queue ──────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance())
  }
})

async function syncAttendance() {
  try {
    const db = await openDB()
    const queue = await getQueue(db)
    if (!queue.length) return

    for (const item of queue) {
      try {
        const res = await fetch('/api/attendance/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        if (res.ok) {
          await removeFromQueue(db, item.id)
        }
      } catch (e) {
        // Will retry on next sync
      }
    }
  } catch (e) {
    console.error('Sync failed', e)
  }
}

// ── Simple IndexedDB wrapper ──────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('opfc-offline', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('queue', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getQueue(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function removeFromQueue(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Push notifications (future) ───────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'OPFC Connect', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ?? 'opfc',
    })
  )
})
