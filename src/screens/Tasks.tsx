import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Card, SectionLabel } from '../components/ui'
import type { Task } from '../lib/types'

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-overdue)',
  high: 'var(--color-soon)',
  normal: 'var(--color-line)',
}

function TaskCard({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const done = Boolean(task.completed_at)
  return (
    <div
      className="rounded-r-[10px] bg-panel px-[13px] py-3"
      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[task.severity] ?? 'var(--color-line)'}` }}
    >
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={done} onChange={onToggle} className="mt-1 h-4 w-4" />
        <span className="flex-1">
          <span className={`t-card-title ${done ? 'text-text-3 line-through' : ''}`}>
            {task.title}
          </span>
          <p className="t-body mt-1 text-text-2">{task.detail}</p>
          {task.why_urgent ? <p className="t-support mt-1">{task.why_urgent}</p> : null}
          {task.external_url ? (
            <a
              href={task.external_url}
              target="_blank"
              rel="noreferrer"
              className="t-support mt-1 inline-block underline hover:text-text"
            >
              Open the site
            </a>
          ) : null}
        </span>
      </label>
    </div>
  )
}

export function Tasks() {
  const { tasks, refresh } = useStore()

  async function toggle(task: Task) {
    await supabase
      .from('task')
      .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
      .eq('id', task.id)
    await refresh()
  }

  const groups = Array.from(new Set(tasks.map((t) => t.group_label ?? 'Other')))

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-5">First things</h1>

      {groups.map((group) => (
        <div key={group} className="mb-7">
          <SectionLabel>{group}</SectionLabel>
          <div className="flex flex-col gap-2">
            {tasks
              .filter((t) => (t.group_label ?? 'Other') === group)
              .map((t) => (
                <TaskCard key={t.id} task={t} onToggle={() => void toggle(t)} />
              ))}
          </div>
        </div>
      ))}

      {tasks.length === 0 ? (
        <Card>
          <p className="t-body text-text-2">Your first week and first month lists live here.</p>
        </Card>
      ) : null}
    </div>
  )
}
