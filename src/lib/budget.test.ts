import { describe, expect, it } from 'vitest'
import { budgetSummary } from './budget'
import type { CurrentEstimate } from './projection'
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

function estimate(odometer: number, dailyRate = 32.9): CurrentEstimate {
  return {
    odometer,
    rate: { dailyRate, confidence: 'good', method: 'weighted_least_squares', readingCount: 6, flaggedForReview: false },
    latest: { reading_date: '2026-06-01', miles: odometer },
    suppressAlerts: false,
  }
}

const TODAY = '2026-06-01'

describe('budgetSummary', () => {
  it('clamps current mileage into the ownership range', () => {
    const s = budgetSummary(vehicle(), [item()], [], [], estimate(40000), TODAY)
    expect(s.currentMiles).toBe(42000)
  })

  it('projects the twelve month boundary forward with the daily rate, clamped to the range end', () => {
    const s = budgetSummary(vehicle(), [item()], [], [], estimate(42000, 32.9), TODAY)
    // 365 days at 32.9 miles/day is about 12,000 miles past 42,000.
    expect(s.twelveMonthMiles).toBeGreaterThan(53500)
    expect(s.twelveMonthMiles).toBeLessThan(54500)

    const nearEnd = budgetSummary(vehicle(), [item()], [], [], estimate(100000, 300), TODAY)
    expect(nearEnd.twelveMonthMiles).toBe(102000)
  })

  it('is zero for the next twelve months when the only occurrence falls further out', () => {
    // 35,000 mile interval from a 42,000 anchor lands at 77,000, well past a year out.
    const s = budgetSummary(vehicle(), [item()], [], [], estimate(42000, 32.9), TODAY)
    expect(s.projectedNextTwelveMonthsCents).toBe(0)
    expect(s.projectedRestOfOwnershipCents).toBe(6000)
  })

  it('counts an occurrence in the next twelve months once the car is close enough to reach it', () => {
    const s = budgetSummary(vehicle(), [item()], [], [], estimate(76500, 32.9), TODAY)
    expect(s.projectedNextTwelveMonthsCents).toBe(6000)
    expect(s.projectedRestOfOwnershipCents).toBe(6000)
  })

  it('has no cost data when nothing active carries a cost figure', () => {
    const oil = item({ typical_cost_low_cents: null, typical_cost_high_cents: null })
    const s = budgetSummary(vehicle(), [oil], [], [], estimate(42000), TODAY)
    expect(s.hasCostData).toBe(false)
    expect(s.projectedNextTwelveMonthsCents).toBe(0)
    expect(s.projectedRestOfOwnershipCents).toBe(0)
  })

  it('reads spent so far off the last point of the actual series', () => {
    const r = receipt({ id: 'r1', odometer: 45000, total_cost_cents: 9000 })
    const logs = [
      log({ id: 'l1', receipt_id: 'r1', odometer: 45000, cost_cents: null }),
      log({ id: 'l2', odometer: 50000, cost_cents: 3000 }),
    ]
    const s = budgetSummary(vehicle(), [item()], logs, [r], estimate(51000), TODAY)
    expect(s.spentSoFarCents).toBe(12000)
  })

  it('is zero spent so far with no logged service', () => {
    const s = budgetSummary(vehicle(), [item()], [], [], estimate(42000), TODAY)
    expect(s.spentSoFarCents).toBe(0)
  })
})
