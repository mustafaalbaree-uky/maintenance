// Display helpers. Everything user facing goes through here so the voice stays uniform.

import type { Confidence } from './projection'

export function miles(n: number): string {
  return n.toLocaleString('en-US')
}

export function money(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/** A cost range, or null when the source document gives no figure. */
export function costRange(low: number | null, high: number | null): string | null {
  if (low == null && high == null) return null
  if (low != null && high != null) return `${money(low)} to ${money(high)}`
  return money((low ?? high) as number)
}

export function monthYear(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Never show a bare number with hidden uncertainty. */
export function confidenceLine(
  confidence: Confidence,
  readingCount: number,
  dailyRate: number,
): string {
  switch (confidence) {
    case 'default':
      return 'Estimated at 12,000 miles a year until you add more readings'
    case 'rough':
      return `Based on ${readingCount} reading${readingCount === 1 ? '' : 's'}`
    case 'good':
      return `About ${miles(Math.round((dailyRate * 365) / 12 / 10) * 10)} miles a month, based on your driving`
    case 'stale':
      return 'This estimate is out of date'
  }
}

/** Coverage as a sentence rather than an enum. */
export function coverageSentence(guess: string): string {
  switch (guess) {
    case 'likely_covered':
      return "Your warranty should cover this. You'd pay the deductible."
    case 'not_covered':
      return "You'd pay for this yourself."
    default:
      return "Your warranty might cover this. Budget as if it won't."
  }
}

/** "310 miles over", "1,200 miles", "in 3 weeks". Always carries a non-color signal. */
export function remainingLabel(
  milesRemaining: number | null,
  daysRemaining: number | null,
): string {
  if (milesRemaining != null && milesRemaining < 0) {
    return `${miles(Math.abs(milesRemaining))} miles over`
  }
  if (daysRemaining != null && daysRemaining < 0) {
    const d = Math.abs(daysRemaining)
    return `${d} day${d === 1 ? '' : 's'} over`
  }
  if (milesRemaining != null && (daysRemaining == null || milesRemaining / 33 <= daysRemaining)) {
    return `in about ${miles(Math.round(milesRemaining / 100) * 100)} miles`
  }
  if (daysRemaining != null) {
    if (daysRemaining <= 45) return `in about ${daysRemaining} days`
    return `around ${monthYear(addDaysDisplay(daysRemaining))}`
  }
  return ''
}

function addDaysDisplay(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
