// Budget summary: what the coming twelve months and the rest of ownership are projected
// to cost, plus what has already been spent. Built entirely on top of the trendline
// series, so the two screens can never disagree about what a projected occurrence costs
// or where it lands on the mileage axis.
//
// The twelve month boundary is a mileage, not a date, converted with the same adaptive
// daily rate the rest of the app uses to move between the two. The projected cost through
// that boundary is read off the trendline's step series rather than recomputed, since the
// series is already the one place occurrence placement and cost summing happen.

import type { CurrentEstimate } from './projection'
import { addMonths, daysBetween } from './projection'
import { ownershipRange, projectedSeries, actualSeries, type SeriesPoint, type TrendlineRange } from './trendline'
import type { MaintenanceItem, Receipt, ServiceLog, Vehicle } from './types'

export interface BudgetSummary {
  range: TrendlineRange
  /** Current projected mileage, clamped into the ownership range. */
  currentMiles: number
  /** Mileage the car is projected to reach twelve months from today, clamped to the range end. */
  twelveMonthMiles: number
  /** True when at least one active, costed schedule item exists to project from. */
  hasCostData: boolean
  projectedNextTwelveMonthsCents: number
  projectedRestOfOwnershipCents: number
  spentSoFarCents: number
}

/** The step series's cumulative value at a given mileage: the last point at or before it. */
function cumulativeAt(series: SeriesPoint[], atMiles: number): number {
  let value = 0
  for (const point of series) {
    if (point.miles > atMiles) break
    value = point.cumulativeCents
  }
  return value
}

export function budgetSummary(
  vehicle: Vehicle,
  items: MaintenanceItem[],
  logs: ServiceLog[],
  receipts: Receipt[],
  estimate: CurrentEstimate,
  todayIso: string,
): BudgetSummary {
  const range = ownershipRange(vehicle)
  const currentMiles = Math.min(Math.max(estimate.odometer, range.startMiles), range.endMiles)

  const rate = Math.max(estimate.rate.dailyRate, 1)
  const daysAhead = daysBetween(todayIso, addMonths(todayIso, 12))
  const twelveMonthMiles = Math.round(Math.min(currentMiles + daysAhead * rate, range.endMiles))

  const series = projectedSeries(items, range, rate)
  const hasCostData = series.some((p) => p.cumulativeCents > 0)

  const throughNow = cumulativeAt(series, currentMiles)
  const throughTwelve = cumulativeAt(series, twelveMonthMiles)
  const throughEnd = cumulativeAt(series, range.endMiles)

  const actuals = actualSeries(logs, receipts)
  const spentSoFarCents = actuals.length ? actuals[actuals.length - 1].cumulativeCents : 0

  return {
    range,
    currentMiles,
    twelveMonthMiles,
    hasCostData,
    projectedNextTwelveMonthsCents: throughTwelve - throughNow,
    projectedRestOfOwnershipCents: throughEnd - throughNow,
    spentSoFarCents,
  }
}
