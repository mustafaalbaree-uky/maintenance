// Onboarding card copy, kept out of JSX so a second template set can branch later
// without a rewrite. Copy is fixed by the design spec: do not paraphrase it.

export type CardAction =
  | { kind: 'advance' }
  | { kind: 'odometer' }
  | { kind: 'log_demo' }
  | { kind: 'route'; to: string }
  | { kind: 'finish' }

export interface OnboardingCard {
  heading: string
  body: string[]
  button: string
  action: CardAction
}

export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    heading: 'Why this exists',
    body: [
      'This plan was built from what went wrong for people who kept this exact car eight to ten years, traced back to the cheap thing they could have done in year two.',
      "You don't need to become a car person. This will tell you what to do and when.",
    ],
    button: 'Get started',
    action: { kind: 'advance' },
  },
  {
    heading: 'Mileage is the clock',
    body: [
      'Almost nothing about maintenance runs on dates. It runs on miles. So the app needs to know roughly where your odometer is.',
      'Put it in now, and again whenever you think of it. Every reading makes the estimate in between more accurate, so eventually you can go months without touching it.',
    ],
    button: 'Save and continue',
    action: { kind: 'odometer' },
  },
  {
    heading: 'Oil, and what skipping it costs',
    body: [
      'If you do one thing to this car, change the oil every 5,000 miles. Two turbochargers spin at very high speed on that oil, and they are the first thing to fail when it gets old.',
      'The manual allows 7,500. Going 5,000 instead costs about $60 more a year. A replacement turbo runs into the thousands.',
    ],
    button: "Show me what's coming up",
    action: { kind: 'route', to: '/coming-up' },
  },
  {
    heading: 'The fluids nobody thinks about',
    body: [
      "Your transmission, rear differential, and brakes all have fluid that wears out, and all three stay quiet about it until they aren't.",
      "Transmission fluid is the big one. If this car ever shudders or hesitates at low speed, it's almost always the fluid and not a broken transmission.",
    ],
    button: 'Got it',
    action: { kind: 'advance' },
  },
  {
    heading: 'Receipts protect your warranty',
    body: [
      "Your extended warranty can cover thousands in repairs. It can also deny a claim if you can't prove you maintained the car.",
      'Every receipt needs four things: your VIN, the date, the odometer, and what was done. The odometer is the one shops leave off and the one that gets claims denied.',
      "Log it here and the app won't let you skip it. Photograph the receipt before you leave the parking lot.",
      'Everything you log lives under Receipts, at the bottom of the screen. That tab is the record your warranty reads if it ever argues with you.',
    ],
    button: 'Makes sense',
    action: { kind: 'log_demo' },
  },
  {
    heading: 'Two open recalls',
    body: [
      'A recall means the manufacturer found a defect and fixes it free, at any dealer, forever. You have two.',
      "One is an oil pipe near the turbochargers that can crack and leak onto hot parts. It's a fire risk and it costs nothing to fix. Do it your first week.",
    ],
    button: 'Show me my first week',
    action: { kind: 'route', to: '/tasks' },
  },
  {
    heading: 'This car has known weak spots',
    body: [
      'Every model has a list of things that tend to go, and roughly when. Yours cluster between 60,000 and 80,000 miles, which for you is around 2028 and 2029.',
      "The app shows each one, when you'll likely reach it, what it costs, and whether your warranty should cover it.",
    ],
    button: 'Show me the timeline',
    action: { kind: 'route', to: '/timeline' },
  },
  {
    heading: 'If something feels wrong',
    body: [
      'A clunk, a shudder, a smell. Check here before a shop starts guessing.',
      "A clunk over bumps in the rear usually gets blamed on worn parts, but on this car it's often just loose subframe bolts, which costs nothing to tighten.",
    ],
    button: 'Show me the list',
    action: { kind: 'route', to: '/symptoms' },
  },
  {
    heading: 'What the year costs',
    body: [
      'Around $1,800 to $2,600 a year, not counting fuel and insurance. Lighter the first two years, heavier as you approach 80,000 miles.',
      'Setting aside $150 a month starting now covers the expensive stretch when it arrives.',
    ],
    button: 'Got it',
    action: { kind: 'route', to: '/budget' },
  },
  {
    heading: 'Where your receipts live',
    body: [
      'Receipts, at the bottom of the screen, is every service you have logged. It is the least exciting tab and the one that pays for itself.',
      'Each entry counts as claim ready when it has the odometer, the date, what was done, and a photo. The tab header tells you how many of yours are there.',
      'When a shop finishes something, log it before you drive off. It takes about twenty seconds.',
    ],
    // Deliberately not a route card: those finish the tutorial, and this one sits near
    // the end, so tapping through would skip the cards after it.
    button: 'Got it',
    action: { kind: 'advance' },
  },
  {
    heading: 'How the app should nudge you',
    body: [
      'Left alone, this app stays silent, which means remembering to open it is on you.',
      'In Settings you can pick how it reminds you: a weekly email, an email only when something needs doing, or a push to your iPhone. You can also change your password there, or run this tutorial again.',
    ],
    button: 'Got it',
    action: { kind: 'advance' },
  },
  {
    heading: 'Done',
    body: [
      "You don't need to remember any of this. Open the app when you think of it, put in your mileage, and do whatever it says is coming up.",
      'Settings is where you choose how the app reminds you, change your password, or run this tutorial again.',
      'Good luck with the car.',
    ],
    button: 'Start using the app',
    action: { kind: 'finish' },
  },
]
