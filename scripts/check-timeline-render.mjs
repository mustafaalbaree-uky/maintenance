// Renders /timeline against the local dev server with every Supabase call intercepted
// and answered from fixture data shaped like the real tables. No live Supabase project
// is touched, which is the fallback the timeline slice used because no container
// runtime is available on this machine to run the local stack for real.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-timeline-render.mjs

import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'http://localhost:5173/maintenance/'

const NOW = Math.floor(Date.now() / 1000)
const FAKE_SESSION = {
  access_token: 'fake.fake.fake',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: NOW + 3600,
  refresh_token: 'fake-refresh',
  user: {
    id: 'fixture-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'fixture@example.com',
    user_metadata: {},
    app_metadata: {},
  },
}

const VEHICLE = {
  id: 'fixture-vehicle',
  owner_id: 'fixture-user',
  vin: null,
  year: 2022,
  make: 'Genesis',
  model: 'G70',
  trim: '3.3T AWD',
  engine_note: null,
  drivetrain: null,
  fuel_note: null,
  in_service_date: null,
  purchase_date: '2026-02-15',
  purchase_odometer: 42000,
  plan_end_odometer: 102000,
  nickname: null,
  created_at: '2026-02-15T00:00:00Z',
}

// Two watch items from the seed data: one the fixture odometer has reached, one ahead.
const WATCH_ITEMS = [
  {
    id: 'w1',
    vehicle_id: VEHICLE.id,
    watch_template_id: null,
    name: 'Rear suspension clunk',
    window_start_miles: 30000,
    window_end_miles: 60000,
    est_cost_low_cents: null,
    est_cost_high_cents: null,
    coverage_guess: 'likely_covered',
    coverage_note: null,
    symptoms: 'A clunk or knock from the rear when you go over bumps or expansion joints.',
    first_check: 'Have the shop check rear subframe bolt torque before buying any parts.',
    plain_language:
      'The most common complaint on this car, and the one most often fixed by tightening bolts.',
    severity: 'normal',
    status: 'watching',
    resolved_service_log_id: null,
  },
  {
    id: 'w2',
    vehicle_id: VEHICLE.id,
    watch_template_id: null,
    name: 'AWD coupling unit',
    window_start_miles: 70000,
    window_end_miles: 100000,
    est_cost_low_cents: 60000,
    est_cost_high_cents: 120000,
    coverage_guess: 'likely_covered',
    coverage_note: null,
    symptoms: 'An AWD warning light, or the car binding in tight low speed turns.',
    first_check: 'Confirm the rear differential and transfer case fluid have been serviced.',
    plain_language: 'The unit that decides how much power goes to the front wheels.',
    severity: 'normal',
    status: 'watching',
    resolved_service_log_id: null,
  },
]

const TABLE_FIXTURES = {
  app_member: [{ user_id: 'fixture-user' }],
  vehicle: [VEHICLE],
  app_state: [
    {
      user_id: 'fixture-user',
      onboarding_completed_at: '2026-02-15T00:00:00Z',
      onboarding_last_card: 11,
      has_seen_intro_animation: true,
    },
  ],
  odometer_reading: [
    { id: 'r1', vehicle_id: VEHICLE.id, reading_date: '2026-08-01', miles: 47000, source: 'manual', created_at: '2026-08-01T00:00:00Z' },
  ],
  maintenance_item: [],
  service_log: [],
  receipt: [],
  task: [],
  watch_item: WATCH_ITEMS,
  warranty: [],
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

// Plant a session before any script runs, so the app never hits the real sign in screen.
await context.addInitScript(
  ({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session))
  },
  { key: 'maintenance-auth', session: FAKE_SESSION },
)

await page.route('**/auth/v1/**', async (route) => {
  const url = route.request().url()
  if (url.includes('/auth/v1/user')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SESSION.user) })
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SESSION) })
})

await page.route('**/rest/v1/**', async (route) => {
  const url = new URL(route.request().url())
  const table = url.pathname.split('/').pop()
  const rows = TABLE_FIXTURES[table]
  if (rows === undefined) {
    console.log('UNMOCKED TABLE:', table)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  }
  // maybeSingle() expects one row or null, PostgREST returns an array either way here.
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
})

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(`${SITE}#/timeline`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
console.log('visible text:', text.slice(0, 400))

let failures = 0

if (!/Timeline/.test(text)) {
  console.log('FAIL: heading "Timeline" not shown')
  failures++
}
if (!/Rear suspension clunk/.test(text)) {
  console.log('FAIL: seed watch item "Rear suspension clunk" not shown')
  failures++
}
if (!/AWD coupling unit/.test(text)) {
  console.log('FAIL: seed watch item "AWD coupling unit" not shown')
  failures++
}
if (!/42,000/.test(text)) {
  console.log('FAIL: purchase odometer (42,000) not shown')
  failures++
}
// The current odometer is a projection forward from the fixture reading to today, not
// the raw reading itself, so this checks it moved rather than pinning an exact number
// that would go stale with the calendar.
const nowMatch = text.match(/Now near ([\d,]+) miles/)
const nowMiles = nowMatch ? Number(nowMatch[1].replace(/,/g, '')) : null
if (nowMiles == null || nowMiles < 47000) {
  console.log('FAIL: current odometer not shown as a projection from the fixture reading')
  failures++
}
// No invented figures: nothing in the fixtures gives a dollar range for the clunk item.
if (/\$\d/.test(text.split('AWD coupling unit')[0] ?? '')) {
  console.log('FAIL: a dollar figure appeared for an item with no cost fields')
  failures++
}
if (errors.length) {
  console.log('page errors:', errors.slice(0, 5).join(' | '))
  failures++
}

await page.screenshot({ path: '/tmp/timeline-render.png', fullPage: true })
console.log('screenshot: /tmp/timeline-render.png')

await context.close()
await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
