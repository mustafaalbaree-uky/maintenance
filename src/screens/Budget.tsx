import { useStore } from '../lib/store'
import { Card, CardGrid, SectionLabel } from '../components/ui'
import { budgetSummary } from '../lib/budget'
import { miles, money, today } from '../lib/format'

// The three numbers this screen exists to show: what the coming twelve months and the
// rest of ownership are projected to cost from the schedule items the ownership guide
// gives figures for, and what has actually been spent so far. Same series builder as the
// Coming up trendline, so the two screens can never disagree.

export function Budget() {
  const { vehicle, items, logs, receipts, warranties, estimate } = useStore()
  if (!vehicle) return null

  const summary = budgetSummary(vehicle, items, logs, receipts, estimate, today())
  const maxCare = warranties.find((w) => w.deductible_cents != null)

  return (
    <div className="px-4 py-5">
      <h1 className="t-title mb-2">Budget</h1>
      <p className="t-support mb-5 text-text-3">
        Projected from the items the ownership guide gives figures for, {miles(summary.range.startMiles)} to{' '}
        {miles(summary.range.endMiles)} miles.
      </p>

      <CardGrid columns={3}>
        {summary.hasCostData ? (
          <>
            <Card>
              <SectionLabel>Next twelve months</SectionLabel>
              <p className="t-title mt-1">{money(summary.projectedNextTwelveMonthsCents)}</p>
              <p className="t-support mt-1 text-text-3">
                {miles(summary.currentMiles)} to {miles(summary.twelveMonthMiles)} miles.
              </p>
            </Card>

            <Card>
              <SectionLabel>Rest of ownership</SectionLabel>
              <p className="t-title mt-1">{money(summary.projectedRestOfOwnershipCents)}</p>
              <p className="t-support mt-1 text-text-3">
                {miles(summary.currentMiles)} to {miles(summary.range.endMiles)} miles.
              </p>
            </Card>
          </>
        ) : (
          <Card>
            <p className="t-body text-text-2">
              None of your active schedule items have a cost figure in the ownership guide.
            </p>
          </Card>
        )}

        <Card>
          <SectionLabel>Spent so far</SectionLabel>
          <p className="t-title mt-1">{money(summary.spentSoFarCents)}</p>
          <p className="t-support mt-1 text-text-3">From logged service and receipts.</p>
        </Card>

        {maxCare ? (
          <Card>
            <SectionLabel>{maxCare.name} deductible</SectionLabel>
            <p className="t-title mt-1">{money(maxCare.deductible_cents as number)}</p>
            {maxCare.reduced_deductible_cents != null ? (
              <p className="t-support mt-1 text-text-3">
                {money(maxCare.reduced_deductible_cents)}
                {maxCare.reduced_deductible_condition ? ` at ${maxCare.reduced_deductible_condition}` : ''}.
              </p>
            ) : null}
          </Card>
        ) : null}
      </CardGrid>
    </div>
  )
}
