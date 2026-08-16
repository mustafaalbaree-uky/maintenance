import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Button, Card, EmptyState } from '../components/ui'
import { longDate, money } from '../lib/format'

// The completeness indicator is functional, not decorative: missing records is the
// single most common reason claims get denied.

function isComplete(log: {
  odometer: number
  performed_on: string
  description: string
  receipt_path: string | null
}) {
  return Boolean(log.odometer && log.performed_on && log.description && log.receipt_path)
}

export function History() {
  const { logs } = useStore()
  const complete = logs.filter(isComplete).length

  return (
    <div className="px-4 py-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="t-title">Receipts</h1>
        {logs.length ? (
          <span className="t-figure text-text-2">
            {complete} of {logs.length} claim ready
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

      {logs.length === 0 ? (
        <EmptyState>
          Your service records go here. Every receipt with a VIN, date, odometer, and description
          is one your warranty can't argue with.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="t-card-title">{log.description}</span>
                <span className="t-figure text-text-2">
                  {log.odometer.toLocaleString('en-US')} mi
                </span>
              </div>
              <p className="t-support mt-1">
                {longDate(log.performed_on)}
                {log.shop_name ? ` at ${log.shop_name}` : ''}
                {log.cost_cents != null ? `, ${money(log.cost_cents)}` : ''}
              </p>
              {!log.receipt_path ? (
                <p className="t-support mt-2" style={{ color: 'var(--color-soon)' }}>
                  No receipt photo yet
                </p>
              ) : null}
              {log.is_warranty_claim ? (
                <p className="t-support mt-1 text-text-3">
                  Warranty claim, {log.claim_status ?? 'filed'}
                  {log.deductible_paid_cents != null
                    ? `, ${money(log.deductible_paid_cents)} deductible`
                    : ''}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
