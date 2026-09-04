// Symptom lookup: search over the guide's symptom list, and the vehicle specific watch
// item a symptom traces to, if it traces to one. Pure so the matching is unit tested
// without a database.

import type { SymptomRef, WatchItem } from './types'

/**
 * Case insensitive substring match against the symptom name and its aliases. An empty
 * query returns every symptom in the order given.
 */
export function searchSymptoms(symptoms: SymptomRef[], query: string): SymptomRef[] {
  const q = query.trim().toLowerCase()
  if (!q) return symptoms
  return symptoms.filter((s) => {
    if (s.symptom.toLowerCase().includes(q)) return true
    return (s.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  })
}

/**
 * The vehicle's own watch item provisioned from the same template as this symptom, if
 * one exists. A symptom with no watch_template_id, or one whose template was never
 * provisioned onto this vehicle, has no related item and links to nothing.
 */
export function relatedWatchItem(symptom: SymptomRef, watchItems: WatchItem[]): WatchItem | null {
  if (!symptom.watch_template_id) return null
  return watchItems.find((w) => w.watch_template_id === symptom.watch_template_id) ?? null
}
