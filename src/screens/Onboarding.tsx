import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ONBOARDING_CARDS } from '../content/onboarding'
import { useStore } from '../lib/store'
import { Button } from '../components/ui'
import { OdometerEntry } from '../components/OdometerEntry'
import { LogServiceForm } from './LogService'

// Twelve cards, shown once, before the app is reachable. The tutorial is not
// decorative: by the end he has entered his odometer and seen his first-week list.

/** Routes that exist today. */
const BUILT_ROUTES = new Set(['/coming-up', '/tasks', '/history', '/timeline', '/symptoms', '/budget'])

export function Onboarding() {
  const { appState, setAppState } = useStore()
  const navigate = useNavigate()
  const [index, setIndex] = useState(appState?.onboarding_last_card ?? 0)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const card = ONBOARDING_CARDS[index]
  const isLast = index === ONBOARDING_CARDS.length - 1

  async function goTo(next: number) {
    const clamped = Math.min(Math.max(next, 0), ONBOARDING_CARDS.length - 1)
    setIndex(clamped)
    await setAppState({ onboarding_last_card: clamped })
  }

  async function finish(to = '/') {
    await setAppState({
      onboarding_last_card: ONBOARDING_CARDS.length - 1,
      onboarding_completed_at: new Date().toISOString(),
    })
    navigate(to)
  }

  async function advance() {
    if (isLast) await finish()
    else await goTo(index + 1)
  }

  // The routing cards open the real screen. Finishing there is the point, so the
  // tutorial is marked complete rather than left half done behind them.
  async function handleAction() {
    switch (card.action.kind) {
      case 'route':
        // A route not yet built advances instead of bouncing him off a dead link.
        if (BUILT_ROUTES.has(card.action.to)) await finish(card.action.to)
        else await advance()
        break
      case 'finish':
        await finish('/')
        break
      default:
        await advance()
    }
  }

  return (
    <div
      className="mx-auto flex min-h-safe max-w-md flex-col px-4 py-6"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart == null) return
        const dx = e.changedTouches[0].clientX - touchStart
        if (dx < -40) void goTo(index + 1)
        if (dx > 40) void goTo(index - 1)
        setTouchStart(null)
      }}
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex gap-[3px]" aria-hidden="true">
          {ONBOARDING_CARDS.map((_, i) => (
            <span
              key={i}
              className="h-[2px] w-4 rounded-full"
              style={{
                background: i <= index ? 'var(--color-action)' : 'var(--color-line)',
              }}
            />
          ))}
        </div>
        <button className="t-support hover:text-text" onClick={() => void finish()}>
          Skip
        </button>
      </div>

      <p className="t-section mb-3">
        {index + 1} of {ONBOARDING_CARDS.length}
      </p>

      <h1 className="t-title mb-4">{card.heading}</h1>

      <div className="flex flex-col gap-3">
        {card.body.map((p, i) => (
          <p key={i} className="t-body text-text-2">
            {p}
          </p>
        ))}
      </div>

      {card.action.kind === 'odometer' ? (
        <div className="mt-6">
          <OdometerEntry submitLabel={card.button} onSaved={() => void advance()} />
        </div>
      ) : card.action.kind === 'log_demo' ? (
        <div className="mt-6 flex flex-col gap-4">
          {/* A real form, in demo mode: nothing is written and nothing is required. */}
          <LogServiceForm demo onDone={() => void advance()} />
          <Button variant="secondary" onClick={() => void advance()} className="w-full">
            {card.button}
          </Button>
        </div>
      ) : (
        <Button onClick={() => void handleAction()} className="mt-8 w-full">
          {card.button}
        </Button>
      )}

      {index > 0 ? (
        <button className="t-support mt-4 self-center hover:text-text" onClick={() => void goTo(index - 1)}>
          Back
        </button>
      ) : null}
    </div>
  )
}
