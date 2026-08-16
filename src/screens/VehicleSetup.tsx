import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, ErrorText, Input } from '../components/ui'
import { today } from '../lib/format'

// Runs once, between signup and onboarding. Prefilled with the car this was built for.

export function VehicleSetup() {
  const { refresh } = useStore()
  const [vin, setVin] = useState('')
  const [purchaseOdometer, setPurchaseOdometer] = useState('42000')
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const odo = Number(purchaseOdometer)
    if (!Number.isFinite(odo) || odo <= 0) {
      setError('Enter the mileage the car had when you bought it.')
      setBusy(false)
      return
    }

    // A second car here is always a mistake: this app is built for one. Without this,
    // a double tap or a back navigation produced two, and both schedules rendered at once.
    const { data: existing } = await supabase.from('vehicle').select('id').limit(1)
    if (existing?.length) {
      await refresh()
      return
    }

    const { data, error: insertError } = await supabase
      .from('vehicle')
      .insert({
        year: 2022,
        make: 'Genesis',
        model: 'G70',
        trim: '3.3T AWD',
        engine_note: '3.3L twin turbocharged V6',
        drivetrain: 'AWD',
        vin: vin.trim() || null,
        purchase_date: purchaseDate,
        purchase_odometer: odo,
        plan_end_odometer: odo + 60000,
      })
      .select()
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'The car could not be saved.')
      setBusy(false)
      return
    }

    // Copies the templates in and creates the task lists and warranty rows.
    const { error: rpcError } = await supabase.rpc('provision_vehicle', {
      p_vehicle_id: data.id,
      p_template_set: 'g70_33t',
    })
    if (rpcError) {
      setError(rpcError.message)
      setBusy(false)
      return
    }

    await refresh()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <p className="t-wordmark mb-8">Maintenance</p>
      <h1 className="t-title mb-1">Your car</h1>
      <p className="t-support mb-6">
        2022 Genesis G70 3.3T AWD. Two things and you're in.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Mileage at purchase"
          type="number"
          inputMode="numeric"
          required
          value={purchaseOdometer}
          onChange={(e) => setPurchaseOdometer(e.target.value)}
        />
        <Input
          label="Purchase date"
          type="date"
          required
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
        <Input
          label="VIN"
          hint="Optional now. Every warranty receipt needs it, so add it when you have it."
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          maxLength={17}
        />

        {error ? <ErrorText>{error}</ErrorText> : null}

        <Button type="submit" disabled={busy} className="mt-2 w-full">
          Save the car
        </Button>
      </form>
    </div>
  )
}
