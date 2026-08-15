import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { StatusRow, Button } from './ui'
import { costRange, longDate, remainingLabel } from '../lib/format'
import type { ScheduleEntry } from '../lib/schedule'

// Most rows have no cost figure, because the source document gives none. The layout is
// designed for that case first: where a field is null the row shows nothing in its place.

export function ScheduleRow({ entry }: { entry: ScheduleEntry }) {
  const { refresh } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const item = entry.item

  const cost = costRange(item.typical_cost_low_cents, item.typical_cost_high_cents)
  const prevents =
    item.prevents_label && item.prevents_cost_low_cents != null
      ? `${costRange(item.prevents_cost_low_cents, item.prevents_cost_high_cents)} if the ${item.prevents_label.toLowerCase()} is left to happen`
      : null

  async function markNotMine() {
    await supabase.from('maintenance_item').update({ active: false }).eq('id', item.id)
    await refresh()
  }

  async function remindLater() {
    const later = new Date()
    later.setDate(later.getDate() + 30)
    await supabase
      .from('maintenance_item')
      .update({ anchor_date: later.toISOString().slice(0, 10) })
      .eq('id', item.id)
    await refresh()
  }

  return (
    <div>
      <StatusRow status={entry.status} onClick={() => setOpen((o) => !o)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-card-title">{item.name}</span>
          <span className="t-figure text-text-2">
            {remainingLabel(entry.milesRemaining, entry.daysRemaining)}
          </span>
        </div>
        {open ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="t-body text-text-2">{item.plain_language}</p>
            <p className="t-body text-text-2">{item.why_it_matters}</p>
            {item.note ? <p className="t-support">{item.note}</p> : null}
            {cost ? <p className="t-support">Usually {cost}.</p> : null}
            {prevents ? <p className="t-support">Against {prevents}.</p> : null}
            {entry.lastService ? (
              <p className="t-support text-text-3">
                Last done {longDate(entry.lastService.performed_on)} at{' '}
                {entry.lastService.odometer.toLocaleString('en-US')} miles.
              </p>
            ) : null}
          </div>
        ) : null}
      </StatusRow>

      {open ? (
        <div className="mt-2 flex flex-wrap gap-2 pl-1">
          <Button
            onClick={() =>
              navigate(`/log?item=${item.id}&name=${encodeURIComponent(item.name)}`)
            }
          >
            I did this
          </Button>
          <Button variant="secondary" onClick={() => void remindLater()}>
            Remind me later
          </Button>
          <Button variant="secondary" onClick={() => void markNotMine()}>
            Not on my car
          </Button>
        </div>
      ) : null}
    </div>
  )
}
