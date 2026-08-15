import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, Input } from '../components/ui'

// Accounts are created with a temporary password by an admin, so the first sign in lands
// here. Also reachable from Settings at any time.

export function ChangePassword({
  first = false,
  onDone,
}: {
  first?: boolean
  onDone?: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Those don't match. Type it again.")
      return
    }

    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setBusy(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setPassword('')
    setConfirm('')
    setNotice('Password changed.')
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {first ? (
        <>
          <h1 className="t-title">Pick your password</h1>
          <p className="t-support">
            The one you signed in with was temporary. Choose your own and you're in.
          </p>
        </>
      ) : null}

      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Type it again"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      {notice ? <p className="t-support">{notice}</p> : null}

      <Button type="submit" disabled={busy} className="w-full">
        Save password
      </Button>
    </form>
  )
}

/** Full screen version, shown before the app is reachable on a first sign in. */
export function FirstRunPassword({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <p className="t-wordmark mb-8">Maintenance</p>
      <ChangePassword first onDone={onDone} />
    </div>
  )
}
