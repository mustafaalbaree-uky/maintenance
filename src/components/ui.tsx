import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import type { DueStatus } from '../lib/schedule'

export function Card({
  children,
  onInk = true,
  className = '',
}: {
  children: ReactNode
  onInk?: boolean
  className?: string
}) {
  return (
    <div
      className={`rounded-[10px] bg-panel px-[13px] py-3 ${onInk ? 'border border-line' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

const STATUS_COLOR: Record<DueStatus, string> = {
  overdue: 'var(--color-overdue)',
  due_soon: 'var(--color-soon)',
  upcoming: 'var(--color-clear)',
  ok: 'var(--color-line)',
}

/**
 * A card with a left rule in the status color. Never a filled colored card: a red card
 * at the top of the screen every time he is 200 miles late teaches him to dread opening
 * the app. The rule reads as urgent without reading as failure.
 */
export function StatusRow({
  status,
  children,
  onClick,
}: {
  status: DueStatus
  children: ReactNode
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className="block w-full rounded-r-[10px] bg-panel px-[13px] py-3 text-left transition-colors duration-[120ms] hover:bg-panel-hi"
      style={{ borderLeft: `3px solid ${STATUS_COLOR[status]}` }}
    >
      {children}
    </Tag>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  // 52px tall rather than the 44px minimum. At the minimum they read as flat next to the
  // cards, and a thumb reaching the bottom of the screen wants the extra height.
  const base =
    'min-h-[52px] rounded-[12px] px-5 py-[15px] t-card-title transition-opacity duration-[120ms] disabled:opacity-40'
  const style =
    variant === 'primary'
      ? 'bg-action text-action-ink hover:opacity-90'
      : 'border border-line text-text-2 hover:text-text'
  return (
    <button className={`${base} ${style} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Input({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="t-section mb-[9px] block">{label}</span>
      <input
        className={`min-h-[44px] w-full rounded-[10px] border border-line bg-panel-hi px-3 text-text placeholder:text-text-3 ${className}`}
        style={{ fontVariantNumeric: 'tabular-nums lining' }}
        {...rest}
      />
      {hint ? <span className="t-support mt-1 block text-text-3">{hint}</span> : null}
    </label>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="t-section mb-[9px]">{children}</h2>
}

/**
 * Wraps a list of cards. On the phone it stays the single column it always was. From the
 * desktop breakpoint up it lays the same cards into columns so a wide screen uses its
 * width instead of a stretched phone column. `items-start` keeps one card expanding from
 * stretching the height of its row neighbors.
 */
export function CardGrid({
  children,
  columns = 2,
  className = '',
}: {
  children: ReactNode
  columns?: 2 | 3
  className?: string
}) {
  const cols = columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
  return (
    <div className={`flex flex-col gap-2 lg:grid lg:items-start lg:gap-3 ${cols} ${className}`}>
      {children}
    </div>
  )
}

/** Never "Nothing here yet." Name what will live there and why it matters. */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Card>
      <p className="t-body text-text-2">{children}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="t-support mt-2" style={{ color: 'var(--color-overdue)' }}>
      {children}
    </p>
  )
}
