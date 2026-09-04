import { describe, expect, it } from 'vitest'
import { capEndpoints, milesUntilCap, resolvedCapMiles } from './warranty'
import type { Warranty } from './types'

function warranty(over: Partial<Warranty> = {}): Warranty {
  return {
    id: 'w1',
    vehicle_id: 'v1',
    name: 'MaxCare',
    ends_at_miles: 75000,
    ends_at_date: null,
    cap_is_total_odometer: null,
    starts_from_odometer: null,
    deductible_cents: 40000,
    reduced_deductible_cents: 35000,
    reduced_deductible_condition: null,
    coverage_type: 'exclusionary',
    notes: null,
    cap_basis_recorded_at: null,
    ...over,
  }
}

describe('capEndpoints', () => {
  it('gives both readings of an unresolved mileage cap', () => {
    const endpoints = capEndpoints(warranty(), 42000)
    expect(endpoints).toEqual({ totalOdometerMiles: 75000, sincePurchaseMiles: 117000 })
  })

  it('is null when the row has no mileage cap', () => {
    expect(capEndpoints(warranty({ ends_at_miles: null }), 42000)).toBeNull()
  })
})

describe('resolvedCapMiles', () => {
  it('is null while the basis is not recorded', () => {
    expect(resolvedCapMiles(warranty({ cap_is_total_odometer: null }), 42000)).toBeNull()
  })

  it('is the mileage cap itself once the basis is total odometer', () => {
    expect(resolvedCapMiles(warranty({ cap_is_total_odometer: true }), 42000)).toBe(75000)
  })

  it('adds the purchase odometer once the basis is since purchase', () => {
    expect(resolvedCapMiles(warranty({ cap_is_total_odometer: false }), 42000)).toBe(117000)
  })

  it('prefers the row own starts_from_odometer over the vehicle purchase odometer', () => {
    const w = warranty({ cap_is_total_odometer: false, starts_from_odometer: 42500 })
    expect(resolvedCapMiles(w, 42000)).toBe(117500)
  })

  it('is null when the row has no mileage cap at all, basis or not', () => {
    expect(resolvedCapMiles(warranty({ ends_at_miles: null, cap_is_total_odometer: true }), 42000)).toBeNull()
  })

  it('resolves the factory warranty, whose basis is always total odometer', () => {
    const factory = warranty({
      name: 'Factory New Vehicle Limited Warranty',
      ends_at_miles: 60000,
      cap_is_total_odometer: true,
    })
    expect(resolvedCapMiles(factory, 42000)).toBe(60000)
  })
})

describe('milesUntilCap', () => {
  it('is positive before the cap', () => {
    expect(milesUntilCap(75000, 47000)).toBe(28000)
  })

  it('is negative once past the cap', () => {
    expect(milesUntilCap(75000, 80000)).toBe(-5000)
  })

  it('is null when there is no resolved cap', () => {
    expect(milesUntilCap(null, 47000)).toBeNull()
  })
})
