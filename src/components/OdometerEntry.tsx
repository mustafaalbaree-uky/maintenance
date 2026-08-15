import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, ErrorText, Input } from '../components/ui'
import { today } from '../lib/format'

// A reading lower than the highest existing one is rejected, with the edit path offered
// rather than a dead end.

export function OdometerEntry({
  onSaved,
  submitLabel = 'Add reading',
  defaultMiles,
}: {
  onSaved?: (miles: number) => void
  submitLabel?: string
  defaultMiles?: number
}) {
  const { vehicle, readings, estimate, refresh } = useStore()
  const highest = readings.reduce((m, r) => Math.max(m, r.miles), 0)

  const [miles, setMiles] = useState(
    String(defaultMiles ?? (estimate.latest ? estimate.odometer : (vehicle?.purchase_odometer ?? ''))),
  )
  const [date, setDate] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    setError(null)
    setShowEdit(false)

    const n = Number(miles)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter the number on the dash.')
      return
    }
    if (readings.length && n < highest) {
      setError("Odometer can't go backwards. Fix an earlier entry instead.")
      setShowEdit(true)
      return
    }

    setBusy(true)
    const { error: upsertError } = await supabase
      .from('odometer_reading')
      .upsert(
        { vehicle_id: vehicle.id, reading_date: date, miles: n, source: 'manual' },
        { onConflict: 'vehicle_id,reading_date' },
      )

    if (upsertError) {
      setError(upsertError.message)
      setBusy(false)
      return
    }

    await refresh()
    setBusy(false)
    onSaved?.(n)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Odometer"
        type="number"
        inputMode="numeric"
        required
        value={miles}
        onChange={(e) => setMiles(e.target.value)}
      />
      <Input
        label="Date"
        type="date"
        required
        value={date}
        max={today()}
        onChange={(e) => setDate(e.target.value)}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      {showEdit ? (
        <p className="t-support">
          Your highest reading is {highest.toLocaleString('en-US')} miles. Change the date on this
          entry, or correct the earlier one in History.
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
