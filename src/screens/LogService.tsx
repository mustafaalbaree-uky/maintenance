import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, RECEIPTS_BUCKET, receiptPath } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, Card, ErrorText, Input, SectionLabel } from '../components/ui'
import { today } from '../lib/format'
import { queuePendingService } from '../lib/offline'

// Optimized for one hand, bad signal, standing next to the car.

export function LogServiceForm({
  demo = false,
  itemId,
  prefillDescription,
  onDone,
}: {
  demo?: boolean
  itemId?: string | null
  prefillDescription?: string
  onDone?: () => void
}) {
  const { vehicle, estimate, logs, session, refresh } = useStore()

  const [odometer, setOdometer] = useState(String(estimate.odometer || vehicle?.purchase_odometer || ''))
  const [performedOn, setPerformedOn] = useState(today())
  const [description, setDescription] = useState(prefillDescription ?? '')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [shopName, setShopName] = useState('')
  const [cost, setCost] = useState('')
  const [isClaim, setIsClaim] = useState(false)
  const [claimStatus, setClaimStatus] = useState('filed')
  const [deductible, setDeductible] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const shops = useMemo(
    () => Array.from(new Set(logs.map((l) => l.shop_name).filter(Boolean))) as string[],
    [logs],
  )

  async function save(force = false) {
    if (demo) {
      onDone?.()
      return
    }
    if (!vehicle || !session) return
    setError(null)

    const odo = Number(odometer)
    if (!Number.isFinite(odo) || odo <= 0) {
      setError('Enter the number on the dash.')
      return
    }
    if (!description.trim()) {
      setError('Say what was done, even roughly.')
      return
    }
    if (!receipt && !force) {
      setWarning(
        "No receipt photo. You can add one later, but a claim without a receipt is the one that gets denied.",
      )
      return
    }

    setBusy(true)
    const row = {
      vehicle_id: vehicle.id,
      maintenance_item_id: itemId ?? null,
      performed_on: performedOn,
      odometer: odo,
      description: description.trim(),
      shop_name: shopName.trim() || null,
      cost_cents: cost ? Math.round(Number(cost) * 100) : null,
      is_warranty_claim: isClaim,
      claim_status: isClaim ? claimStatus : null,
      deductible_paid_cents: isClaim && deductible ? Math.round(Number(deductible) * 100) : null,
    }

    const { data, error: insertError } = await supabase
      .from('service_log')
      .insert(row)
      .select()
      .single()

    if (insertError || !data) {
      // Only the network case is queued. This is not general offline support.
      const queued = await queuePendingService(row, receipt)
      setBusy(false)
      if (queued) {
        onDone?.()
        return
      }
      setError(insertError?.message ?? 'The service could not be saved.')
      return
    }

    if (receipt) {
      const path = receiptPath(session.user.id, vehicle.id, data.id)
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, receipt, { upsert: true, contentType: receipt.type || 'image/jpeg' })
      if (!uploadError) {
        await supabase.from('service_log').update({ receipt_path: path }).eq('id', data.id)
      }
    }

    // The dash was read at that moment, so this is the most trustworthy kind of reading.
    await supabase
      .from('odometer_reading')
      .upsert(
        { vehicle_id: vehicle.id, reading_date: performedOn, miles: odo, source: 'derived_from_service' },
        { onConflict: 'vehicle_id,reading_date' },
      )

    await refresh()
    setBusy(false)
    onDone?.()
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save(false)
      }}
    >
      <Input
        label="Odometer"
        type="number"
        inputMode="numeric"
        required={!demo}
        value={odometer}
        onChange={(e) => setOdometer(e.target.value)}
      />
      <Input
        label="Date"
        type="date"
        required={!demo}
        value={performedOn}
        onChange={(e) => setPerformedOn(e.target.value)}
      />
      <Input
        label="What was done"
        required={!demo}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Oil and filter change"
      />

      <label className="block">
        <span className="t-section mb-[9px] block">Receipt photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="t-support w-full rounded-[10px] border border-line bg-panel-hi px-3 py-[11px] file:mr-3 file:rounded file:border-0 file:bg-panel file:px-2 file:py-1 file:text-text-2"
        />
        <span className="t-support mt-1 block text-text-3">
          It needs the VIN, the date, the odometer, and what was done.
        </span>
      </label>

      <Input
        label="Shop"
        list="shop-suggestions"
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
      />
      <datalist id="shop-suggestions">
        {shops.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Input
        label="Cost"
        type="number"
        inputMode="decimal"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
      />

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isClaim}
          onChange={(e) => setIsClaim(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="t-body">This was a warranty claim</span>
      </label>

      {isClaim ? (
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="t-section mb-[9px] block">Claim status</span>
            <select
              value={claimStatus}
              onChange={(e) => setClaimStatus(e.target.value)}
              className="min-h-[44px] w-full rounded-[10px] border border-line bg-panel-hi px-3 text-text"
            >
              <option value="filed">Filed</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </select>
          </label>
          <Input
            label="Deductible paid"
            type="number"
            inputMode="decimal"
            value={deductible}
            onChange={(e) => setDeductible(e.target.value)}
          />
        </div>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {warning ? (
        <Card>
          <p className="t-body text-text-2">{warning}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={() => void save(true)} disabled={busy}>
              Save without it
            </Button>
            <Button type="button" variant="secondary" onClick={() => setWarning(null)}>
              Add a receipt photo
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="submit" disabled={busy} className="w-full">
          {demo ? 'This is the form' : 'Log a service'}
        </Button>
      )}
    </form>
  )
}

export function LogService() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  return (
    <div className="px-4 py-6">
      <SectionLabel>Log a service</SectionLabel>
      <LogServiceForm
        itemId={params.get('item')}
        prefillDescription={params.get('name') ?? undefined}
        onDone={() => navigate('/history')}
      />
    </div>
  )
}
