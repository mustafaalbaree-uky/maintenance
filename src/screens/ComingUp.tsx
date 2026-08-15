import { useState } from 'react'
import { useStore } from '../lib/store'
import { ScheduleRow } from '../components/ScheduleRow'
import { Card, SectionLabel } from '../components/ui'
import { miles } from '../lib/format'

export function ComingUp() {
  const { schedule } = useStore()
  const [showAll, setShowAll] = useState(false)

  const pending = schedule.filter((e) => e.status !== 'ok')
  const rest = schedule.filter((e) => e.status === 'ok')
  const next = rest[0]

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-5">Coming up</h1>

      {pending.length ? (
        <div className="flex flex-col gap-2">
          {pending.map((entry) => (
            <ScheduleRow key={entry.item.id} entry={entry} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="t-body text-text-2">
            {next
              ? `Nothing's due. ${next.item.name} in about ${miles(
                  Math.round((next.milesRemaining ?? 0) / 100) * 100,
                )} miles.`
              : "Nothing's due."}
          </p>
        </Card>
      )}

      {rest.length ? (
        <div className="mt-7">
          <button
            className="t-support hover:text-text"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
          >
            {showAll ? 'Hide the full schedule' : 'See the full schedule'}
          </button>

          {showAll ? (
            <div className="mt-4">
              <SectionLabel>Further out</SectionLabel>
              <div className="flex flex-col gap-2">
                {rest.map((entry) => (
                  <ScheduleRow key={entry.item.id} entry={entry} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
