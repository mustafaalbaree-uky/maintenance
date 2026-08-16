import { useEffect, useRef, useState } from 'react'
import { duration, useMotion } from '../lib/motion'

// The instrument cluster. Needle position is the live estimated odometer and the red
// band is the 60,000 to 80,000 mile window from the research, so the gauge does the work
// of the ownership document without a paragraph of text.

const CX = 150
const CY = 130
const R = 108
const STROKE = 9

const DANGER_START = 60000
const DANGER_END = 80000

interface Props {
  purchaseOdometer: number
  planEndOdometer: number
  odometer: number
  /** Sweeps from the previous angle when a new reading is saved. */
  animateFrom?: number | null
  introAnimation?: boolean
  width?: number
}

function fraction(miles: number, start: number, end: number) {
  if (end <= start) return 0
  return Math.min(1, Math.max(0, (miles - start) / (end - start)))
}

function point(f: number) {
  const theta = ((180 - f * 180) * Math.PI) / 180
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) }
}

function arc(fromF: number, toF: number) {
  const a = point(fromF)
  const b = point(toF)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

function abbreviate(miles: number) {
  return `${Math.round(miles / 1000)}k`
}

function rangeLabel(odometer: number) {
  if (odometer < DANGER_START) return 'the clear range'
  if (odometer <= DANGER_END) return 'the 60,000 to 80,000 mile range where problems cluster'
  return 'the late range'
}

export function Gauge({
  purchaseOdometer,
  planEndOdometer,
  odometer,
  animateFrom = null,
  introAnimation = false,
  width = 300,
}: Props) {
  const motion = useMotion()
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Segment boundaries come from the vehicle row, never hardcoded, so the gauge stays
  // correct if the purchase or plan end mileage changes.
  const f = (m: number) => fraction(m, purchaseOdometer, planEndOdometer)
  const fNow = f(odometer)

  const [displayF, setDisplayF] = useState(() =>
    introAnimation && !reduceMotion ? 0 : animateFrom != null ? f(animateFrom) : fNow,
  )
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const target = fNow
    if (reduceMotion) {
      setDisplayF(target)
      return
    }
    const from = displayF
    if (Math.abs(from - target) < 0.0005) return

    // The first-launch sweep is always the long one. Everything after is feedback on an
    // action, and its length follows the motion setting.
    const ms = introAnimation ? 700 : duration(motion, 'needle')
    const startedAt = performance.now()
    // A needle on a real instrument overshoots very slightly and settles.
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const easeSettle = (t: number) => {
      const c = 1.70158 * 0.6
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
    }
    const ease = motion === 'restrained' ? easeOut : easeSettle

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ms)
      setDisplayF(from + (target - from) * ease(t))
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fNow, motion])

  const needle = point(displayF)
  const needleInner = {
    x: CX + (R - 10) * Math.cos(((180 - displayF * 180) * Math.PI) / 180),
    y: CY - (R - 10) * Math.sin(((180 - displayF * 180) * Math.PI) / 180),
  }

  const ticks = [purchaseOdometer, DANGER_START, DANGER_END, planEndOdometer]

  return (
    <svg
      viewBox="0 0 300 152"
      width={width}
      height={(width * 152) / 300}
      role="img"
      aria-label={`Estimated ${odometer.toLocaleString('en-US')} miles, in ${rangeLabel(odometer)}.`}
      className={introAnimation && !reduceMotion ? 'gauge-intro' : undefined}
    >
      {/* Clear years, purchase to 60,000 */}
      <path
        d={arc(f(purchaseOdometer), f(DANGER_START))}
        stroke="var(--color-clear)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      {/* The window where the known failure points cluster */}
      <path
        d={arc(f(DANGER_START), f(DANGER_END))}
        stroke="var(--color-overdue)"
        strokeWidth={STROKE}
        strokeLinecap="butt"
        fill="none"
      />
      {/* Late years */}
      <path
        d={arc(f(DANGER_END), f(planEndOdometer))}
        stroke="var(--color-soon)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />

      {ticks.map((m) => {
        const p = point(f(m))
        const inward = 0.86
        return (
          <text
            key={m}
            x={CX + (p.x - CX) * inward}
            y={CY + (p.y - CY) * inward + 4}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text-3)"
            style={{ fontVariationSettings: "'wdth' 100, 'wght' 400" }}
          >
            {abbreviate(m)}
          </text>
        )
      })}

      {/* The car sits inside the sweep, in profile, well above the hub so the needle does
          not cut through it. Line work rather than a filled blob, which at this size read
          as a smudge. */}
      <g
        transform="translate(150, 86) scale(0.82)"
        fill="none"
        stroke="var(--color-text-3)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M -30 6 L -26 6 M -12 6 L 12 6 M 26 6 L 30 6" />
        <path
          d="M -30 6 C -31 1, -29 -2, -24 -3 L -15 -10 C -12 -12, -9 -13, -5 -13
             L 6 -13 C 10 -13, 13 -12, 16 -9 L 23 -3 C 28 -2, 31 1, 30 6"
        />
        <path d="M -14 -4 L -9 -10 C -7 -11.5, -5 -11.5, -3 -11.5 L -3 -4 Z" />
        <path d="M 1 -4 L 1 -11.5 L 5 -11.5 C 8 -11.5, 10 -10.5, 12 -8.5 L 15 -4 Z" />
        <circle cx="-19" cy="6" r="6.5" />
        <circle cx="19" cy="6" r="6.5" />
      </g>

      <line
        x1={CX}
        y1={CY}
        x2={needleInner.x}
        y2={needleInner.y}
        stroke="var(--color-action)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r={5.5} fill="var(--color-action)" />
      <circle cx={CX} cy={CY} r={2} fill="var(--color-ink)" />
      {/* needle tip position, kept for layout math parity with the spec */}
      <circle cx={needle.x} cy={needle.y} r={0} fill="none" />
    </svg>
  )
}

/** Six digit cells, a light nod to a mechanical odometer drum. */
export function OdometerReadout({ miles, stagger = false }: { miles: number; stagger?: boolean }) {
  const motion = useMotion()
  const [shown, setShown] = useState(miles)
  const previous = useRef(miles)

  useEffect(() => {
    if (motion !== 'full' || previous.current === miles) {
      previous.current = miles
      setShown(miles)
      return
    }
    const from = previous.current
    previous.current = miles
    const startedAt = performance.now()
    const ms = 700
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (miles - from) * eased))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [miles, motion])

  const digits = String(Math.max(0, Math.round(shown))).padStart(6, '0').split('')
  let leading = true

  return (
    <div className="flex items-end justify-center gap-[3px]" aria-hidden="true">
      {digits.map((d, i) => {
        if (d !== '0') leading = false
        const muted = leading && i < digits.length - 1
        return (
          <span
            key={i}
            className="t-odometer rounded-[3px] border border-line bg-panel-hi px-[6px] py-[2px]"
            style={{
              color: muted ? 'var(--color-text-3)' : 'var(--color-text)',
              animation: stagger ? `cell-rise 240ms ease-out ${i * 40}ms both` : undefined,
            }}
          >
            {d}
          </span>
        )
      })}
      <span className="t-support pb-[6px] pl-1 text-text-3">mi</span>
    </div>
  )
}
