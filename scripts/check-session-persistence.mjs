// Does the signed in session survive what iOS does to a Home Screen web app?
//
// iOS clears script written localStorage. This wipes it between loads and checks the app
// is still signed in, which it can only be if the session was kept somewhere sturdier.
//
//   SVC=<service_role_key> node scripts/check-session-persistence.mjs

import { chromium } from 'playwright'

const REF = 'otruqvbnxjqmjstmmawf'
const API = `https://${REF}.supabase.co`
const ANON = 'sb_publishable_I7BZA_OnOgh6zwB9F8W7-A_OsHZy9Sh'
const SITE = process.env.SITE ?? 'https://mustafaalbaree-uky.github.io/maintenance/'
const SVC = process.env.SVC
const SCHEMA = 'maintenance'

if (!SVC) {
  console.error('Set SVC to the service role key.')
  process.exit(1)
}

const svcHeaders = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  'Content-Type': 'application/json',
  'Content-Profile': SCHEMA,
  'Accept-Profile': SCHEMA,
}

const email = `persist-${Date.now()}@example.com`
const password = `persist-${Math.random().toString(36).slice(2)}Aa1`

const user = await fetch(`${API}/auth/v1/admin/users`, {
  method: 'POST',
  headers: svcHeaders,
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json())

await fetch(`${API}/rest/v1/app_member`, {
  method: 'POST',
  headers: svcHeaders,
  body: JSON.stringify({ user_id: user.id, note: 'session persistence test' }),
})

const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json())

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
let failures = 0

// Sign in the way the app does, then let it settle so the session is written out.
await page.goto(SITE)
await page.evaluate(
  ([key, value]) => localStorage.setItem(key, value),
  ['maintenance-auth', JSON.stringify(session)],
)
await page.goto(SITE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const inIdb = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('maintenance-session', 1)
      req.onsuccess = () => {
        try {
          const get = req.result.transaction('kv', 'readonly').objectStore('kv').get('maintenance-auth')
          get.onsuccess = () => resolve(Boolean(get.result))
          get.onerror = () => resolve(false)
        } catch {
          resolve(false)
        }
      }
      req.onerror = () => resolve(false)
    }),
)
console.log('session copied into IndexedDB:', inIdb)
if (!inIdb) failures++

// Now do what iOS does: throw away localStorage, then relaunch.
await page.evaluate(() => localStorage.clear())
await page.goto(SITE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
const signedOut = /Welcome back|Sign in/.test(text)
console.log('after localStorage was wiped:', signedOut ? 'SIGNED OUT' : 'still signed in')
if (signedOut) failures++

const restored = await page.evaluate(() => localStorage.getItem('maintenance-auth') !== null)
console.log('mirror rewritten from IndexedDB:', restored)
if (!restored) failures++

await page.screenshot({ path: '/tmp/session-after-wipe.png', fullPage: true })
await browser.close()

for (const path of [`app_state?user_id=eq.${user.id}`, `app_member?user_id=eq.${user.id}`]) {
  await fetch(`${API}/rest/v1/${path}`, { method: 'DELETE', headers: svcHeaders })
}
await fetch(`${API}/rest/v1/vehicle?owner_id=eq.${user.id}`, { method: 'DELETE', headers: svcHeaders })
await fetch(`${API}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svcHeaders })

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
