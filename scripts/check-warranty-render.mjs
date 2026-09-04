// Renders /warranty against the local dev server with every Supabase call intercepted
// and answered from fixture data shaped like the real tables, matching the approach
// scripts/check-symptoms-render.mjs used because no container runtime is available on
// this machine to run the local Supabase stack for real. The warranty PATCH request is
// applied to the in memory fixture so the basis recording flow can be checked end to end.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-warranty-render.mjs

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

// Matches the two rows provision_vehicle_unchecked seeds, cap_is_total_odometer null
// on MaxCare until CarMax answers, already true on the factory warranty.
const WARRANTIES = [
  {
    id: 'maxcare-1',
    vehicle_id: VEHICLE.id,
    name: 'MaxCare',
    ends_at_miles: 75000,
    ends_at_date: null,
    cap_is_total_odometer: null,
    starts_from_odometer: null,
    deductible_cents: 40000,
    reduced_deductible_cents: 35000,
    reduced_deductible_condition: 'CarMax Service Center or RepairPal Certified shop',
    coverage_type: 'exclusionary',
    notes:
      'Covered: engine, transmission, drivetrain, electrical, electronics, steering, suspension, cooling, and climate control.\n\nNot covered: all routine maintenance including oil, filters, fluids, brakes, batteries, and wipers.',
    cap_basis_recorded_at: null,
  },
  {
    id: 'factory-1',
    vehicle_id: VEHICLE.id,
    name: 'Factory New Vehicle Limited Warranty',
    ends_at_miles: 60000,
    ends_at_date: '2027-03-01',
    cap_is_total_odometer: true,
    starts_from_odometer: null,
    deductible_cents: null,
    reduced_deductible_cents: null,
    reduced_deductible_condition: null,
    coverage_type: 'limited',
    notes: 'As a second owner you do not get the 10 year or 100,000 mile powertrain warranty.',
    cap_basis_recorded_at: null,
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
    {
      id: 'r1',
      vehicle_id: VEHICLE.id,
      reading_date: '2026-08-01',
      miles: 47000,
      source: 'manual',
      created_at: '2026-08-01T00:00:00Z',
    },
  ],
  maintenance_item: [],
  service_log: [],
  receipt: [],
  task: [],
  watch_item: [],
  warranty: WARRANTIES,
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

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
  const req = route.request()
  const url = new URL(req.url())
  const table = url.pathname.split('/').pop()

  if (req.method() === 'PATCH' && table === 'warranty') {
    const idMatch = url.searchParams.get('id') // "eq.<uuid>"
    const id = idMatch?.replace('eq.', '')
    const patch = JSON.parse(req.postData() ?? '{}')
    const row = WARRANTIES.find((w) => w.id === id)
    if (row) Object.assign(row, patch)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) })
  }

  const rows = TABLE_FIXTURES[table]
  if (rows === undefined) {
    console.log('UNMOCKED TABLE:', table)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
})

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(`${SITE}#/warranty`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

let failures = 0

const text = () => page.locator('body').innerText().then((t) => t.replace(/\s+/g, ' ').trim())

let body = await text()
console.log('visible text (collapsed):', body.slice(0, 500))

if (!/Warranty/.test(body)) {
  console.log('FAIL: heading "Warranty" not shown')
  failures++
}
if (!/MaxCare/.test(body)) {
  console.log('FAIL: MaxCare warranty not shown')
  failures++
}
if (!/Factory New Vehicle Limited Warranty/.test(body)) {
  console.log('FAIL: factory warranty not shown')
  failures++
}
if (!/Last confirmed 47,000 miles/.test(body)) {
  console.log('FAIL: current odometer line did not use the logged reading')
  failures++
}

// MaxCare basis is unrecorded: both readings of the cap should show, not one.
if (!/If total odometer: 75,000 miles/.test(body)) {
  console.log('FAIL: total odometer reading of the MaxCare cap not shown')
  failures++
}
if (!/If since purchase: 117,000 miles/.test(body)) {
  console.log('FAIL: since purchase reading of the MaxCare cap not shown (42,000 + 75,000)')
  failures++
}
if (!/Basis not recorded yet/.test(body)) {
  console.log('FAIL: unresolved basis note not shown')
  failures++
}

// Factory warranty basis is already recorded (true from seed): one cap line, not two.
if (!/Mileage cap: 60,000 miles/.test(body)) {
  console.log('FAIL: resolved factory mileage cap not shown')
  failures++
}
if (/If total odometer: 60,000/.test(body)) {
  console.log('FAIL: factory warranty showed both readings despite a recorded basis')
  failures++
}
if (!/Date cap: Mar 1, 2027/.test(body)) {
  console.log('FAIL: factory date cap not shown')
  failures++
}

// Record the MaxCare basis: pick "since purchase", submit, and confirm it collapses to
// one cap line and the recording form disappears.
await page.getByText(/Since purchase\. The cap is/).click()
await page.getByRole('button', { name: 'Record basis' }).click()
await page.waitForTimeout(500)

body = await text()
if (!/Mileage cap: 117,000 miles/.test(body)) {
  console.log('FAIL: MaxCare did not collapse to the since purchase cap after recording')
  failures++
}
if (/If total odometer:/.test(body)) {
  console.log('FAIL: MaxCare still showed both readings after the basis was recorded')
  failures++
}
if (!/Basis recorded/.test(body)) {
  console.log('FAIL: recorded basis line not shown after submitting')
  failures++
}
if (/Record what CarMax said/.test(body)) {
  console.log('FAIL: the recording form is still shown after the basis was recorded')
  failures++
}

if (errors.length) {
  console.log('page errors:', errors.slice(0, 5).join(' | '))
  failures++
}

await page.screenshot({ path: '/tmp/warranty-render.png', fullPage: true })
console.log('screenshot: /tmp/warranty-render.png')

await context.close()
await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
