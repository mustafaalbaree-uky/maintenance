import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { estimateOdometer, type CurrentEstimate } from './projection'
import { buildSchedule, type ScheduleEntry } from './schedule'
import { today } from './format'
import type {
  AppState,
  MaintenanceItem,
  OdometerReading,
  Receipt,
  ServiceLog,
  Task,
  Vehicle,
  Warranty,
  WatchItem,
} from './types'

interface Store {
  session: Session | null
  /** False until the stored session has been read, so nothing renders on a guess. */
  authReady: boolean
  /** Null while unknown. False means a valid login that this app does not serve. */
  isMember: boolean | null
  loading: boolean
  vehicle: Vehicle | null
  readings: OdometerReading[]
  items: MaintenanceItem[]
  logs: ServiceLog[]
  receipts: Receipt[]
  tasks: Task[]
  watchItems: WatchItem[]
  warranties: Warranty[]
  appState: AppState | null
  estimate: CurrentEstimate
  schedule: ScheduleEntry[]
  refresh: () => Promise<void>
  setAppState: (patch: Partial<AppState>) => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore used outside StoreProvider')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [readings, setReadings] = useState<OdometerReading[]>([])
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [watchItems, setWatchItems] = useState<WatchItem[]>([])
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [appState, setAppStateRow] = useState<AppState | null>(null)
  const [isMember, setIsMember] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))

    // A Home Screen app is suspended rather than closed, so the refresh timer may not
    // have run while it was away. Ask for the session again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void supabase.auth.getSession().then(({ data }) => setSession(data.session))
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!session) {
      setLoading(false)
      setIsMember(null)
      return
    }
    setLoading(true)

    // The database enforces this too. Reading it here is only so the app can say why.
    const { data: membership } = await supabase
      .from('app_member')
      .select('user_id')
      .maybeSingle()
    setIsMember(Boolean(membership))

    const { data: vehicles } = await supabase
      .from('vehicle')
      .select('*')
      .order('created_at')
      .limit(1)
    const v = (vehicles?.[0] as Vehicle) ?? null
    setVehicle(v)

    // app_state is per user and may not exist until onboarding writes it.
    const { data: st } = await supabase.from('app_state').select('*').maybeSingle()
    setAppStateRow((st as AppState) ?? null)

    if (v) {
      const [r, i, l, rc, t, w, wa] = await Promise.all([
        supabase.from('odometer_reading').select('*').eq('vehicle_id', v.id).order('reading_date'),
        supabase.from('maintenance_item').select('*').eq('vehicle_id', v.id).order('sort_order'),
        supabase
          .from('service_log')
          .select('*')
          .eq('vehicle_id', v.id)
          .order('performed_on', { ascending: false }),
        supabase
          .from('receipt')
          .select('*')
          .eq('vehicle_id', v.id)
          .order('performed_on', { ascending: false }),
        supabase.from('task').select('*').eq('vehicle_id', v.id).order('sort_order'),
        supabase.from('watch_item').select('*').eq('vehicle_id', v.id).order('window_start_miles'),
        supabase.from('warranty').select('*').eq('vehicle_id', v.id),
      ])
      setReadings((r.data as OdometerReading[]) ?? [])
      setItems((i.data as MaintenanceItem[]) ?? [])
      setLogs((l.data as ServiceLog[]) ?? [])
      setReceipts((rc.data as Receipt[]) ?? [])
      setTasks((t.data as Task[]) ?? [])
      setWatchItems((w.data as WatchItem[]) ?? [])
      setWarranties((wa.data as Warranty[]) ?? [])
    }
    setLoading(false)
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setAppState = useCallback(
    async (patch: Partial<AppState>) => {
      if (!session) return
      const next = { user_id: session.user.id, ...appState, ...patch }
      setAppStateRow(next as AppState)
      await supabase.from('app_state').upsert(next, { onConflict: 'user_id' })
    },
    [session, appState],
  )

  /**
   * With no readings on file the car is not at zero miles: it is at whatever the
   * odometer read on the day it was bought, which is on the vehicle row. Falling back to
   * that keeps the gauge honest until the first real reading arrives.
   */
  const effectiveReadings = useMemo(() => {
    if (readings.length) {
      return readings.map((r) => ({ reading_date: r.reading_date, miles: r.miles }))
    }
    if (vehicle) {
      return [{ reading_date: vehicle.purchase_date, miles: vehicle.purchase_odometer }]
    }
    return []
  }, [readings, vehicle])

  const estimate = useMemo(() => estimateOdometer(effectiveReadings, today()), [effectiveReadings])

  const schedule = useMemo(
    () => buildSchedule(items, logs, estimate, today()),
    [items, logs, estimate],
  )

  const value: Store = {
    session,
    authReady,
    isMember,
    loading,
    vehicle,
    readings,
    items,
    logs,
    receipts,
    tasks,
    watchItems,
    warranties,
    appState,
    estimate,
    schedule,
    refresh,
    setAppState,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
