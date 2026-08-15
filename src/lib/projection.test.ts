import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DAILY_RATE,
  addDays,
  addMonths,
  dateAtMiles,
  daysBetween,
  estimateOdometer,
  estimateRate,
  weightedLeastSquares,
  type Reading,
} from './projection'

const TODAY = '2026-08-15'

/** Readings every `stepDays` apart at a fixed miles per day. */
function series(start: string, startMiles: number, perDay: number, count: number, stepDays = 30): Reading[] {
  return Array.from({ length: count }, (_, i) => ({
    reading_date: addDays(start, i * stepDays),
    miles: Math.round(startMiles + i * stepDays * perDay),
  }))
}

describe('date helpers', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2026-08-15', '2026-08-15')).toBe(0)
  })

  it('clamps a month addition to the last valid day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-08-15', 6)).toBe('2027-02-15')
  })

  it('does not drift across a daylight saving change', () => {
    // US DST begins 8 March 2026. A naive local-time implementation loses an hour here.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
  })
})

describe('estimateRate', () => {
  it('falls back to 12,000 miles a year with a single reading', () => {
    const r = estimateRate([{ reading_date: '2026-08-01', miles: 42000 }], TODAY)
    expect(r.dailyRate).toBe(DEFAULT_DAILY_RATE)
    expect(r.confidence).toBe('default')
    expect(r.method).toBe('default')
  })

  it('uses first to last endpoints for two to three readings', () => {
    const readings = series('2026-06-01', 42000, 40, 3)
    const r = estimateRate(readings, TODAY)
    expect(r.dailyRate).toBeCloseTo(40, 6)
    expect(r.confidence).toBe('rough')
    expect(r.method).toBe('endpoints')
  })

  it('fits weighted least squares at four or more readings', () => {
    const r = estimateRate(series('2026-01-01', 42000, 35, 5), TODAY)
    expect(r.method).toBe('weighted_least_squares')
    expect(r.dailyRate).toBeCloseTo(35, 4)
    // Five readings is short of the six needed for 'good'.
    expect(r.confidence).toBe('rough')
  })

  it('reports good confidence on six clean readings', () => {
    const r = estimateRate(series('2026-01-01', 42000, 35, 7), TODAY)
    expect(r.confidence).toBe('good')
    expect(r.dailyRate).toBeCloseTo(35, 4)
  })

  it('weights recent driving more heavily than old driving', () => {
    // Twenty miles a day for a year, then sixty a day for the last two months.
    const early = series('2025-06-01', 30000, 20, 12, 30)
    const lastEarly = early[early.length - 1]
    const late = series(lastEarly.reading_date, lastEarly.miles, 60, 3, 30).slice(1)
    const readings = [...early, ...late]
    const weighted = estimateRate(readings, TODAY).dailyRate
    const unweighted = weightedLeastSquares(
      readings.map((r) => ({ ...r })),
      // Dating "today" at the first reading flattens every weight to the same value,
      // which is an unweighted fit.
      readings[0].reading_date,
    ).slope

    expect(weighted).toBeGreaterThan(unweighted)
    // Two months of new habit against a year of old habit moves the estimate part of
    // the way, not all of it. The 180 day halflife is what sets that pace.
    expect(weighted).toBeGreaterThan(25)
    expect(weighted).toBeLessThan(60)
  })

  it('keeps the previous rate when a fit lands outside the clamp', () => {
    // Two readings a day apart with a 5,000 mile jump implies an impossible rate.
    const readings: Reading[] = [
      { reading_date: '2026-08-01', miles: 42000 },
      { reading_date: '2026-08-02', miles: 47000 },
    ]
    const r = estimateRate(readings, TODAY, 31)
    expect(r.dailyRate).toBe(31)
    expect(r.flaggedForReview).toBe(true)
  })

  it('goes stale when the newest reading is over 400 days old', () => {
    const readings = series('2024-01-01', 30000, 30, 6)
    const r = estimateRate(readings, TODAY)
    expect(r.confidence).toBe('stale')
  })
})

describe('estimateOdometer', () => {
  it('projects forward from the latest reading and rounds to the nearest ten', () => {
    const e = estimateOdometer([{ reading_date: '2026-07-16', miles: 42000 }], TODAY)
    // 30 days at the default 32.9 a day is 987 miles.
    expect(e.odometer).toBe(42990)
    expect(e.latest?.miles).toBe(42000)
  })

  it('suppresses alerts while the estimate is stale', () => {
    const e = estimateOdometer(series('2024-01-01', 30000, 30, 6), TODAY)
    expect(e.suppressAlerts).toBe(true)
  })

  it('returns a zero estimate with no readings at all', () => {
    const e = estimateOdometer([], TODAY)
    expect(e.odometer).toBe(0)
    expect(e.suppressAlerts).toBe(true)
  })

  it('never projects backwards when the latest reading is in the future', () => {
    const e = estimateOdometer([{ reading_date: '2026-09-01', miles: 43000 }], TODAY)
    expect(e.odometer).toBe(43000)
  })
})

describe('dateAtMiles', () => {
  it('names the calendar date the car reaches a mileage', () => {
    const e = estimateOdometer([{ reading_date: TODAY, miles: 42000 }], TODAY)
    // 18,000 miles to 60,000 at 32.9 a day is 547 days.
    expect(dateAtMiles(e, TODAY, 60000)).toBe(addDays(TODAY, 547))
  })

  it('returns null for a mileage already passed', () => {
    const e = estimateOdometer([{ reading_date: TODAY, miles: 42000 }], TODAY)
    expect(dateAtMiles(e, TODAY, 41000)).toBeNull()
  })
})
