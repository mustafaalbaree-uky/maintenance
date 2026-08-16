// Loads the deployed site in a clean browser with no stored session and reports what a
// signed out visitor actually sees, on both phone and desktop widths.

import { chromium } from 'playwright'

const URL = process.env.SITE ?? 'https://mustafaalbaree-uky.github.io/maintenance/'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]

const browser = await chromium.launch()
let failures = 0

for (const vp of VIEWPORTS) {
  // A brand new context each time: no localStorage, no session, no cache.
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  })
  const page = await context.newPage()

  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
  const hasGauge = (await page.locator('svg[role="img"]').count()) > 0
  const hasSignIn = /Sign in/i.test(text)
  const storage = await page.evaluate(() => Object.keys(localStorage))

  console.log(`\n=== ${vp.name} (${vp.width}px), signed out ===`)
  console.log('visible text :', text.slice(0, 180) || '(nothing)')
  console.log('gauge shown  :', hasGauge)
  console.log('sign in shown:', hasSignIn)
  console.log('localStorage :', storage.length ? storage.join(', ') : '(empty)')
  if (errors.length) console.log('page errors  :', errors.slice(0, 4).join(' | '))

  if (!hasSignIn || hasGauge) {
    console.log('RESULT: FAIL, a signed out visitor is not held at the sign in screen')
    failures++
  } else {
    console.log('RESULT: pass, held at the sign in screen')
  }

  // Deep link straight past the front door.
  await page.goto(`${URL}#/history`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const deepText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
  const deepBlocked = /Sign in/i.test(deepText)
  console.log(`deep link #/history: ${deepBlocked ? 'blocked' : 'NOT BLOCKED -> ' + deepText.slice(0, 120)}`)
  if (!deepBlocked) failures++

  await page.screenshot({ path: `/tmp/signed-out-${vp.name}.png`, fullPage: true })
  await context.close()
}

await browser.close()
console.log(`\n${failures} failure(s)`)
process.exit(failures ? 1 : 0)
