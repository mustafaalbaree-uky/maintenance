import { useStore } from '../lib/store'
import { Button } from '../components/ui'
import { signOut } from '../lib/supabase'

// This app's Supabase project is shared with another app, so its accounts are valid
// logins here. They are not members, and the database refuses them regardless of what
// this screen does. This just explains it rather than showing an empty app.

export function NotAMember() {
  const { session } = useStore()

  return (
    <div className="mx-auto flex min-h-safe max-w-sm flex-col justify-center px-4">
      <p className="t-wordmark mb-8">Maintenance</p>
      <h1 className="t-title mb-2">This account isn't set up for this app</h1>
      <p className="t-body mb-2 text-text-2">
        You're signed in as {session?.user.email}, which works for a different app that
        shares this login.
      </p>
      <p className="t-support mb-6">Sign out and back in with the account made for this car.</p>
      <Button onClick={() => void signOut()} className="w-full">
        Sign out
      </Button>
    </div>
  )
}
