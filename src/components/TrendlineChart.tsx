import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, SectionLabel } from './ui'
import { miles, money } from '../lib/format'
import { actualSeries, ownershipRange, projectedSeries } from '../lib/trendline'
import { useStore } from '../lib/store'

function TrendlineTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { miles: number; cumulativeCents: number } }[]
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-[8px] border border-line bg-panel px-2.5 py-1.5">
      <p className="t-support text-text-2">{miles(point.miles)} miles</p>
      <p className="t-figure text-text">{money(point.cumulativeCents)}</p>
    </div>
  )
}

/**
 * Projected cumulative cost of the schedule items the ownership guide gives figures for,
 * against odometer, with logged spend overlaid where it exists. Watch items are not in
 * this line: they carry a coverage guess, not a certainty, and they have their own
 * figures on the Timeline screen.
 */
export function TrendlineChart() {
  const { vehicle, items, logs, receipts, estimate } = useStore()

  if (!vehicle) return null

  const range = ownershipRange(vehicle)
  const projected = projectedSeries(items, range, estimate.rate.dailyRate)
  const actuals = actualSeries(logs, receipts)
  const hasCostData = projected.some((p) => p.cumulativeCents > 0)

  return (
    <Card>
      <SectionLabel>Cost over ownership</SectionLabel>
      <p className="t-support mb-3 text-text-3">
        Projected from the items the ownership guide gives figures for, {miles(range.startMiles)}{' '}
        to {miles(range.endMiles)} miles. Logged spend is marked where it exists.
      </p>

      {hasCostData ? (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projected} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="miles"
                type="number"
                domain={[range.startMiles, range.endMiles]}
                tickFormatter={(v: number) => miles(v)}
                stroke="var(--color-text-3)"
                tick={{ fill: 'var(--color-text-3)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-line)' }}
              />
              <YAxis
                dataKey="cumulativeCents"
                tickFormatter={(v: number) => money(v)}
                stroke="var(--color-text-3)"
                tick={{ fill: 'var(--color-text-3)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<TrendlineTooltip />} cursor={{ stroke: 'var(--color-line)' }} />
              <Line
                type="stepAfter"
                dataKey="cumulativeCents"
                stroke="var(--color-action)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {actuals.map((a) => (
                <ReferenceDot
                  key={a.miles}
                  x={a.miles}
                  y={a.cumulativeCents}
                  r={4}
                  fill="var(--color-clear)"
                  stroke="var(--color-panel)"
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="t-body text-text-2">
          None of your active schedule items have a cost figure in the ownership guide.
        </p>
      )}
    </Card>
  )
}
