// Trendline: projected cumulative maintenance cost across the ownership horizon, plotted
// against odometer, the same axis Timeline uses. Pure so the series math is unit tested
// without a database.
//
// The projected line only uses maintenance_item rows, not watch_item rows. A watch item
// carries a coverage guess, not a certainty, and folding a maybe into a cumulative cost
// of ownership number would state a guess as a fact. Watch items already have their own
// figures on /timeline.

import { addMonths, daysBetween } from './projection'
import type { MaintenanceItem, Receipt, ServiceLog, Vehicle } from './types'

export interface TrendlineRange {
  startMiles: number
  endMiles: number
}

export interface SeriesPoint {
  miles: number
  cumulativeCents: number
}

/** Purchase odometer to the plan end, or purchase plus 60,000 when no plan end is set. */
export function ownershipRange(vehicle: Vehicle): TrendlineRange {
  const startMiles = vehicle.purchase_odometer
  const endMiles = vehicle.plan_end_odometer ?? startMiles + 60000
  return { startMiles, endMiles: Math.max(startMiles, endMiles) }
}

/** The middle of a cost range, or the one bound present, or null when the guide gives neither. */
export function midCostCents(low: number | null, high: number | null): number | null {
  if (low == null && high == null) return null
  if (low != null && high != null) return Math.round((low + high) / 2)
  return (low ?? high) as number
}

/**
 * Every future occurrence of every active, costed schedule item across the range, each
 * placed on the mileage axis. A mileage interval item places directly. A calendar
 * interval item (nothing here runs on both) is converted to a mileage position with the
 * same adaptive daily rate the rest of the app uses to move between miles and dates, so a
 * once a year item lands where the car is actually expected to be in a year, not where a
 * flat 12,000 mile assumption would put it.
 */
function occurrences(
  items: MaintenanceItem[],
  range: TrendlineRange,
  dailyRate: number,
): { miles: number; cents: number }[] {
  const rate = Math.max(dailyRate, 1)
  const found: { miles: number; cents: number }[] = []

  for (const item of items) {
    if (!item.active) continue
    const cents = midCostCents(item.typical_cost_low_cents, item.typical_cost_high_cents)
    if (cents == null) continue

    if (item.interval_miles != null && item.interval_miles > 0) {
      for (
        let miles = item.anchor_odometer + item.interval_miles;
        miles <= range.endMiles;
        miles += item.interval_miles
      ) {
        if (miles >= range.startMiles) found.push({ miles, cents })
      }
      continue
    }

    if (item.interval_months != null && item.interval_months > 0) {
      let date = addMonths(item.anchor_date, item.interval_months)
      let guard = 0
      while (guard++ < 200) {
        const miles = item.anchor_odometer + daysBetween(item.anchor_date, date) * rate
        if (miles > range.endMiles) break
        if (miles >= range.startMiles) found.push({ miles: Math.round(miles), cents })
        date = addMonths(date, item.interval_months)
      }
    }
  }

  return found.sort((a, b) => a.miles - b.miles)
}

/**
 * The projected cumulative cost line: zero at the start of the range, stepping up at
 * every projected occurrence, held flat out to the end of the range so the line always
 * spans the full horizon rather than stopping at the last dollar figure the seed data
 * happens to give.
 */
export function projectedSeries(
  items: MaintenanceItem[],
  range: TrendlineRange,
  dailyRate: number,
): SeriesPoint[] {
  const points: SeriesPoint[] = [{ miles: range.startMiles, cumulativeCents: 0 }]
  let cumulative = 0
  for (const o of occurrences(items, range, dailyRate)) {
    cumulative += o.cents
    points.push({ miles: o.miles, cumulativeCents: cumulative })
  }
  const last = points[points.length - 1]
  if (last.miles < range.endMiles) {
    points.push({ miles: range.endMiles, cumulativeCents: last.cumulativeCents })
  }
  return points
}

/**
 * Actual spend so far, one point per visit rather than per logged job: a receipt covering
 * three jobs carries one dollar total, and counting each job under it would triple count
 * the same paperwork. Mirrors the grouping in History.tsx. A visit with no cost figure at
 * all (no receipt total, no logged cost) contributes no point rather than a zero.
 */
export function actualSeries(logs: ServiceLog[], receipts: Receipt[]): SeriesPoint[] {
  const byReceipt = new Map<string, { odometer: number; cents: number | null }>()
  const loose: { odometer: number; cents: number | null }[] = []

  for (const log of logs) {
    if (log.receipt_id) {
      if (byReceipt.has(log.receipt_id)) continue
      const receipt = receipts.find((r) => r.id === log.receipt_id) ?? null
      byReceipt.set(log.receipt_id, {
        odometer: log.odometer,
        cents: receipt?.total_cost_cents ?? log.cost_cents,
      })
    } else {
      loose.push({ odometer: log.odometer, cents: log.cost_cents })
    }
  }

  const visits = [...byReceipt.values(), ...loose]
    .filter((v): v is { odometer: number; cents: number } => v.cents != null)
    .sort((a, b) => a.odometer - b.odometer)

  let cumulative = 0
  return visits.map((v) => {
    cumulative += v.cents
    return { miles: v.odometer, cumulativeCents: cumulative }
  })
}
