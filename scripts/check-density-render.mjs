// Desktop density pass check. Renders Home, Coming up, Tasks, Receipts, Timeline,
// Symptoms, Warranty and Budget at a phone width and a desktop width, with every
// Supabase call intercepted and answered from one shared fixture set, matching the
// approach the other Phase 2 render scripts use. For each screen and width it confirms
// the heading renders and that neither width scrolls horizontally
// (document.documentElement.scrollWidth against clientWidth); at the desktop width it
// also confirms the sidebar carries the four new Phase 2 links.
//
//   npm run dev            (separately, in another terminal)
//   node scripts/check-density-render.mjs

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

const ITEMS = [
  {
    id: 'item-transmission',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: 'Transmission fluid service',
    category: 'fluids',
    interval_miles: 35000,
    interval_months: null,
    plain_language: 'Keeps the eight speed shifting smoothly for the life of the car.',
    why_it_matters: 'Skipped fluid service is the most common cause of a premature rebuild.',
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
    plain_language: 'A quick check that the 12V battery still holds a charge.',
    why_it_matters: 'A weak 12V battery causes false electrical faults across the car.',
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
  {
    id: 'item-brakes',
    vehicle_id: VEHICLE.id,
    template_id: null,
    name: 'Brake pad inspection',
    category: 'brakes',
    interval_miles: 15000,
    interval_months: null,
    plain_language: 'A visual check of pad thickness on all four corners.',
    why_it_matters: 'Worn pads score the rotors, which turns a cheap job into an expensive one.',
    note: null,
    typical_cost_low_cents: 0,
    typical_cost_high_cents: 0,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: 5000,
    anchor_date: '2026-02-15',
    active: true,
    sort_order: 3,
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
    plain_language: 'The most common complaint on this car.',
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
  {
    id: 'limited-1',
    vehicle_id: VEHICLE.id,
    name: 'Genesis Limited Warranty',
    ends_at_miles: 60000,
    ends_at_date: null,
    cap_is_total_odometer: true,
    starts_from_odometer: null,
    deductible_cents: null,
    reduced_deductible_cents: null,
    reduced_deductible_condition: null,
    coverage_type: 'limited',
    notes: 'Bumper to bumper coverage from the original in service date.',
    cap_basis_recorded_at: '2026-02-15',
  },
]

const SYMPTOMS = [
  {
    id: 's1',
    symptom: 'Clunk from the rear over bumps',
    likely_cause: 'Loose rear subframe bolts, or a worn sway bar end link.',
    first_check: 'Torque check on the rear subframe bolts.',
    urgency: 'normal',
    watch_item_name: 'Rear suspension clunk',
  },
  {
    id: 's2',
    symptom: 'AWD warning light',
    likely_cause: 'The AWD coupling unit failing, or a fluid service overdue.',
    first_check: 'Scan for codes and confirm transfer case fluid history.',
    urgency: 'soon',
    watch_item_name: 'AWD coupling unit',
  },
  {
    id: 's3',
    symptom: 'Burning smell after hard braking',
    likely_cause: 'Overheated pads or a stuck caliper.',
    first_check: 'Pull over and let the brakes cool before driving further.',
    urgency: 'stop_driving',
    watch_item_name: null,
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
  maintenance_item: ITEMS,
  service_log: [SERVICE_LOG],
  receipt: [RECEIPT],
  task: [],
  watch_item: WATCH_ITEMS,
  warranty: WARRANTIES,
  symptom_ref: SYMPTOMS,
}

const SCREENS = [
  { path: '/', name: 'home', heading: 'Maintenance' },
  { path: '/coming-up', name: 'coming-up', heading: 'Coming up' },
  { path: '/tasks', name: 'tasks', heading: 'First things' },
  { path: '/history', name: 'history', heading: 'Receipts' },
  { path: '/timeline', name: 'timeline', heading: 'Timeline' },
  { path: '/symptoms', name: 'symptoms', heading: 'Symptoms' },
  { path: '/warranty', name: 'warranty', heading: 'Warranty' },
  { path: '/budget', name: 'budget', heading: 'Budget' },
]

const WIDTHS = [
  { width: 390, height: 844, label: 'phone' },
  { width: 1440, height: 900, label: 'desktop' },
]

const browser = await chromium.launch()
let failures = 0

for (const size of WIDTHS) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } })
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

  for (const screen of SCREENS) {
    await page.goto(`${SITE}#${screen.path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
    if (!new RegExp(screen.heading).test(body)) {
      console.log(`FAIL: [${size.label} ${screen.name}] heading "${screen.heading}" not shown`)
      failures++
    }

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
    })
    if (overflow.scrollWidth > overflow.clientWidth) {
      console.log(
        `FAIL: [${size.label} ${screen.name}] horizontal scroll (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
      )
      failures++
    }

    if (size.label === 'desktop') {
      const nav = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('nav a')).map((a) => a.textContent?.trim())
        return links
      })
      for (const label of ['Timeline', 'Symptoms', 'Warranty', 'Budget']) {
        if (!nav.includes(label)) {
          console.log(`FAIL: [${size.label} ${screen.name}] sidebar is missing "${label}"`)
          failures++
        }
      }
    }

    const path = `/tmp/density-${screen.name}-${size.label}.png`
    await page.screenshot({ path, fullPage: true })
    console.log(`screenshot: ${path}`)
  }

  if (errors.length) {
    console.log(`page errors at ${size.label}:`, errors.slice(0, 5).join(' | '))
    failures++
  }

  await context.close()
}

await browser.close()

console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
