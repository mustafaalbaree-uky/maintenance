// Timeline: places watch items on a mileage axis running from purchase mileage forward,
// with the current odometer marked. Pure so the placement math is unit tested without a
// database.

import type { Vehicle, WatchItem } from './types'

export interface TimelineRange {
  startMiles: number
  endMiles: number
}

export interface PlacedWatchItem {
  item: WatchItem
  /** 0 to 1, position of the window's start on the shared axis. */
  startFraction: number
  /** 0 to 1, position of the window's end on the shared axis. */
  endFraction: number
  /** Where the current odometer sits relative to this item's own window. */
  position: 'ahead' | 'in_window' | 'behind'
}

/**
 * The axis runs from the purchase odometer to the plan end odometer. A vehicle with no
 * plan end, or watch items whose windows reach past it, extends the axis to cover them,
 * since a watch item cut off the edge of its own timeline is a rendering bug, not a
 * design choice.
 */
export function timelineRange(vehicle: Vehicle, watchItems: WatchItem[]): TimelineRange {
  const start = vehicle.purchase_odometer
  const candidateEnds = [
    vehicle.plan_end_odometer ?? start,
    ...watchItems.map((w) => w.window_end_miles),
  ]
  const end = Math.max(start, ...candidateEnds)
  return { startMiles: start, endMiles: end }
}

function fraction(miles: number, range: TimelineRange): number {
  const span = range.endMiles - range.startMiles
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (miles - range.startMiles) / span))
}

export function placeWatchItems(
  watchItems: WatchItem[],
  range: TimelineRange,
  currentOdometer: number,
): PlacedWatchItem[] {
  return [...watchItems]
    .sort((a, b) => a.window_start_miles - b.window_start_miles)
    .map((item) => {
      let position: PlacedWatchItem['position'] = 'ahead'
      if (currentOdometer >= item.window_end_miles) position = 'behind'
      else if (currentOdometer >= item.window_start_miles) position = 'in_window'

      return {
        item,
        startFraction: fraction(item.window_start_miles, range),
        endFraction: fraction(item.window_end_miles, range),
        position,
      }
    })
}

/** Where the current odometer falls on the shared axis, clamped to the visible range. */
export function nowFraction(range: TimelineRange, currentOdometer: number): number {
  return fraction(currentOdometer, range)
}
