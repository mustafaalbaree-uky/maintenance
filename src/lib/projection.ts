// Adaptive mileage projection. Pure functions, no I/O, no clock access except what the
// caller passes in. The Postgres equivalent used by the cron job must stay in step with
// this file.

export type Confidence = 'default' | 'rough' | 'good' | 'stale'
export type RateMethod = 'default' | 'endpoints' | 'weighted_least_squares'

export interface Reading {
  reading_date: string // ISO date, yyyy-mm-dd
  miles: number
}

export interface RateEstimate {
  dailyRate: number
  confidence: Confidence
  method: RateMethod
  readingCount: number
  /** True when the raw fit fell outside the clamp and the previous rate was kept. */
  flaggedForReview: boolean
}

/** 12,000 miles a year, used until there is anything better. */
export const DEFAULT_DAILY_RATE = 32.9
const MIN_DAILY_RATE = 1
const MAX_DAILY_RATE = 300
const WEIGHT_HALFLIFE_DAYS = 180
const STALE_AFTER_DAYS = 400

const MS_PER_DAY = 86_400_000

export function parseDate(iso: string): Date {
  // Anchored to UTC noon so a local timezone offset can never shift the calendar day.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === 'string' ? parseDate(from) : from
  const b = typeof to === 'string' ? parseDate(to) : to
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // Clamp to the last day of the target month, so 31 Jan plus one month is 28 Feb.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d.toISOString().slice(0, 10)
}

function sortAscending(readings: Reading[]): Reading[] {
  return [...readings].sort((a, b) => (a.reading_date < b.reading_date ? -1 : 1))
}

/**
 * Estimates miles per day.
 *
 * @param previousRate kept when a fit lands outside the plausible clamp, so one bad
 *                     reading cannot move the whole schedule.
 */
export function estimateRate(
  readings: Reading[],
  today: string,
  previousRate: number = DEFAULT_DAILY_RATE,
): RateEstimate {
  const sorted = sortAscending(readings)
  const count = sorted.length

  if (count === 0) {
    return {
      dailyRate: DEFAULT_DAILY_RATE,
      confidence: 'default',
      method: 'default',
      readingCount: 0,
      flaggedForReview: false,
    }
  }

  const latest = sorted[count - 1]
  const stale = daysBetween(latest.reading_date, today) > STALE_AFTER_DAYS

  if (count === 1) {
    return {
      dailyRate: DEFAULT_DAILY_RATE,
      confidence: stale ? 'stale' : 'default',
      method: 'default',
      readingCount: 1,
      flaggedForReview: false,
    }
  }

  let rawRate: number
  let method: RateMethod
  let confidence: Confidence

  if (count <= 3) {
    const first = sorted[0]
    const span = daysBetween(first.reading_date, latest.reading_date)
    rawRate = span > 0 ? (latest.miles - first.miles) / span : previousRate
    method = 'endpoints'
    confidence = 'rough'
  } else {
    const fit = weightedLeastSquares(sorted, today)
    rawRate = fit.slope
    method = 'weighted_least_squares'
    confidence = count >= 6 && fit.weightedR2 >= 0.95 ? 'good' : 'rough'
  }

  const outOfRange = !Number.isFinite(rawRate) || rawRate < MIN_DAILY_RATE || rawRate > MAX_DAILY_RATE
  const dailyRate = outOfRange ? previousRate : rawRate

  return {
    dailyRate,
    confidence: stale ? 'stale' : confidence,
    method,
    readingCount: count,
    flaggedForReview: outOfRange,
  }
}

interface Fit {
  slope: number
  intercept: number
  weightedR2: number
}

/**
 * Recency weighted least squares of miles against days elapsed. The exponential weight
 * means a change in driving habits is absorbed within a few months rather than being
 * averaged against years of old data.
 */
export function weightedLeastSquares(sorted: Reading[], today: string): Fit {
  const origin = sorted[0].reading_date
  const points = sorted.map((r) => {
    const days = daysBetween(origin, r.reading_date)
    const age = daysBetween(r.reading_date, today)
    return { x: days, y: r.miles, w: Math.exp(-age / WEIGHT_HALFLIFE_DAYS) }
  })

  const sw = points.reduce((s, p) => s + p.w, 0)
  const swx = points.reduce((s, p) => s + p.w * p.x, 0)
  const swy = points.reduce((s, p) => s + p.w * p.y, 0)
  const meanX = swx / sw
  const meanY = swy / sw

  let sxx = 0
  let sxy = 0
  for (const p of points) {
    sxx += p.w * (p.x - meanX) ** 2
    sxy += p.w * (p.x - meanX) * (p.y - meanY)
  }

  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = meanY - slope * meanX

  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    ssRes += p.w * (p.y - (slope * p.x + intercept)) ** 2
    ssTot += p.w * (p.y - meanY) ** 2
  }
  const weightedR2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { slope, intercept, weightedR2 }
}

/** Standard error of the projected miles, used for the chart band when confidence is good. */
export function standardError(sorted: Reading[], today: string): number {
  if (sorted.length < 3) return 0
  const { slope, intercept } = weightedLeastSquares(sorted, today)
  const origin = sorted[0].reading_date
  const ssRes = sorted.reduce((s, r) => {
    const x = daysBetween(origin, r.reading_date)
    return s + (r.miles - (slope * x + intercept)) ** 2
  }, 0)
  return Math.sqrt(ssRes / (sorted.length - 2))
}

export interface CurrentEstimate {
  odometer: number
  rate: RateEstimate
  latest: Reading | null
  /** Projection derived alerts are suppressed while this is true. */
  suppressAlerts: boolean
}

/**
 * Current odometer estimate, rounded to the nearest 10 because precision here is false.
 */
export function estimateOdometer(
  readings: Reading[],
  today: string,
  previousRate?: number,
): CurrentEstimate {
  const sorted = sortAscending(readings)
  const rate = estimateRate(sorted, today, previousRate)
  const latest = sorted.length ? sorted[sorted.length - 1] : null

  if (!latest) {
    return { odometer: 0, rate, latest: null, suppressAlerts: true }
  }

  const elapsed = Math.max(0, daysBetween(latest.reading_date, today))
  const raw = latest.miles + elapsed * rate.dailyRate

  return {
    odometer: Math.round(raw / 10) * 10,
    rate,
    latest,
    suppressAlerts: rate.confidence === 'stale',
  }
}

/** Calendar date the car is projected to reach a given mileage, or null if already past. */
export function dateAtMiles(
  estimate: CurrentEstimate,
  today: string,
  targetMiles: number,
): string | null {
  if (!estimate.latest) return null
  const remaining = targetMiles - estimate.odometer
  if (remaining <= 0) return null
  const rate = Math.max(estimate.rate.dailyRate, MIN_DAILY_RATE)
  return addDays(today, Math.round(remaining / rate))
}
