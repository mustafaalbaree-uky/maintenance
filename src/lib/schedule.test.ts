import { describe, expect, it } from 'vitest'
import { estimateOdometer } from './projection'
import { buildSchedule, nextUpLine, scheduleEntry, statusFor } from './schedule'
import type { MaintenanceItem, ServiceLog } from './types'

const TODAY = '2026-08-15'
const PURCHASE = '2026-08-01'

function item(over: Partial<MaintenanceItem> = {}): MaintenanceItem {
  return {
    id: 'item-1',
    vehicle_id: 'v1',
    template_id: null,
    name: 'Oil and filter change',
    category: 'fluids',
    interval_miles: 5000,
    interval_months: 6,
    plain_language: 'x',
    why_it_matters: 'y',
    note: null,
    typical_cost_low_cents: null,
    typical_cost_high_cents: null,
    prevents_label: null,
    prevents_cost_low_cents: null,
    prevents_cost_high_cents: null,
    anchor_odometer: 42000,
    anchor_date: PURCHASE,
    active: true,
    sort_order: 10,
    ...over,
  }
}

function log(over: Partial<ServiceLog> = {}): ServiceLog {
  return {
    id: 'log-1',
    vehicle_id: 'v1',
    maintenance_item_id: 'item-1',
    receipt_id: null,
    performed_on: PURCHASE,
    odometer: 42000,
    description: 'Oil change',
    shop_name: null,
    cost_cents: null,
    is_warranty_claim: false,
    claim_status: null,
    deductible_paid_cents: null,
    receipt_path: null,
    notes: null,
    created_at: PURCHASE,
    ...over,
  }
}

const estimateAt = (miles: number) =>
  estimateOdometer([{ reading_date: TODAY, miles }], TODAY)

describe('statusFor', () => {
  it('ranks a negative remainder as overdue on either axis', () => {
    expect(statusFor(-10, 400)).toBe('overdue')
    expect(statusFor(4000, -1)).toBe('overdue')
  })

  it('uses whichever axis comes first', () => {
    expect(statusFor(4000, 20)).toBe('due_soon')
    expect(statusFor(400, 400)).toBe('due_soon')
    expect(statusFor(1800, 400)).toBe('upcoming')
    expect(statusFor(4000, 400)).toBe('ok')
  })

  it('ignores an axis the item does not have', () => {
    expect(statusFor(null, 400)).toBe('ok')
    expect(statusFor(4000, null)).toBe('ok')
  })
})

describe('scheduleEntry', () => {
  it('anchors at purchase when there is no service history', () => {
    const e = scheduleEntry(item(), [], estimateAt(42100), TODAY)
    expect(e.dueAtMiles).toBe(47000)
    expect(e.dueAtDate).toBe('2027-02-01')
    expect(e.milesRemaining).toBe(4900)
    expect(e.status).toBe('ok')
  })

  it('rebases on the most recent service once one exists', () => {
    const logs = [
      log({ id: 'a', performed_on: '2026-08-05', odometer: 42500 }),
      log({ id: 'b', performed_on: '2026-08-10', odometer: 43000 }),
    ]
    const e = scheduleEntry(item(), logs, estimateAt(43100), TODAY)
    expect(e.lastService?.id).toBe('b')
    expect(e.dueAtMiles).toBe(48000)
    expect(e.dueAtDate).toBe('2027-02-10')
  })

  it('reports how far past due an overdue item is', () => {
    const e = scheduleEntry(item(), [], estimateAt(47310), TODAY)
    expect(e.status).toBe('overdue')
    expect(e.milesRemaining).toBe(-310)
  })

  it('handles a mileage only item without inventing a date', () => {
    const e = scheduleEntry(item({ interval_months: null }), [], estimateAt(42100), TODAY)
    expect(e.dueAtDate).toBeNull()
    expect(e.daysRemaining).toBeNull()
  })

  it('handles a time only item without inventing a mileage', () => {
    const e = scheduleEntry(item({ interval_miles: null }), [], estimateAt(42100), TODAY)
    expect(e.dueAtMiles).toBeNull()
    expect(e.milesRemaining).toBeNull()
  })

  it('ignores service logs belonging to another item', () => {
    const other = [log({ maintenance_item_id: 'item-2', odometer: 44000 })]
    const e = scheduleEntry(item(), other, estimateAt(42100), TODAY)
    expect(e.lastService).toBeNull()
    expect(e.dueAtMiles).toBe(47000)
  })
})

describe('buildSchedule', () => {
  it('sorts most urgent first and drops inactive items', () => {
    const items = [
      item({ id: 'ok', name: 'Coolant flush', interval_miles: 60000, interval_months: null }),
      item({ id: 'late', name: 'Oil', interval_miles: 5000, interval_months: null }),
      item({ id: 'soon', name: 'Rotation', interval_miles: 5400, interval_months: null }),
      item({ id: 'off', name: 'Not mine', interval_miles: 100, interval_months: null, active: false }),
    ]
    const order = buildSchedule(items, [], estimateAt(47310), TODAY).map((e) => e.item.id)
    expect(order).toEqual(['late', 'soon', 'ok'])
  })
})

describe('nextUpLine', () => {
  // The bug: leather conditioning runs on months only, so asking for its mileage gave
  // "Nothing's due. Leather conditioning in about 0 miles."
  it('describes a time only item in time, not in zero miles', () => {
    const leather = item({
      id: 'leather',
      name: 'Leather conditioning',
      interval_miles: null,
      interval_months: 4,
    })
    const entry = scheduleEntry(leather, [], estimateAt(42000), TODAY)
    const line = nextUpLine(entry)
    expect(line).not.toContain('0 miles')
    expect(line).toContain('Leather conditioning')
    expect(line).toMatch(/around \w+ \d{4}\.$/)
  })

  it('describes a mileage only item in miles', () => {
    const coolant = item({
      id: 'coolant',
      name: 'Coolant flush',
      interval_miles: 18000,
      interval_months: null,
    })
    const entry = scheduleEntry(coolant, [], estimateAt(42000), TODAY)
    expect(nextUpLine(entry)).toBe('Nothing\'s due. Coolant flush in about 18,000 miles.')
  })

  it('does not round a near miss down to zero miles', () => {
    const soon = item({ id: 'soon', interval_miles: 5000, interval_months: null })
    const entry = scheduleEntry(soon, [], estimateAt(46960), TODAY)
    expect(nextUpLine(entry)).toContain('in under 100 miles')
  })

  it('says so plainly when there is no next item at all', () => {
    expect(nextUpLine(undefined)).toBe("Nothing's due, and nothing is scheduled yet.")
  })
})
