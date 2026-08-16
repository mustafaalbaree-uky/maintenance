import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, Input } from './ui'

// The delivery channel is a choice of one. Nothing sends yet: this stores the preference
// so the dispatcher has somewhere to read from when it is built.

type Channel = 'none' | 'email_digest' | 'email_alert' | 'push_bark'

const CHOICES: { value: Channel; label: string; blurb: string }[] = [
  { value: 'none', label: 'Nothing for now', blurb: 'The app still tracks everything. It just stays quiet.' },
  { value: 'email_digest', label: 'A weekly email', blurb: 'One message a week with whatever is coming up.' },
  { value: 'email_alert', label: 'Email when something needs doing', blurb: 'Quiet most weeks, louder when something is due.' },
  { value: 'push_bark', label: 'A push to your iPhone', blurb: 'Through Bark, which needs the key from the app.' },
]

export function NotificationSettings({ email }: { email?: string }) {
  const [channel, setChannel] = useState<Channel>('none')
  const [address, setAddress] = useState(email ?? '')
  const [barkKey, setBarkKey] = useState('')
  const [rowId, setRowId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('notification_preference').select('*').maybeSingle()
      if (!data) return
      setRowId(data.id)
      setChannel(data.channel as Channel)
      const config = (data.channel_config ?? {}) as { email?: string; bark_key?: string }
      if (config.email) setAddress(config.email)
      if (config.bark_key) setBarkKey(config.bark_key)
    })()
  }, [])

  const needsEmail = channel === 'email_digest' || channel === 'email_alert'
  const needsBark = channel === 'push_bark'

  async function save() {
    setError(null)
    setSaved(false)

    if (needsEmail && !address.trim()) {
      setError('Add the address to send to.')
      return
    }
    if (needsBark && !barkKey.trim()) {
      setError('Add your Bark key. Open Bark on your iPhone and copy the key it shows.')
      return
    }

    setBusy(true)
    const config = needsEmail
      ? { email: address.trim() }
      : needsBark
        ? { bark_key: barkKey.trim() }
        : {}

    const { error: saveError } = await supabase
      .from('notification_preference')
      .upsert({ ...(rowId ? { id: rowId } : {}), channel, channel_config: config })
    setBusy(false)

    if (saveError) setError(saveError.message)
    else setSaved(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {CHOICES.map((c) => (
          <label
            key={c.value}
            className="flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2 transition-colors duration-[120ms]"
            style={{
              borderColor: channel === c.value ? 'var(--color-action)' : 'var(--color-line)',
              background: channel === c.value ? 'var(--color-panel-hi)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="channel"
              className="mt-[5px]"
              checked={channel === c.value}
              onChange={() => {
                setChannel(c.value)
                setSaved(false)
              }}
            />
            <span>
              <span className="t-card-title block">{c.label}</span>
              <span className="t-support">{c.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      {needsEmail ? (
        <Input
          label="Send to"
          type="email"
          inputMode="email"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      ) : null}

      {needsBark ? (
        <Input
          label="Bark key"
          value={barkKey}
          onChange={(e) => setBarkKey(e.target.value)}
          hint="Bark shows this on its main screen. It is the last part of your personal URL."
        />
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {saved ? <p className="t-support">Saved. Nothing sends yet, so this is on the shelf until delivery is built.</p> : null}

      <Button type="button" onClick={() => void save()} disabled={busy}>
        Save choice
      </Button>
    </div>
  )
}
