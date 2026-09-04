import { describe, expect, it } from 'vitest'
import { actualSeries, midCostCents, ownershipRange, projectedSeries } from './trendline'
import type { MaintenanceItem, Receipt, ServiceLog, Vehicle } from './types'

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

function item(over: Partial<MaintenanceItem> = {}): MaintenanceItem {
  return {
    id: 'i1',
    vehicle_id: 'v1',
    template_id: null,
    name: 'Transmission fluid service',
    category: 'fluids',
    interval_miles: 35000,
    interval_months: null,
    plain_language: '',
    why_it_matters: '',
    note: null,
    typical_cost_low_cents: 4000,
    typical_cost_high_cents: 8000,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: 42000,
    anchor_date: '2026-02-15',
    active: true,
    sort_order: 1,
    ...over,
  }
}

function log(over: Partial<ServiceLog> = {}): ServiceLog {
  return {
    id: 'l1',
    vehicle_id: 'v1',
    maintenance_item_id: null,
    receipt_id: null,
    performed_on: '2026-03-01',
    odometer: 43000,
    description: 'Oil change',
    shop_name: null,
    cost_cents: null,
    is_warranty_claim: false,
    claim_status: null,
    deductible_paid_cents: null,
    receipt_path: null,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    ...over,
  }
}

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1',
    vehicle_id: 'v1',
    storage_path: null,
    performed_on: '2026-03-01',
    odometer: 43000,
    shop_name: null,
    total_cost_cents: 6000,
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    ...over,
  }
}

describe('ownershipRange', () => {
  it('runs from purchase odometer to the plan end odometer', () => {
    expect(ownershipRange(vehicle())).toEqual({ startMiles: 42000, endMiles: 102000 })
  })

  it('falls back to purchase plus 60,000 with no plan end', () => {
    expect(ownershipRange(vehicle({ plan_end_odometer: null }))).toEqual({
      startMiles: 42000,
      endMiles: 102000,
    })
  })
})

describe('midCostCents', () => {
  it('averages a low and high figure', () => {
    expect(midCostCents(4000, 8000)).toBe(6000)
  })

  it('uses whichever bound is present alone', () => {
    expect(midCostCents(null, 25000)).toBe(25000)
    expect(midCostCents(15000, null)).toBe(15000)
  })

  it('is null when the guide gives neither figure, never a fabricated number', () => {
    expect(midCostCents(null, null)).toBeNull()
  })
})

describe('projectedSeries', () => {
  const range = { startMiles: 42000, endMiles: 102000 }

  it('starts at zero at the start of the range', () => {
    const series = projectedSeries([item()], range, 32.9)
    expect(series[0]).toEqual({ miles: 42000, cumulativeCents: 0 })
  })

  it('steps up at each mileage interval occurrence within the range', () => {
    const series = projectedSeries([item()], range, 32.9)
    // 35,000 mile interval from a 42,000 anchor: 77,000 only, 112,000 is past the range.
    expect(series).toEqual([
      { miles: 42000, cumulativeCents: 0 },
      { miles: 77000, cumulativeCents: 6000 },
      { miles: 102000, cumulativeCents: 6000 },
    ])
  })

  it('places a calendar interval item using the daily rate, not a fixed mileage step', () => {
    const battery = item({
      id: 'i2',
      name: '12V battery load test',
      interval_miles: null,
      interval_months: 12,
      typical_cost_low_cents: 15000,
      typical_cost_high_cents: 25000,
    })
    // 12,000 miles a year (32.9 miles/day) puts the first occurrence about a year and
    // 12,000 miles out from the anchor.
    const series = projectedSeries([battery], range, 32.9)
    expect(series[1].miles).toBeGreaterThan(53000)
    expect(series[1].miles).toBeLessThan(55000)
    expect(series[1].cumulativeCents).toBe(20000)
  })

  it('skips an item with no cost figure at all', () => {
    const oil = item({ id: 'i3', typical_cost_low_cents: null, typical_cost_high_cents: null })
    const series = projectedSeries([oil], range, 32.9)
    expect(series).toEqual([{ miles: 42000, cumulativeCents: 0 }, { miles: 102000, cumulativeCents: 0 }])
  })

  it('skips an inactive item', () => {
    const series = projectedSeries([item({ active: false })], range, 32.9)
    expect(series).toEqual([{ miles: 42000, cumulativeCents: 0 }, { miles: 102000, cumulativeCents: 0 }])
  })

  it('holds the line flat to the end of the range after the last occurrence', () => {
    const series = projectedSeries([item()], range, 32.9)
    expect(series[series.length - 1]).toEqual({ miles: 102000, cumulativeCents: 6000 })
  })
})

describe('actualSeries', () => {
  it('is empty with no logged service', () => {
    expect(actualSeries([], [])).toEqual([])
  })

  it('counts a receipt total once, not once per job it covers', () => {
    const r = receipt({ id: 'r1', odometer: 45000, total_cost_cents: 9000 })
    const logs = [
      log({ id: 'l1', receipt_id: 'r1', odometer: 45000, cost_cents: null }),
      log({ id: 'l2', receipt_id: 'r1', odometer: 45000, cost_cents: null }),
    ]
    expect(actualSeries(logs, [r])).toEqual([{ miles: 45000, cumulativeCents: 9000 }])
  })

  it('accumulates across visits in odometer order regardless of log order', () => {
    const logs = [
      log({ id: 'l2', odometer: 50000, cost_cents: 5000 }),
      log({ id: 'l1', odometer: 43000, cost_cents: 3000 }),
    ]
    expect(actualSeries(logs, [])).toEqual([
      { miles: 43000, cumulativeCents: 3000 },
      { miles: 50000, cumulativeCents: 8000 },
    ])
  })

  it('drops a visit with no cost figure at all rather than plotting a zero', () => {
    const logs = [log({ id: 'l1', odometer: 43000, cost_cents: null })]
    expect(actualSeries(logs, [])).toEqual([])
  })
})
