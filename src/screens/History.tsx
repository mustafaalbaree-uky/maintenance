import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Button, Card, CardGrid, EmptyState } from '../components/ui'
import { longDate, money } from '../lib/format'
import type { Receipt, ServiceLog } from '../lib/types'

// One visit, one piece of paper, however many jobs. Grouping by receipt is what the
// paperwork actually looks like, and it is what a warranty administrator reads.
//
// The completeness indicator is functional, not decorative: missing records is the single
// most common reason claims get denied.

interface Visit {
  receipt: Receipt | null
  logs: ServiceLog[]
}

function claimReady(visit: Visit): boolean {
  const hasPhoto = visit.receipt
    ? Boolean(visit.receipt.storage_path)
    : visit.logs.every((l) => Boolean(l.receipt_path))
  return (
    hasPhoto &&
    visit.logs.length > 0 &&
    visit.logs.every((l) => Boolean(l.odometer && l.performed_on && l.description))
  )
}

export function History() {
  const { logs, receipts } = useStore()

  const visits = useMemo<Visit[]>(() => {
    const byReceipt = new Map<string, Visit>()
    const loose: Visit[] = []

    for (const log of logs) {
      if (log.receipt_id) {
        const found = byReceipt.get(log.receipt_id)
        if (found) found.logs.push(log)
        else
          byReceipt.set(log.receipt_id, {
            receipt: receipts.find((r) => r.id === log.receipt_id) ?? null,
            logs: [log],
          })
      } else {
        // Logged before receipts were grouped, or saved without one.
        loose.push({ receipt: null, logs: [log] })
      }
    }

    return [...byReceipt.values(), ...loose].sort((a, b) =>
      a.logs[0].performed_on < b.logs[0].performed_on ? 1 : -1,
    )
  }, [logs, receipts])

  const ready = visits.filter(claimReady).length

  return (
    <div className="px-4 py-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="t-title">Receipts</h1>
        {visits.length ? (
          <span className="t-figure text-text-2">
            {ready} of {visits.length} claim ready
          </span>
        ) : null}
      </div>

      <p className="t-support mb-4 max-w-prose">
        This is what your warranty reads if it ever argues with you. Every receipt needs the
        VIN, the date, the odometer, and what was done. The odometer is the one shops leave
        off, and the one that gets claims denied.
      </p>

      <Link to="/log" className="mb-5 block">
        <Button className="w-full">Log a service</Button>
      </Link>

      {visits.length === 0 ? (
        <EmptyState>
          Your service records go here. Every receipt with a VIN, date, odometer, and
          description is one your warranty can't argue with.
        </EmptyState>
      ) : (
        <CardGrid>
          {visits.map((visit) => {
            const first = visit.logs[0]
            const total = visit.receipt?.total_cost_cents ?? first.cost_cents
            const shop = visit.receipt?.shop_name ?? first.shop_name
            const hasPhoto = visit.receipt
              ? Boolean(visit.receipt.storage_path)
              : Boolean(first.receipt_path)

            return (
              <Card key={visit.receipt?.id ?? first.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-card-title">
                    {longDate(first.performed_on)}
                    {shop ? `, ${shop}` : ''}
                  </span>
                  <span className="t-figure text-text-2">
                    {first.odometer.toLocaleString('en-US')} mi
                  </span>
                </div>

                <ul className="mt-2 flex flex-col gap-[2px]">
                  {visit.logs.map((l) => (
                    <li key={l.id} className="t-body text-text-2">
                      {l.description}
                    </li>
                  ))}
                </ul>

                {visit.logs.length > 1 ? (
                  <p className="t-support mt-2 text-text-3">
                    {visit.logs.length} jobs on one receipt
                  </p>
                ) : null}

                {total != null ? <p className="t-support mt-1">{money(total)}</p> : null}

                {!hasPhoto ? (
                  <p className="t-support mt-2" style={{ color: 'var(--color-soon)' }}>
                    No receipt photo yet
                  </p>
                ) : null}

                {visit.logs.some((l) => l.is_warranty_claim) ? (
                  <p className="t-support mt-1 text-text-3">
                    Warranty claim, {first.claim_status ?? 'filed'}
                    {first.deductible_paid_cents != null
                      ? `, ${money(first.deductible_paid_cents)} deductible`
                      : ''}
                  </p>
                ) : null}
              </Card>
            )
          })}
        </CardGrid>
      )}
    </div>
  )
}
