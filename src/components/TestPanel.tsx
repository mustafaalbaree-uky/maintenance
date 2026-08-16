import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, Card, ErrorText } from './ui'
import { addDays, daysBetween } from '../lib/projection'
import { longDate, realToday, simulatedToday, setSimulatedOffset, simulatedOffset } from '../lib/format'

// Only reachable on an account flagged as a tester. It moves real rows around, which is
// the point: the walkthrough proves the schedule reacts, rather than describing it.

interface Step {
  label: string
  detail: string
}

export function TestPanel() {
  const { vehicle, estimate, schedule, readings, refresh } = useStore()
  const [steps, setSteps] = useState<Step[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(simulatedOffset())

  function shiftDays(days: number) {
    const next = simulatedOffset() + days
    setSimulatedOffset(next)
    setOffset(next)
    void refresh()
  }

  async function addMiles(delta: number) {
    if (!vehicle) return
    setBusy(true)
    setError(null)
    const base = estimate.latest?.miles ?? vehicle.purchase_odometer
    const { error: saveError } = await supabase.from('odometer_reading').upsert(
      {
        vehicle_id: vehicle.id,
        reading_date: simulatedToday(),
        miles: Math.max(0, base + delta),
        source: 'manual',
      },
      { onConflict: 'vehicle_id,reading_date' },
    )
    if (saveError) setError(saveError.message)
    await refresh()
    setBusy(false)
  }

  /**
   * Drives a full year of ownership in a few seconds: readings accumulate, the oil change
   * comes due, a service is logged against it, and the schedule rebases on that service.
   */
  async function runWalkthrough() {
    if (!vehicle) return
    setBusy(true)
    setError(null)
    const log: Step[] = []
    const push = (label: string, detail: string) => {
      log.push({ label, detail })
      setSteps([...log])
    }

    try {
      // Clean slate so a second run does not fight the first.
      await supabase.from('service_log').delete().eq('vehicle_id', vehicle.id)
      await supabase.from('odometer_reading').delete().eq('vehicle_id', vehicle.id)
      setSimulatedOffset(0)
      setOffset(0)
      await refresh()
      push('Cleared', 'Removed this account\'s readings and service records.')

      // Six monthly readings at roughly 1,100 miles a month.
      const start = addDays(realToday(), -180)
      const rows = Array.from({ length: 6 }, (_, i) => ({
        vehicle_id: vehicle.id,
        reading_date: addDays(start, i * 30),
        miles: vehicle.purchase_odometer + Math.round(i * 30 * 36.5),
        source: 'manual',
      }))
      await supabase.from('odometer_reading').upsert(rows, { onConflict: 'vehicle_id,reading_date' })
      await refresh()
      push(
        'Six readings over six months',
        `From ${vehicle.purchase_odometer.toLocaleString('en-US')} to ${rows[rows.length - 1].miles.toLocaleString('en-US')} miles. That is enough for the estimate to stop guessing and start fitting your driving.`,
      )

      // Far enough forward that the 5,000 mile oil interval is behind us.
      setSimulatedOffset(150)
      setOffset(150)
      await refresh()
      push(
        'Five months later',
        `Today is now ${longDate(simulatedToday())} as far as the app is concerned. No new readings, so the odometer you see is projected, not measured.`,
      )

      const oil = schedule.find((e) => e.item.name.startsWith('Oil'))
      push(
        'The oil change came due',
        oil
          ? `Coming up now shows it as ${oil.status.replace('_', ' ')}.`
          : 'Check Coming up: the oil change should have moved to the top.',
      )

      // Log the service and watch the schedule rebase on it.
      const oilItem = schedule.find((e) => e.item.name.startsWith('Oil'))?.item
      const odo = estimate.odometer
      const { data: created } = await supabase
        .from('service_log')
        .insert({
          vehicle_id: vehicle.id,
          maintenance_item_id: oilItem?.id ?? null,
          performed_on: simulatedToday(),
          odometer: odo,
          description: 'Oil and filter change',
          shop_name: 'Walkthrough Motors',
          cost_cents: 8900,
        })
        .select()
        .single()
      if (created) {
        await supabase.from('odometer_reading').upsert(
          {
            vehicle_id: vehicle.id,
            reading_date: simulatedToday(),
            miles: odo,
            source: 'derived_from_service',
          },
          { onConflict: 'vehicle_id,reading_date' },
        )
      }
      await refresh()
      push(
        'Logged the oil change',
        `Recorded at ${odo.toLocaleString('en-US')} miles. The next one is now measured from there rather than from your purchase, and the reading it carries counts as a confirmed one.`,
      )

      push(
        'Have a look',
        'Home, Coming up, and Receipts all changed. Use "Put it back" below when you are done.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The walkthrough stopped early.')
    }
    setBusy(false)
  }

  async function reset() {
    if (!vehicle) return
    setBusy(true)
    await supabase.from('service_log').delete().eq('vehicle_id', vehicle.id)
    await supabase.from('odometer_reading').delete().eq('vehicle_id', vehicle.id)
    await supabase.from('odometer_reading').insert({
      vehicle_id: vehicle.id,
      reading_date: realToday(),
      miles: vehicle.purchase_odometer,
      source: 'manual',
    })
    setSimulatedOffset(0)
    setOffset(0)
    setSteps([])
    await refresh()
    setBusy(false)
  }

  return (
    <Card>
      <p className="t-support mb-3">
        This account only. Everything here writes real rows, so the app reacts exactly as it
        would for him.
      </p>

      <p className="t-section mb-2">Odometer</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[-500, -100, 100, 500, 2000].map((d) => (
          <Button key={d} variant="secondary" disabled={busy} onClick={() => void addMiles(d)}>
            {d > 0 ? `+${d}` : d}
          </Button>
        ))}
      </div>

      <p className="t-section mb-2">
        Today {offset ? `is shifted ${offset} days, to ${longDate(simulatedToday())}` : 'is the real date'}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[-30, 30, 90, 180].map((d) => (
          <Button key={d} variant="secondary" disabled={busy} onClick={() => shiftDays(d)}>
            {d > 0 ? `+${d} days` : `${d} days`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void runWalkthrough()}>
          Run the walkthrough
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void reset()}>
          Put it back
        </Button>
      </div>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {steps.length ? (
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={i} className="border-l-2 border-line pl-3">
              <p className="t-card-title">{s.label}</p>
              <p className="t-support">{s.detail}</p>
            </li>
          ))}
        </ol>
      ) : null}

      <p className="t-support mt-4 text-text-3">
        {readings.length} reading{readings.length === 1 ? '' : 's'} on file, estimate{' '}
        {estimate.odometer.toLocaleString('en-US')} miles, {daysBetween(realToday(), simulatedToday())} days
        of shift.
      </p>
    </Card>
  )
}
