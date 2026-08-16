// Signs a throwaway account into the deployed app and walks the main screens, capturing
// what they actually look like. The account and everything it creates are deleted at the
// end. Never uses a real person's password: the session is injected from an admin issued
// token.
//
//   SVC=<service_role_key> node scripts/smoke-ui.mjs

import { chromium } from 'playwright'

const REF = process.env.REF ?? 'otruqvbnxjqmjstmmawf'
const API = `https://${REF}.supabase.co`
const ANON = process.env.ANON ?? 'sb_publishable_I7BZA_OnOgh6zwB9F8W7-A_OsHZy9Sh'
const SVC = process.env.SVC
const SITE = process.env.SITE ?? 'https://mustafaalbaree-uky.github.io/maintenance/'
const SCHEMA = 'maintenance'

if (!SVC) {
  console.error('Set SVC to the service role key.')
  process.exit(1)
}

const admin = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      'Accept-Profile': SCHEMA,
      'Content-Profile': SCHEMA,
      ...(init.headers ?? {}),
    },
  })

const stamp = Date.now()
const email = `uismoke-${stamp}@example.com`
const password = `smoke-${Math.random().toString(36).slice(2)}Aa1`

console.log('Creating a throwaway account…')
const created = await admin('/auth/v1/admin/users', {
  method: 'POST',
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: {} }),
}).then((r) => r.json())
const userId = created.id
if (!userId) {
  console.error('could not create user:', created)
  process.exit(1)
}

const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json())

// Give it a car so the app has something to render.
const vehicle = await fetch(`${API}/rest/v1/vehicle`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Content-Profile': SCHEMA,
    'Accept-Profile': SCHEMA,
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    year: 2022,
    make: 'Genesis',
    model: 'G70',
    trim: '3.3T AWD',
    purchase_date: '2026-02-15',
    purchase_odometer: 42000,
    plan_end_odometer: 102000,
  }),
}).then((r) => r.json())
const vehicleId = vehicle[0].id

await fetch(`${API}/rest/v1/rpc/provision_vehicle`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Content-Profile': SCHEMA,
  },
  body: JSON.stringify({ p_vehicle_id: vehicleId }),
})

// Six months of readings so the projection has something real to fit.
const readings = Array.from({ length: 6 }, (_, i) => {
  const d = new Date('2026-02-15T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + i * 30)
  return {
    vehicle_id: vehicleId,
    reading_date: d.toISOString().slice(0, 10),
    miles: 42000 + Math.round(i * 30 * 36),
    source: 'manual',
  }
})
await fetch(`${API}/rest/v1/odometer_reading`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Content-Profile': SCHEMA,
  },
  body: JSON.stringify(readings),
})

// Mark onboarding done so the app opens on Home.
await fetch(`${API}/rest/v1/app_state`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'Content-Profile': SCHEMA,
    Prefer: 'resolution=merge-duplicates',
  },
  body: JSON.stringify({
    user_id: userId,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_last_card: 11,
    has_seen_intro_animation: true,
  }),
})

const browser = await chromium.launch()
const problems = []

for (const vp of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // supabase-js reads its session from this key on load.
  await page.goto(SITE)
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [`sb-${REF}-auth-token`, JSON.stringify(session)],
  )

  for (const [route, label] of [
    ['', 'home'],
    ['#/coming-up', 'coming-up'],
    ['#/history', 'receipts'],
    ['#/log', 'log'],
    ['#/tasks', 'tasks'],
    ['#/settings', 'settings'],
  ]) {
    await page.goto(`${SITE}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1400)
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
    await page.screenshot({ path: `/tmp/ui-${vp.name}-${label}.png`, fullPage: true })
    console.log(`\n--- ${vp.name} ${label} ---\n${text.slice(0, 420)}`)
    if (/Sign in/.test(text) && label !== 'signin') problems.push(`${vp.name} ${label}: bounced to sign in`)
    if (/NaN|undefined|\[object/.test(text)) problems.push(`${vp.name} ${label}: broken value in copy`)
    if (/in about 0 miles/.test(text)) problems.push(`${vp.name} ${label}: zero miles line is back`)
  }

  if (errors.length) problems.push(`${vp.name} console: ${errors.slice(0, 3).join(' | ')}`)
  await context.close()
}

await browser.close()

console.log('\nCleaning up…')
await fetch(`${API}/rest/v1/vehicle?id=eq.${vehicleId}`, {
  method: 'DELETE',
  headers: {
    apikey: SVC,
    Authorization: `Bearer ${SVC}`,
    'Content-Profile': SCHEMA,
  },
})
await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })

console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join('\n- ')}` : '\nNo problems detected.')
process.exit(problems.length ? 1 : 0)
