import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, Card, CardGrid, ErrorText, SectionLabel } from '../components/ui'
import { longDate, miles, money, today } from '../lib/format'
import { daysBetween } from '../lib/projection'
import { statusFor, type DueStatus } from '../lib/schedule'
import { capEndpoints, milesUntilCap, resolvedCapMiles } from '../lib/warranty'
import type { Warranty } from '../lib/types'

// Reads the current odometer as the last logged reading, not the adaptive projection
// Timeline and Home use. A warranty cap is a contractual fact, checked against a receipt,
// so it is measured against the last confirmed number rather than an extrapolated one.

const STATUS_COLOR: Record<DueStatus, string> = {
  overdue: 'var(--color-overdue)',
  due_soon: 'var(--color-soon)',
  upcoming: 'var(--color-clear)',
  ok: 'var(--color-text-2)',
}

function CapLine({
  label,
  capMiles,
  currentOdometer,
}: {
  label: string
  capMiles: number
  currentOdometer: number
}) {
  const remaining = milesUntilCap(capMiles, currentOdometer)
  const status = statusFor(remaining, null)
  const remainingText =
    remaining == null ? '' : remaining < 0 ? `${miles(Math.abs(remaining))} miles over` : `${miles(remaining)} miles left`
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="t-body text-text-2">
        {label}: {miles(capMiles)} miles
      </span>
      <span className="t-figure" style={{ color: STATUS_COLOR[status] }}>
        {remainingText}
      </span>
    </div>
  )
}

function DateCapLine({ label, endsAtDate, todayIso }: { label: string; endsAtDate: string; todayIso: string }) {
  const daysRemaining = daysBetween(todayIso, endsAtDate)
  const status = statusFor(null, daysRemaining)
  const remainingText = daysRemaining < 0 ? `${Math.abs(daysRemaining)} days over` : `${daysRemaining} days left`
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="t-body text-text-2">
        {label}: {longDate(endsAtDate)}
      </span>
      <span className="t-figure" style={{ color: STATUS_COLOR[status] }}>
        {remainingText}
      </span>
    </div>
  )
}

function BasisForm({ warranty, purchaseOdometer }: { warranty: Warranty; purchaseOdometer: number }) {
  const { refresh } = useStore()
  const [basis, setBasis] = useState<'total' | 'since_purchase'>('total')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('warranty')
      .update({
        cap_is_total_odometer: basis === 'total',
        starts_from_odometer: basis === 'since_purchase' ? purchaseOdometer : null,
        cap_basis_recorded_at: date,
      })
      .eq('id', warranty.id)
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    await refresh()
    setBusy(false)
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      <SectionLabel>Record what CarMax said</SectionLabel>
      <label className="flex items-start gap-3">
        <input
          type="radio"
          name={`basis-${warranty.id}`}
          checked={basis === 'total'}
          onChange={() => setBasis('total')}
          className="mt-1 h-4 w-4"
        />
        <span className="t-body">Total odometer. The cap is {miles(warranty.ends_at_miles ?? 0)} miles on the odometer.</span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="radio"
          name={`basis-${warranty.id}`}
          checked={basis === 'since_purchase'}
          onChange={() => setBasis('since_purchase')}
          className="mt-1 h-4 w-4"
        />
        <span className="t-body">
          Since purchase. The cap is {miles(warranty.ends_at_miles ?? 0)} miles driven from{' '}
          {miles(purchaseOdometer)}.
        </span>
      </label>
      <label className="block">
        <span className="t-section mb-[9px] block">Date CarMax answered</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[44px] w-full rounded-[10px] border border-line bg-panel-hi px-3 text-text"
          style={{ fontVariantNumeric: 'tabular-nums lining' }}
        />
      </label>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button type="button" disabled={busy} onClick={() => void save()}>
        Record basis
      </Button>
    </div>
  )
}

function WarrantyCard({
  warranty,
  currentOdometer,
  purchaseOdometer,
  todayIso,
}: {
  warranty: Warranty
  currentOdometer: number
  purchaseOdometer: number
  todayIso: string
}) {
  const endpoints = capEndpoints(warranty, purchaseOdometer)
  const resolvedMiles = resolvedCapMiles(warranty, purchaseOdometer)
  const basisUnrecorded = warranty.ends_at_miles != null && warranty.cap_is_total_odometer == null
  const paragraphs = (warranty.notes ?? '').split('\n\n').filter(Boolean)

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-card-title">{warranty.name}</span>
        {warranty.coverage_type ? <span className="t-support text-text-3">{warranty.coverage_type}</span> : null}
      </div>

      {warranty.deductible_cents != null ? (
        <p className="t-support mt-1 text-text-3">
          {money(warranty.deductible_cents)} deductible
          {warranty.reduced_deductible_cents != null
            ? `, ${money(warranty.reduced_deductible_cents)} at ${warranty.reduced_deductible_condition ?? 'a qualifying shop'}`
            : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {warranty.ends_at_miles == null ? null : basisUnrecorded && endpoints ? (
          <>
            <CapLine label="If total odometer" capMiles={endpoints.totalOdometerMiles} currentOdometer={currentOdometer} />
            <CapLine label="If since purchase" capMiles={endpoints.sincePurchaseMiles} currentOdometer={currentOdometer} />
            <p className="t-support text-text-3">Basis not recorded yet. Both readings hold until it is.</p>
          </>
        ) : resolvedMiles != null ? (
          <CapLine label="Mileage cap" capMiles={resolvedMiles} currentOdometer={currentOdometer} />
        ) : null}

        {warranty.ends_at_date ? (
          <DateCapLine label="Date cap" endsAtDate={warranty.ends_at_date} todayIso={todayIso} />
        ) : warranty.coverage_type === 'limited' ? (
          <p className="t-support text-text-3">
            Date cap not known. It runs 5 years from the original in service date, which is not recorded yet.
          </p>
        ) : null}

        {!basisUnrecorded && warranty.cap_basis_recorded_at ? (
          <p className="t-support text-text-3">
            Basis recorded {longDate(warranty.cap_basis_recorded_at)}:{' '}
            {warranty.cap_is_total_odometer ? 'total odometer' : 'since purchase'}.
          </p>
        ) : null}
      </div>

      {paragraphs.length ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="t-support text-text-3">
              {p}
            </p>
          ))}
        </div>
      ) : null}

      {basisUnrecorded ? <BasisForm warranty={warranty} purchaseOdometer={purchaseOdometer} /> : null}
    </Card>
  )
}

export function Warranty() {
  const { vehicle, warranties, estimate } = useStore()
  if (!vehicle) return null

  const currentOdometer = estimate.latest?.miles ?? vehicle.purchase_odometer
  const todayIso = today()

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-2">Warranty</h1>
      <p className="t-support mb-5 text-text-3">
        {estimate.latest
          ? `Last confirmed ${miles(currentOdometer)} miles on ${longDate(estimate.latest.reading_date)}.`
          : `No reading logged yet. Using the purchase odometer, ${miles(currentOdometer)} miles.`}
      </p>

      {warranties.length ? (
        <CardGrid>
          {warranties.map((w) => (
            <WarrantyCard
              key={w.id}
              warranty={w}
              currentOdometer={currentOdometer}
              purchaseOdometer={vehicle.purchase_odometer}
              todayIso={todayIso}
            />
          ))}
        </CardGrid>
      ) : (
        <Card>
          <p className="t-body text-text-2">No warranty is recorded on this vehicle.</p>
        </Card>
      )}
    </div>
  )
}
