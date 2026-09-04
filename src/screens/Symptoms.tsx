import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Card, EmptyState, Input, SectionLabel } from '../components/ui'
import { costRange, coverageSentence, miles } from '../lib/format'
import { relatedWatchItem, searchSymptoms } from '../lib/symptoms'
import type { SymptomRef } from '../lib/types'

const URGENCY_COLOR: Record<SymptomRef['urgency'], string> = {
  stop_driving: 'var(--color-overdue)',
  soon: 'var(--color-soon)',
  normal: 'var(--color-text-3)',
}

const URGENCY_WORD: Record<SymptomRef['urgency'], string> = {
  stop_driving: 'Stop driving',
  soon: 'Check soon',
  normal: '',
}

function SymptomRow({ symptom }: { symptom: SymptomRef }) {
  const { watchItems } = useStore()
  const [open, setOpen] = useState(false)
  const watchItem = relatedWatchItem(symptom, watchItems)
  const cost = watchItem ? costRange(watchItem.est_cost_low_cents, watchItem.est_cost_high_cents) : null
  const urgencyWord = URGENCY_WORD[symptom.urgency]

  return (
    <Card>
      <button className="block w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-card-title">{symptom.symptom}</span>
          {urgencyWord ? (
            <span className="t-figure" style={{ color: URGENCY_COLOR[symptom.urgency] }}>
              {urgencyWord}
            </span>
          ) : null}
        </div>
      </button>

      <div className="expandable" data-open={open} aria-hidden={!open}>
        <div>
          <div className="mt-3 flex flex-col gap-2">
            <p className="t-body text-text-2">{symptom.likely_cause}</p>
            <p className="t-support">{symptom.first_check}</p>
            {watchItem ? (
              <>
                <p className="t-support text-text-3">
                  Related: {watchItem.name}, {miles(watchItem.window_start_miles)} to{' '}
                  {miles(watchItem.window_end_miles)} miles.
                </p>
                <p className="t-support">{coverageSentence(watchItem.coverage_guess)}</p>
                {cost ? <p className="t-support">Usually {cost}.</p> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function Symptoms() {
  const { vehicle } = useStore()
  const [symptoms, setSymptoms] = useState<SymptomRef[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('symptom_ref')
      .select('*')
      .order('symptom')
      .then(({ data }) => {
        if (cancelled) return
        setSymptoms((data as SymptomRef[]) ?? [])
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!vehicle) return null

  const results = searchSymptoms(symptoms, query)

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-2">Symptoms</h1>
      <p className="t-support mb-5 text-text-3">What the ownership guide says to check first.</p>

      <div className="mb-5">
        <Input
          label="Search"
          placeholder="Search symptoms"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!loaded ? null : results.length ? (
        <>
          <SectionLabel>
            {results.length} symptom{results.length === 1 ? '' : 's'}
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {results.map((s) => (
              <SymptomRow key={s.id} symptom={s} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState>No symptom in the guide matches that search.</EmptyState>
      )}
    </div>
  )
}
