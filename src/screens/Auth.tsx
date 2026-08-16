import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, Input } from '../components/ui'

// Email and password, with reset. Not magic links: on GitHub Pages those open in the
// mail client's in-app browser rather than the installed app.
//
// There is no signup here. This app has exactly one user, whose account is created with
// the admin API, and the database it uses is shared with another app whose public key
// would otherwise let anyone register.

type Mode = 'signin' | 'reset'

export function Auth() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href,
      })
      setError(error?.message ?? null)
      if (!error) setNotice('Check your email for the reset link.')
      setBusy(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setError(error?.message ?? null)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-safe max-w-sm flex-col justify-center px-4">
      <p className="t-wordmark mb-8">Maintenance</p>
      <h1 className="t-title mb-1">{mode === 'signin' ? 'Sign in' : 'Reset your password'}</h1>
      <p className="t-support mb-6">
        {mode === 'signin' ? 'Welcome back.' : "We'll email you a link."}
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== 'reset' ? (
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : null}

        {error ? <ErrorText>{error}</ErrorText> : null}
        {notice ? <p className="t-support">{notice}</p> : null}

        <Button type="submit" disabled={busy} className="w-full">
          {mode === 'signin' ? 'Sign in' : 'Send the link'}
        </Button>
      </form>

      <div className="mt-6">
        <button
          className="t-support hover:text-text"
          onClick={() => setMode(mode === 'reset' ? 'signin' : 'reset')}
        >
          {mode === 'reset' ? 'Back to signing in' : 'Forgot your password?'}
        </button>
      </div>
    </div>
  )
}
