import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Button, Card, SectionLabel } from '../components/ui'
import { longDate } from '../lib/format'
import { ChangePassword } from './ChangePassword'

export function Settings() {
  const { vehicle, appState, setAppState, session } = useStore()
  const navigate = useNavigate()

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-5">Settings</h1>

      <SectionLabel>Your car</SectionLabel>
      <Card>
        <p className="t-card-title">
          {vehicle?.year} {vehicle?.make} {vehicle?.model} {vehicle?.trim}
        </p>
        <p className="t-support mt-1">
          Bought {vehicle ? longDate(vehicle.purchase_date) : ''} at{' '}
          {vehicle?.purchase_odometer.toLocaleString('en-US')} miles.
        </p>
        {vehicle?.vin ? (
          <p className="t-support mt-1 text-text-3">VIN {vehicle.vin}</p>
        ) : (
          <p className="t-support mt-1" style={{ color: 'var(--color-soon)' }}>
            No VIN yet. Every warranty receipt needs it.
          </p>
        )}
      </Card>

      <div className="mt-7">
        <SectionLabel>Tutorial</SectionLabel>
        <Card>
          <p className="t-body text-text-2">
            {appState?.onboarding_completed_at
              ? `You finished it on ${longDate(appState.onboarding_completed_at.slice(0, 10))}.`
              : 'You have not finished it yet.'}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={async () => {
              await setAppState({ onboarding_completed_at: null, onboarding_last_card: 0 })
              navigate('/')
            }}
          >
            Run it again
          </Button>
        </Card>
      </div>

      <div className="mt-7">
        <SectionLabel>Password</SectionLabel>
        <Card>
          <ChangePassword />
        </Card>
      </div>

      <div className="mt-7">
        <SectionLabel>Account</SectionLabel>
        <Card>
          <p className="t-support">{session?.user.email}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}
