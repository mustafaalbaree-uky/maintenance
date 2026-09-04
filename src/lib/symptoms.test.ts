import { describe, expect, it } from 'vitest'
import { relatedWatchItem, searchSymptoms } from './symptoms'
import type { SymptomRef, WatchItem } from './types'

function symptom(over: Partial<SymptomRef> = {}): SymptomRef {
  return {
    id: 's1',
    template_set: 'g70_33t',
    symptom: 'Clunk from the rear over bumps',
    aliases: ['clunking noise', 'knocking over bumps'],
    first_check: 'Have the shop check rear subframe bolt torque before buying any parts.',
    likely_cause: 'Loose rear subframe bolts, which cost nothing to tighten.',
    watch_template_id: 'wt1',
    urgency: 'normal',
    ...over,
  }
}

function watchItem(over: Partial<WatchItem> = {}): WatchItem {
  return {
    id: 'w1',
    vehicle_id: 'v1',
    watch_template_id: 'wt1',
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

describe('searchSymptoms', () => {
  it('returns every symptom for an empty query', () => {
    const all = [symptom(), symptom({ id: 's2', symptom: 'Rough idle' })]
    expect(searchSymptoms(all, '')).toEqual(all)
    expect(searchSymptoms(all, '   ')).toEqual(all)
  })

  it('matches on the symptom name, case insensitive', () => {
    const all = [symptom({ symptom: 'Clunk from the rear over bumps' })]
    expect(searchSymptoms(all, 'CLUNK')).toHaveLength(1)
    expect(searchSymptoms(all, 'rear')).toHaveLength(1)
  })

  it('matches on an alias when the symptom name does not contain the word', () => {
    const all = [symptom({ symptom: 'Clunk from the rear over bumps', aliases: ['rattle from the back'] })]
    expect(searchSymptoms(all, 'rattle')).toHaveLength(1)
  })

  it('treats a null aliases column as no aliases rather than throwing', () => {
    const all = [symptom({ aliases: null })]
    expect(searchSymptoms(all, 'clunk')).toHaveLength(1)
    expect(searchSymptoms(all, 'nothing matches this')).toHaveLength(0)
  })

  it('returns nothing when no symptom or alias matches', () => {
    const all = [symptom()]
    expect(searchSymptoms(all, 'transmission fluid smell')).toEqual([])
  })
})

describe('relatedWatchItem', () => {
  it('finds the vehicle watch item provisioned from the same template', () => {
    const items = [watchItem()]
    expect(relatedWatchItem(symptom({ watch_template_id: 'wt1' }), items)).toBe(items[0])
  })

  it('is null when the symptom carries no watch_template_id', () => {
    expect(relatedWatchItem(symptom({ watch_template_id: null }), [watchItem()])).toBeNull()
  })

  it('is null when no provisioned watch item traces to that template', () => {
    const items = [watchItem({ watch_template_id: 'wt2' })]
    expect(relatedWatchItem(symptom({ watch_template_id: 'wt1' }), items)).toBeNull()
  })
})
