// Renders /symptoms against the local dev server with every Supabase call intercepted
// and answered from fixture data shaped like the real tables, matching the approach
// scripts/check-timeline-render.mjs used because no container runtime is available on
// this machine to run the local Supabase stack for real.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-symptoms-render.mjs

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

// A watch item provisioned onto this vehicle from the same template one symptom points
// at, so the render can check the related item, its window, and its cost figure show up.
const WATCH_ITEMS = [
  {
    id: 'w1',
    vehicle_id: VEHICLE.id,
    watch_template_id: 'wt-clunk',
    name: 'Rear suspension clunk',
    window_start_miles: 30000,
    window_end_miles: 60000,
    est_cost_low_cents: null,
    est_cost_high_cents: null,
    coverage_guess: 'likely_covered',
    coverage_note: null,
    symptoms: 'A clunk or knock from the rear when you go over bumps or expansion joints.',
    first_check: 'Have the shop check rear subframe bolt torque before buying any parts.',
    plain_language: 'The most common complaint on this car.',
    severity: 'normal',
    status: 'watching',
    resolved_service_log_id: null,
  },
  {
    id: 'w2',
    vehicle_id: VEHICLE.id,
    watch_template_id: 'wt-battery',
    name: '12V battery failure',
    window_start_miles: 42000,
    window_end_miles: 60000,
    est_cost_low_cents: 15000,
    est_cost_high_cents: 25000,
    coverage_guess: 'not_covered',
    coverage_note: null,
    symptoms: 'Slow cranking, a jump start needed after sitting.',
    first_check: 'Have the battery load tested rather than voltage checked.',
    plain_language: 'Batteries are a wear item.',
    severity: 'normal',
    status: 'watching',
    resolved_service_log_id: null,
  },
]

// Three symptoms from the seed data: one with an urgent tow-it label and no related
// item, one that traces to a watch item with a cost figure, one that traces to a watch
// item with none, which is what proves the "null renders without the line" rule holds.
const SYMPTOMS = [
  {
    id: 's1',
    template_set: 'g70_33t',
    symptom: 'Sudden loss of power while driving',
    aliases: ['car died', 'lost power', 'stalled while driving'],
    first_check: 'Stop driving and have it towed. Book the fuel pump recall, Genesis 262/023G.',
    likely_cause: 'An open recall covers a fuel pump that can fail and cause a loss of drive power.',
    watch_template_id: null,
    urgency: 'stop_driving',
  },
  {
    id: 's2',
    template_set: 'g70_33t',
    symptom: 'Slow cranking or a dead battery',
    aliases: ['wont start', 'needed a jump', 'clicking when I turn the key'],
    first_check: 'Have the battery load tested rather than voltage checked.',
    likely_cause: 'The 12V battery reaching the end of its life.',
    watch_template_id: 'wt-battery',
    urgency: 'normal',
  },
  {
    id: 's3',
    template_set: 'g70_33t',
    symptom: 'Clunk from the rear over bumps',
    aliases: ['clunking noise', 'knocking over bumps', 'rattle from the back'],
    first_check: 'Have the shop check rear subframe bolt torque before buying any parts.',
    likely_cause: 'Loose rear subframe bolts, which cost nothing to tighten.',
    watch_template_id: 'wt-clunk',
    urgency: 'normal',
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
  symptom_ref: SYMPTOMS,
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

await page.goto(`${SITE}#/symptoms`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

let failures = 0

const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
console.log('visible text (collapsed):', text.slice(0, 400))

if (!/Symptoms/.test(text)) {
  console.log('FAIL: heading "Symptoms" not shown')
  failures++
}
if (!/Sudden loss of power while driving/.test(text)) {
  console.log('FAIL: seed symptom not shown before search')
  failures++
}
if (!/Slow cranking or a dead battery/.test(text)) {
  console.log('FAIL: seed symptom not shown before search')
  failures++
}
if (!/Clunk from the rear over bumps/.test(text)) {
  console.log('FAIL: seed symptom not shown before search')
  failures++
}

// Type an alias word that only one symptom carries, and confirm the list narrows to it.
await page.getByPlaceholder('Search symptoms').fill('rattle')
await page.waitForTimeout(200)
const filteredText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
if (!/Clunk from the rear over bumps/.test(filteredText)) {
  console.log('FAIL: alias search did not surface the matching symptom')
  failures++
}
if (/Sudden loss of power while driving/.test(filteredText)) {
  console.log('FAIL: alias search left an unrelated symptom in the list')
  failures++
}

// Open the matching row and confirm the guide text, the related item, and its cost show.
await page.getByText('Clunk from the rear over bumps').click()
await page.waitForTimeout(300)
const openedText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
if (!/Loose rear subframe bolts/.test(openedText)) {
  console.log('FAIL: likely_cause text not shown after opening the row')
  failures++
}
if (!/Rear suspension clunk/.test(openedText)) {
  console.log('FAIL: related watch item name not shown')
  failures++
}
if (/Usually \$/.test(openedText)) {
  console.log('FAIL: a dollar figure appeared for a related item with no cost fields')
  failures++
}

// Clear the search, open the battery symptom, and confirm its related item's cost shows.
await page.getByPlaceholder('Search symptoms').fill('')
await page.waitForTimeout(200)
await page.getByText('Slow cranking or a dead battery').click()
await page.waitForTimeout(300)
const batteryText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
if (!/Usually \$150 to \$250/.test(batteryText)) {
  console.log('FAIL: cost range for the related battery watch item not shown')
  failures++
}

if (errors.length) {
  console.log('page errors:', errors.slice(0, 5).join(' | '))
  failures++
}

await page.screenshot({ path: '/tmp/symptoms-render.png', fullPage: true })
console.log('screenshot: /tmp/symptoms-render.png')

await context.close()
await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
