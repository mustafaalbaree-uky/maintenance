import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, RECEIPTS_BUCKET, receiptPath } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, Card, ErrorText, Input, SectionLabel } from '../components/ui'
import { longDate, today } from '../lib/format'
import { queuePendingService } from '../lib/offline'

// Optimized for one hand, bad signal, standing next to the car.
//
// One visit usually covers several jobs on one piece of paper, so the unit being logged
// is the visit: tick everything that was done, photograph the receipt once.

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
  const { vehicle, estimate, logs, receipts, schedule, session, refresh } = useStore()

  const [odometer, setOdometer] = useState(String(estimate.odometer || vehicle?.purchase_odometer || ''))
  const [performedOn, setPerformedOn] = useState(today())
  const [picked, setPicked] = useState<string[]>(itemId ? [itemId] : [])
  const [extra, setExtra] = useState(prefillDescription && !itemId ? prefillDescription : '')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [existingReceiptId, setExistingReceiptId] = useState<string>('')
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

  // Anything already uploaded can take another line item without a second photo.
  const recentReceipts = useMemo(
    () => receipts.filter((r) => r.storage_path).slice(0, 8),
    [receipts],
  )

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const descriptions = () => {
    const names = picked
      .map((id) => schedule.find((e) => e.item.id === id)?.item.name)
      .filter(Boolean) as string[]
    const free = extra.trim()
    return free ? [...names, free] : names
  }

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
    const jobs = descriptions()
    if (jobs.length === 0) {
      setError('Tick what was done, or type it in.')
      return
    }
    const reusing = Boolean(existingReceiptId)
    if (!receipt && !reusing && !force) {
      setWarning(
        'No receipt photo. You can add one later, but a claim without a receipt is the one that gets denied.',
      )
      return
    }

    setBusy(true)

    // The receipt comes first, so every job from this visit can point at it.
    let receiptId = existingReceiptId || null
    if (!reusing) {
      const { data: created, error: receiptError } = await supabase
        .from('receipt')
        .insert({
          vehicle_id: vehicle.id,
          performed_on: performedOn,
          odometer: odo,
          shop_name: shopName.trim() || null,
          total_cost_cents: cost ? Math.round(Number(cost) * 100) : null,
        })
        .select()
        .single()

      if (receiptError || !created) {
        const queued = await queuePendingService(
          { vehicle_id: vehicle.id, performed_on: performedOn, odometer: odo, jobs },
          receipt,
        )
        setBusy(false)
        if (queued) return onDone?.()
        setError(receiptError?.message ?? 'That could not be saved.')
        return
      }
      receiptId = created.id

      if (receipt) {
        const path = receiptPath(session.user.id, vehicle.id, created.id)
        const { error: uploadError } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .upload(path, receipt, { upsert: true, contentType: receipt.type || 'image/jpeg' })
        if (!uploadError) {
          await supabase.from('receipt').update({ storage_path: path }).eq('id', created.id)
        }
      }
    }

    const rows = jobs.map((description, i) => ({
      vehicle_id: vehicle.id,
      maintenance_item_id: picked[i] ?? null,
      receipt_id: receiptId,
      performed_on: performedOn,
      odometer: odo,
      description,
      shop_name: shopName.trim() || null,
      // The money sits on the receipt, so summing service rows cannot double count it.
      cost_cents: null,
      is_warranty_claim: isClaim,
      claim_status: isClaim ? claimStatus : null,
      deductible_paid_cents: isClaim && deductible ? Math.round(Number(deductible) * 100) : null,
    }))

    const { error: insertError } = await supabase.from('service_log').insert(rows)
    if (insertError) {
      setBusy(false)
      setError(insertError.message)
      return
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

      <div>
        <span className="t-section mb-[9px] block">What was done</span>
        <p className="t-support mb-2 text-text-3">
          Tick everything on this visit. They share one receipt.
        </p>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-[10px] border border-line p-2">
          {schedule.map((e) => (
            <label
              key={e.item.id}
              className="flex cursor-pointer items-center gap-3 rounded-[8px] px-2 py-[6px] transition-colors duration-[120ms] hover:bg-panel-hi"
            >
              <input
                type="checkbox"
                checked={picked.includes(e.item.id)}
                onChange={() => toggle(e.item.id)}
                className="h-4 w-4"
              />
              <span className="t-body">{e.item.name}</span>
            </label>
          ))}
        </div>
      </div>

      <Input
        label="Anything else"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="New wiper blades"
      />

      {recentReceipts.length ? (
        <label className="block">
          <span className="t-section mb-[9px] block">Receipt</span>
          <select
            value={existingReceiptId}
            onChange={(e) => setExistingReceiptId(e.target.value)}
            className="min-h-[44px] w-full rounded-[10px] border border-line bg-panel-hi px-3 text-text"
          >
            <option value="">Photograph a new one</option>
            {recentReceipts.map((r) => (
              <option key={r.id} value={r.id}>
                {longDate(r.performed_on)}
                {r.shop_name ? `, ${r.shop_name}` : ''}
              </option>
            ))}
          </select>
          <span className="t-support mt-1 block text-text-3">
            Adding to one you already photographed? Pick it here and skip the camera.
          </span>
        </label>
      ) : null}

      {!existingReceiptId ? (
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
      ) : null}

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
        label="Total on the receipt"
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
          {demo ? 'This is the form' : descriptions().length > 1 ? 'Log this visit' : 'Log a service'}
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
