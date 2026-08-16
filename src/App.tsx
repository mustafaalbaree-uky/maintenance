import { HashRouter, Navigate, Route, Routes, NavLink } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { Auth } from './screens/Auth'
import { VehicleSetup } from './screens/VehicleSetup'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { ComingUp } from './screens/ComingUp'
import { History } from './screens/History'
import { Tasks } from './screens/Tasks'
import { LogService } from './screens/LogService'
import { Settings } from './screens/Settings'
import { FirstRunPassword } from './screens/ChangePassword'

// HashRouter rather than history routing: it is the lower risk choice on GitHub Pages.

const TABS = [
  { to: '/', label: 'Home' },
  { to: '/coming-up', label: 'Coming up' },
  { to: '/tasks', label: 'First things' },
  { to: '/history', label: 'Receipts' },
]

function TabBar() {
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-line bg-ink lg:hidden">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) =>
            `t-figure py-3 text-center ${isActive ? 'text-action' : 'text-text-3'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Sidebar() {
  return (
    <nav className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-line px-4 py-6 lg:flex">
      <p className="t-wordmark mb-8">Maintenance</p>
      {[...TABS, { to: '/settings', label: 'Settings' }].map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) =>
            `t-body rounded-[10px] px-3 py-2 ${isActive ? 'bg-panel text-text' : 'text-text-2 hover:text-text'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Shell() {
  const { session, loading, vehicle, appState, refresh } = useStore()

  if (!session) return <Auth />
  // Accounts start with an admin issued temporary password.
  if (session.user.user_metadata?.must_change_password)
    return <FirstRunPassword onDone={() => void refresh()} />
  if (loading) return <div className="min-h-dvh bg-ink" />
  if (!vehicle) return <VehicleSetup />
  if (!appState?.onboarding_completed_at) return <Onboarding />

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-2xl flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/coming-up" element={<ComingUp />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/history" element={<History />} />
            <Route path="/log" element={<LogService />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <TabBar />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  )
}
