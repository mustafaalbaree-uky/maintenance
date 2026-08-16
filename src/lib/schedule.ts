// Coming up: turns a maintenance item plus its service history into a due status.

import { addMonths, daysBetween, type CurrentEstimate } from './projection'
import { remainingLabel } from './format'
import type { MaintenanceItem, ServiceLog } from './types'

export type DueStatus = 'overdue' | 'due_soon' | 'upcoming' | 'ok'

export interface ScheduleEntry {
  item: MaintenanceItem
  lastService: ServiceLog | null
  dueAtMiles: number | null
  dueAtDate: string | null
  milesRemaining: number | null
  daysRemaining: number | null
  status: DueStatus
}

const STATUS_RANK: Record<DueStatus, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  ok: 3,
}

export function scheduleEntry(
  item: MaintenanceItem,
  logs: ServiceLog[],
  estimate: CurrentEstimate,
  today: string,
): ScheduleEntry {
  const forItem = logs
    .filter((l) => l.maintenance_item_id === item.id)
    .sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1))
  const last = forItem[0] ?? null

  const baseOdometer = last?.odometer ?? item.anchor_odometer
  const baseDate = last?.performed_on ?? item.anchor_date

  const dueAtMiles = item.interval_miles != null ? baseOdometer + item.interval_miles : null
  const dueAtDate = item.interval_months != null ? addMonths(baseDate, item.interval_months) : null

  const milesRemaining = dueAtMiles != null ? dueAtMiles - estimate.odometer : null
  const daysRemaining = dueAtDate != null ? daysBetween(today, dueAtDate) : null

  return {
    item,
    lastService: last,
    dueAtMiles,
    dueAtDate,
    milesRemaining,
    daysRemaining,
    status: statusFor(milesRemaining, daysRemaining),
  }
}

export function statusFor(milesRemaining: number | null, daysRemaining: number | null): DueStatus {
  const overdue =
    (milesRemaining != null && milesRemaining < 0) || (daysRemaining != null && daysRemaining < 0)
  if (overdue) return 'overdue'

  const dueSoon =
    (milesRemaining != null && milesRemaining <= 500) ||
    (daysRemaining != null && daysRemaining <= 30)
  if (dueSoon) return 'due_soon'

  const upcoming =
    (milesRemaining != null && milesRemaining <= 2000) ||
    (daysRemaining != null && daysRemaining <= 90)
  if (upcoming) return 'upcoming'

  return 'ok'
}

/** Most urgent first, then by how close the item is within its status band. */
export function sortByUrgency(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (rank !== 0) return rank
    return nearness(a) - nearness(b)
  })
}

function nearness(e: ScheduleEntry): number {
  const byMiles = e.milesRemaining ?? Number.POSITIVE_INFINITY
  // A day of driving is worth roughly a day's miles, so days are scaled to compare.
  const byDays = e.daysRemaining != null ? e.daysRemaining * 33 : Number.POSITIVE_INFINITY
  return Math.min(byMiles, byDays)
}

export function buildSchedule(
  items: MaintenanceItem[],
  logs: ServiceLog[],
  estimate: CurrentEstimate,
  today: string,
): ScheduleEntry[] {
  return sortByUrgency(
    items.filter((i) => i.active).map((i) => scheduleEntry(i, logs, estimate, today)),
  )
}

/**
 * The line shown when nothing is pending. It names the next item and how far off it is,
 * on whichever axis that item actually runs on. A time based item has no mileage, so
 * asking for its miles produced "in about 0 miles" next to "Nothing's due".
 */
export function nextUpLine(entry: ScheduleEntry | undefined): string {
  if (!entry) return "Nothing's due, and nothing is scheduled yet."
  return `Nothing's due. ${entry.item.name} ${remainingLabel(entry.milesRemaining, entry.daysRemaining)}.`
}
