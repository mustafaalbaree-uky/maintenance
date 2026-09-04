import { describe, expect, it } from 'vitest'
import { nowFraction, placeWatchItems, timelineRange } from './timeline'
import type { Vehicle, WatchItem } from './types'

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    owner_id: 'u1',
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
    ...over,
  }
}

function watchItem(over: Partial<WatchItem> = {}): WatchItem {
  return {
    id: 'w1',
    vehicle_id: 'v1',
    watch_template_id: null,
    name: 'Rear suspension clunk',
    window_start_miles: 30000,
    window_end_miles: 60000,
    est_cost_low_cents: null,
    est_cost_high_cents: null,
    coverage_guess: 'likely_covered',
    coverage_note: null,
    symptoms: 'A clunk from the rear.',
    first_check: 'Check subframe bolt torque.',
    plain_language: 'The most common complaint on this car.',
    severity: 'normal',
    status: 'watching',
    resolved_service_log_id: null,
    ...over,
  }
}

describe('timelineRange', () => {
  it('runs from purchase odometer to the plan end odometer', () => {
    const range = timelineRange(vehicle(), [])
    expect(range).toEqual({ startMiles: 42000, endMiles: 102000 })
  })

  it('extends past a plan end that is shorter than a watch window', () => {
    const range = timelineRange(vehicle({ plan_end_odometer: 80000 }), [
      watchItem({ window_end_miles: 100000 }),
    ])
    expect(range.endMiles).toBe(100000)
  })

  it('falls back to the purchase odometer when there is no plan end and no watch items', () => {
    const range = timelineRange(vehicle({ plan_end_odometer: null }), [])
    expect(range).toEqual({ startMiles: 42000, endMiles: 42000 })
  })
})

describe('placeWatchItems', () => {
  const range = { startMiles: 42000, endMiles: 102000 }

  it('orders items by where their window starts', () => {
    const late = watchItem({ id: 'late', window_start_miles: 70000, window_end_miles: 100000 })
    const early = watchItem({ id: 'early', window_start_miles: 30000, window_end_miles: 60000 })
    const placed = placeWatchItems([late, early], range, 42000)
    expect(placed.map((p) => p.item.id)).toEqual(['early', 'late'])
  })

  it('places a window entirely ahead of the current odometer', () => {
    const [placed] = placeWatchItems(
      [watchItem({ window_start_miles: 70000, window_end_miles: 100000 })],
      range,
      42000,
    )
    expect(placed.position).toBe('ahead')
    expect(placed.startFraction).toBeCloseTo((70000 - 42000) / 60000)
    expect(placed.endFraction).toBeCloseTo((100000 - 42000) / 60000)
  })

  it('places the current odometer inside a window as in_window', () => {
    const [placed] = placeWatchItems(
      [watchItem({ window_start_miles: 30000, window_end_miles: 60000 })],
      range,
      50000,
    )
    expect(placed.position).toBe('in_window')
  })

  it('places a window the odometer has passed as behind', () => {
    const [placed] = placeWatchItems(
      [watchItem({ window_start_miles: 30000, window_end_miles: 60000 })],
      range,
      65000,
    )
    expect(placed.position).toBe('behind')
  })

  it('clamps fractions to the visible range rather than running off the edge', () => {
    const [placed] = placeWatchItems(
      [watchItem({ window_start_miles: 20000, window_end_miles: 200000 })],
      range,
      42000,
    )
    expect(placed.startFraction).toBe(0)
    expect(placed.endFraction).toBe(1)
  })
})

describe('nowFraction', () => {
  const range = { startMiles: 42000, endMiles: 102000 }

  it('is 0 at the purchase odometer and 1 at the far end', () => {
    expect(nowFraction(range, 42000)).toBe(0)
    expect(nowFraction(range, 102000)).toBe(1)
  })

  it('clamps a current odometer behind the purchase odometer to 0', () => {
    expect(nowFraction(range, 10000)).toBe(0)
  })
})
