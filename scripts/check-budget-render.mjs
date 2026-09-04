// Renders /budget against the local dev server with every Supabase call intercepted and
// answered from fixture data shaped like the real tables, matching the approach the other
// Phase 2 render scripts use because no container runtime is available on this machine to
// run the local Supabase stack for real.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-budget-render.mjs

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

// The two costed active items the ownership guide gives, matching the Trendline fixture.
const ITEMS = [
  {
    id: 'item-transmission',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: 'Transmission fluid service',
    category: 'fluids',
    interval_miles: 35000,
    interval_months: null,
    plain_language: '',
    why_it_matters: '',
    note: null,
    typical_cost_low_cents: 40000,
    typical_cost_high_cents: 80000,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: 42000,
    anchor_date: '2026-02-15',
    active: true,
    sort_order: 1,
  },
  {
    id: 'item-battery',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: '12V battery load test',
    category: 'electrical',
    interval_miles: null,
    interval_months: 12,
    plain_language: '',
    why_it_matters: '',
    note: null,
    typical_cost_low_cents: 15000,
    typical_cost_high_cents: 25000,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: 42000,
    anchor_date: '2026-02-15',
    active: true,
    sort_order: 2,
  },
]

const RECEIPT = {
  id: 'r1',
  vehicle_id: VEHICLE.id,
  storage_path: null,
  performed_on: '2026-03-01',
  odometer: 43500,
  shop_name: 'Genesis of Lexington',
  total_cost_cents: 9000,
  notes: null,
  created_at: '2026-03-01T00:00:00Z',
}

const SERVICE_LOG = {
  id: 'l1',
  vehicle_id: VEHICLE.id,
  maintenance_item_id: null,
  receipt_id: 'r1',
  performed_on: '2026-03-01',
  odometer: 43500,
  description: 'Oil change',
  shop_name: null,
  cost_cents: null,
  is_warranty_claim: false,
  claim_status: null,
  deductible_paid_cents: null,
  receipt_path: null,
  notes: null,
  created_at: '2026-03-01T00:00:00Z',
}

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
    notes: null,
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
  odometer_reading: [],
  maintenance_item: ITEMS,
  service_log: [SERVICE_LOG],
  receipt: [RECEIPT],
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

await page.goto(`${SITE}#/budget`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

let failures = 0

const text = () => page.locator('body').innerText().then((t) => t.replace(/\s+/g, ' ').trim())
const body = await text()
console.log('visible text (collapsed):', body.slice(0, 600))

if (!/^Budget/.test(body)) {
  console.log('FAIL: heading "Budget" not shown')
  failures++
}
if (!/Next twelve months/.test(body)) {
  console.log('FAIL: "Next twelve months" card not shown')
  failures++
}
if (!/Rest of ownership/.test(body)) {
  console.log('FAIL: "Rest of ownership" card not shown')
  failures++
}
if (!/Spent so far/.test(body)) {
  console.log('FAIL: "Spent so far" card not shown')
  failures++
}
if (!/\$90/.test(body)) {
  console.log('FAIL: logged receipt total ($90) not reflected in spent so far')
  failures++
}
if (!/MaxCare deductible/.test(body)) {
  console.log('FAIL: MaxCare deductible card not shown')
  failures++
}
if (!/\$400/.test(body)) {
  console.log('FAIL: MaxCare deductible figure ($400) not shown')
  failures++
}
if (/undefined|NaN/.test(body)) {
  console.log('FAIL: an undefined or NaN value rendered')
  failures++
}

if (errors.length) {
  console.log('page errors:', errors.slice(0, 5).join(' | '))
  failures++
}

await page.screenshot({ path: '/tmp/budget-render.png', fullPage: true })
console.log('screenshot: /tmp/budget-render.png')

await context.close()
await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
