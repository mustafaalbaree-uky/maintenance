import { useState } from 'react'
import { useStore } from '../lib/store'
import { Card, EmptyState, SectionLabel } from '../components/ui'
import { costRange, coverageSentence, miles } from '../lib/format'
import { placeWatchItems, timelineRange, nowFraction } from '../lib/timeline'
import type { PlacedWatchItem } from '../lib/timeline'

const POSITION_COLOR: Record<PlacedWatchItem['position'], string> = {
  ahead: 'var(--color-line)',
  in_window: 'var(--color-soon)',
  behind: 'var(--color-text-3)',
}

const POSITION_WORD: Record<PlacedWatchItem['position'], string> = {
  ahead: 'Ahead',
  in_window: 'In this window now',
  behind: 'Passed this window',
}

function TrackRow({ placed, nowFrac }: { placed: PlacedWatchItem; nowFrac: number }) {
  const widthPct = Math.max(0.5, (placed.endFraction - placed.startFraction) * 100)
  return (
    <div className="relative mt-3 h-[6px] rounded-full bg-panel-hi">
      <div
        className="absolute h-[6px] rounded-full"
        style={{
          left: `${placed.startFraction * 100}%`,
          width: `${widthPct}%`,
          background: POSITION_COLOR[placed.position],
        }}
      />
      <div
        className="absolute top-1/2 h-[14px] w-[2px] -translate-y-1/2"
        style={{ left: `${nowFrac * 100}%`, background: 'var(--color-action)' }}
        aria-hidden="true"
      />
    </div>
  )
}

function WatchItemRow({ placed, nowFrac }: { placed: PlacedWatchItem; nowFrac: number }) {
  const [open, setOpen] = useState(false)
  const item = placed.item
  const cost = costRange(item.est_cost_low_cents, item.est_cost_high_cents)

  return (
    <Card>
      <button className="block w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-card-title">{item.name}</span>
          <span className="t-figure" style={{ color: POSITION_COLOR[placed.position] }}>
            {POSITION_WORD[placed.position]}
          </span>
        </div>
        <p className="t-support mt-[3px] text-text-3">
          {miles(item.window_start_miles)} to {miles(item.window_end_miles)} miles
        </p>
        <TrackRow placed={placed} nowFrac={nowFrac} />
      </button>

      <div className="expandable" data-open={open} aria-hidden={!open}>
        <div>
          <div className="mt-3 flex flex-col gap-2">
            <p className="t-body text-text-2">{item.plain_language}</p>
            <p className="t-body text-text-2">{item.symptoms}</p>
            <p className="t-support">{item.first_check}</p>
            <p className="t-support">{coverageSentence(item.coverage_guess)}</p>
            {cost ? <p className="t-support">Usually {cost}.</p> : null}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function Timeline() {
  const { vehicle, watchItems, estimate } = useStore()

  if (!vehicle) return null

  const range = timelineRange(vehicle, watchItems)
  const placed = placeWatchItems(watchItems, range, estimate.odometer)
  const nowFrac = nowFraction(range, estimate.odometer)

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-2">Timeline</h1>
      <p className="t-support mb-5 text-text-3">
        Purchased at {miles(vehicle.purchase_odometer)} miles. Now near {miles(estimate.odometer)}{' '}
        miles.
      </p>

      {placed.length ? (
        <>
          <SectionLabel>Watch items</SectionLabel>
          <div className="flex flex-col gap-2">
            {placed.map((p) => (
              <WatchItemRow key={p.item.id} placed={p} nowFrac={nowFrac} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState>No watch items are on file for this vehicle.</EmptyState>
      )}
    </div>
  )
}
