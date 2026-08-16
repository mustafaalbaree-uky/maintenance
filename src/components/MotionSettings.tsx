import { useState } from 'react'
import { MOTION_LABELS, getMotion, prefersReducedMotion, setMotion, type MotionLevel } from '../lib/motion'

const LEVELS: MotionLevel[] = ['restrained', 'considered', 'full']

export function MotionSettings() {
  const [level, setLevelState] = useState<MotionLevel>(getMotion())
  const systemOverride = prefersReducedMotion()

  return (
    <div className="flex flex-col gap-2">
      {LEVELS.map((l) => (
        <label
          key={l}
          className="flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2 transition-colors duration-[120ms]"
          style={{
            borderColor: level === l ? 'var(--color-action)' : 'var(--color-line)',
            background: level === l ? 'var(--color-panel-hi)' : 'transparent',
          }}
        >
          <input
            type="radio"
            name="motion"
            className="mt-[5px]"
            checked={level === l}
            onChange={() => {
              setLevelState(l)
              setMotion(l)
            }}
          />
          <span>
            <span className="t-card-title block">{MOTION_LABELS[l].label}</span>
            <span className="t-support">{MOTION_LABELS[l].blurb}</span>
          </span>
        </label>
      ))}

      {systemOverride ? (
        <p className="t-support text-text-3">
          Your phone is set to reduce motion, so the app is holding still whatever you pick
          here. Change it in accessibility settings if you want the movement.
        </p>
      ) : null}
    </div>
  )
}
