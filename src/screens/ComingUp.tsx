import { useState } from 'react'
import { useStore } from '../lib/store'
import { ScheduleRow } from '../components/ScheduleRow'
import { TrendlineChart } from '../components/TrendlineChart'
import { Card, SectionLabel } from '../components/ui'
import { nextUpLine } from '../lib/schedule'

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
          <p className="t-body text-text-2">{nextUpLine(next)}</p>
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

      <div className="mt-7">
        <TrendlineChart />
      </div>
    </div>
  )
}
