import { useEffect, useState } from 'react'

// How much the app moves. The original position was near total restraint, on the argument
// that opening the app to check one number makes animation a delay. That holds for the
// person checking a number, so it stays the default, and anyone who wants more can say so.

export type MotionLevel = 'restrained' | 'considered' | 'full'

const KEY = 'maintenance:motion'
const EVENT = 'maintenance:motion-change'

export const MOTION_LABELS: Record<MotionLevel, { label: string; blurb: string }> = {
  restrained: {
    label: 'Still',
    blurb: 'One sweep the first time you ever open it, and nothing after. Fastest to read.',
  },
  considered: {
    label: 'Considered',
    blurb: 'The needle settles, sheets slide from where you tapped, rows open smoothly.',
  },
  full: {
    label: 'Full',
    blurb: 'All of the above, plus the odometer counting up and screens moving as you switch tabs.',
  },
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export function getMotion(): MotionLevel {
  if (typeof localStorage === 'undefined') return 'restrained'
  const v = localStorage.getItem(KEY)
  return v === 'considered' || v === 'full' ? v : 'restrained'
}

export function setMotion(level: MotionLevel): void {
  localStorage.setItem(KEY, level)
  applyMotionAttribute()
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Drives the CSS. The system preference always wins over the stored choice. */
export function applyMotionAttribute(): void {
  if (typeof document === 'undefined') return
  const level = prefersReducedMotion() ? 'restrained' : getMotion()
  document.documentElement.dataset.motion = level
}

export function useMotion(): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>(() =>
    prefersReducedMotion() ? 'restrained' : getMotion(),
  )

  useEffect(() => {
    const sync = () => setLevel(prefersReducedMotion() ? 'restrained' : getMotion())
    window.addEventListener(EVENT, sync)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      mq.removeEventListener('change', sync)
    }
  }, [])

  return level
}

/** Milliseconds for a given interaction, by level. Zero means do not animate. */
export function duration(level: MotionLevel, kind: 'needle' | 'sheet' | 'expand' | 'enter'): number {
  if (level === 'restrained') return kind === 'needle' ? 400 : 0
  const table = {
    considered: { needle: 620, sheet: 260, expand: 200, enter: 260 },
    full: { needle: 820, sheet: 320, expand: 240, enter: 340 },
  } as const
  return table[level][kind]
}
