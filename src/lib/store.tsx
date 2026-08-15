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
  ServiceLog,
  Task,
  Vehicle,
  Warranty,
  WatchItem,
} from './types'

interface Store {
  session: Session | null
  loading: boolean
  vehicle: Vehicle | null
  readings: OdometerReading[]
  items: MaintenanceItem[]
  logs: ServiceLog[]
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
  const [loading, setLoading] = useState(true)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [readings, setReadings] = useState<OdometerReading[]>([])
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [watchItems, setWatchItems] = useState<WatchItem[]>([])
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [appState, setAppStateRow] = useState<AppState | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!session) {
      setLoading(false)
      return
    }
    setLoading(true)

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
      const [r, i, l, t, w, wa] = await Promise.all([
        supabase.from('odometer_reading').select('*').order('reading_date'),
        supabase.from('maintenance_item').select('*').order('sort_order'),
        supabase.from('service_log').select('*').order('performed_on', { ascending: false }),
        supabase.from('task').select('*').order('sort_order'),
        supabase.from('watch_item').select('*').order('window_start_miles'),
        supabase.from('warranty').select('*'),
      ])
      setReadings((r.data as OdometerReading[]) ?? [])
      setItems((i.data as MaintenanceItem[]) ?? [])
      setLogs((l.data as ServiceLog[]) ?? [])
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

  const estimate = useMemo(
    () => estimateOdometer(readings.map((r) => ({ reading_date: r.reading_date, miles: r.miles })), today()),
    [readings],
  )

  const schedule = useMemo(
    () => buildSchedule(items, logs, estimate, today()),
    [items, logs, estimate],
  )

  const value: Store = {
    session,
    loading,
    vehicle,
    readings,
    items,
    logs,
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
