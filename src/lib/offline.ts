// Not general offline support. This queues one thing: a service log that failed to save
// because the network was down, plus its photo bytes, so standing in a parking garage
// does not lose the record.

const DB_NAME = 'maintenance-offline'
const STORE = 'pending_service'

interface PendingService {
  id: string
  row: Record<string, unknown>
  photo: Blob | null
  queued_at: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function isNetworkFailure(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Returns true when the record was queued rather than lost. */
export async function queuePendingService(
  row: Record<string, unknown>,
  photo: File | null,
): Promise<boolean> {
  if (!isNetworkFailure()) return false
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        id: crypto.randomUUID(),
        row,
        photo: photo ?? null,
        queued_at: new Date().toISOString(),
      } satisfies PendingService)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

export async function pendingServices(): Promise<PendingService[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as PendingService[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

export async function clearPending(id: string): Promise<void> {
  const db = await openDb()
  db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
}
