// Renders /coming-up against the local dev server with every Supabase call intercepted
// and answered from fixture data shaped like the real tables, checking the trendline
// chart card. No live Supabase project is touched, the same fallback the timeline slice
// used because no container runtime is available on this machine.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-trendline-render.mjs

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

// Two seed items with real cost figures: transmission fluid (mileage interval) and the
// 12V battery load test (calendar interval). Oil has no cost figure and should not add a
// dollar to the line.
const MAINTENANCE_ITEMS = [
  {
    id: 'm1',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: 'Transmission fluid service',
    category: 'fluids',
    interval_miles: 35000,
    interval_months: null,
    plain_language: '',
    why_it_matters: '',
    note: null,
    typical_cost_low_cents: 4000,
    typical_cost_high_cents: 8000,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: VEHICLE.purchase_odometer,
    anchor_date: VEHICLE.purchase_date,
    active: true,
    sort_order: 1,
  },
  {
    id: 'm2',
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
    anchor_odometer: VEHICLE.purchase_odometer,
    anchor_date: VEHICLE.purchase_date,
    active: true,
    sort_order: 2,
  },
  {
    id: 'm3',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: 'Oil and filter change',
    category: 'fluids',
    interval_miles: 5000,
    interval_months: 6,
    plain_language: '',
    why_it_matters: '',
    note: null,
    typical_cost_low_cents: null,
    typical_cost_high_cents: null,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: VEHICLE.purchase_odometer,
    anchor_date: VEHICLE.purchase_date,
    active: true,
    sort_order: 3,
  },
]

const RECEIPT = {
  id: 'rc1',
  vehicle_id: VEHICLE.id,
  storage_path: 'fixture.jpg',
  performed_on: '2026-06-01',
  odometer: 45000,
  shop_name: 'Genesis of Lexington',
  total_cost_cents: 6000,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
}

const SERVICE_LOGS = [
  {
    id: 'l1',
    vehicle_id: VEHICLE.id,
    maintenance_item_id: 'm1',
    receipt_id: RECEIPT.id,
    performed_on: '2026-06-01',
    odometer: 45000,
    description: 'Transmission fluid service',
    shop_name: 'Genesis of Lexington',
    cost_cents: null,
    is_warranty_claim: false,
    claim_status: null,
    deductible_paid_cents: null,
    receipt_path: null,
    notes: null,
    created_at: '2026-06-01T00:00:00Z',
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
  maintenance_item: MAINTENANCE_ITEMS,
  service_log: SERVICE_LOGS,
  receipt: [RECEIPT],
  task: [],
  watch_item: [],
  warranty: [],
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
  const url = new URL(route.request().url())
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

await page.goto(`${SITE}#/coming-up`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
console.log('visible text:', text.slice(0, 500))

let failures = 0

if (!/Cost over ownership/.test(text)) {
  console.log('FAIL: chart title "Cost over ownership" not shown')
  failures++
}
if (!/42,000/.test(text) || !/102,000/.test(text)) {
  console.log('FAIL: the ownership range caption does not show the horizon miles')
  failures++
}

const svg = page.locator('.recharts-surface').first()
const svgCount = await page.locator('.recharts-surface').count()
if (svgCount === 0) {
  console.log('FAIL: no chart rendered')
  failures++
} else if (!(await svg.isVisible())) {
  console.log('FAIL: chart svg present but not visible')
  failures++
}

const lineCount = await page.locator('.recharts-line-curve').count()
if (lineCount !== 1) {
  console.log(`FAIL: expected exactly one projected line, found ${lineCount}`)
  failures++
}

const dotCount = await page.locator('.recharts-reference-dot').count()
if (dotCount !== 1) {
  console.log(`FAIL: expected exactly one actual point (one receipt logged), found ${dotCount}`)
  failures++
}

// No legend: the title and caption already say what the one line and the dot are.
const legendCount = await page.locator('.recharts-legend-wrapper').count()
if (legendCount !== 0) {
  console.log('FAIL: a legend rendered where the title should carry the meaning instead')
  failures++
}

if (errors.length) {
  console.log('page errors:', errors.slice(0, 5).join(' | '))
  failures++
}

await page.screenshot({ path: '/tmp/trendline-render.png', fullPage: true })
console.log('screenshot: /tmp/trendline-render.png')

await context.close()
await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
