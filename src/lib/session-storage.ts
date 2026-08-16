// Where the signed in session lives.
//
// supabase-js defaults to localStorage, which iOS treats as disposable: intelligent
// tracking prevention clears script written storage, and a web app launched from the Home
// Screen gets hit harder than a normal tab. The symptom is being signed out every time
// the app is opened.
//
// IndexedDB survives that far better, so it is the record of truth here. localStorage is
// kept in step as a mirror, purely so the very first read on launch can be answered
// without waiting on a database, and as a fallback if IndexedDB is unavailable.

const DB_NAME = 'maintenance-session'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function idbRemove(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

function safeLocal(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const durableSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const fromIdb = await idbGet(key)
    if (fromIdb) {
      // The mirror may have been cleared out from under us. Put it back.
      safeLocal()?.setItem(key, fromIdb)
      return fromIdb
    }

    // IndexedDB empty, so either this is a first run or it was the mirror that survived.
    const mirrored = safeLocal()?.getItem(key) ?? null
    if (mirrored) await idbSet(key, mirrored)
    return mirrored
  },

  async setItem(key: string, value: string): Promise<void> {
    safeLocal()?.setItem(key, value)
    await idbSet(key, value)
  },

  async removeItem(key: string): Promise<void> {
    safeLocal()?.removeItem(key)
    await idbRemove(key)
  },
}
