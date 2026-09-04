// Warranty cap math. Pure so it is unit tested without a database.
//
// A mileage cap on a warranty row is always a distance from some reading. Which reading
// depends on the basis: cap_is_total_odometer true means the cap is measured against the
// car's total odometer, false means it is measured against miles driven since purchase,
// and null means the basis is not recorded yet, which is the seeded state for MaxCare
// until CarMax answers the question in the "First week" task list.

import type { Warranty } from './types'

export interface MaxCareEndpoints {
  /** The cap read as a total odometer figure: ends_at_miles itself. */
  totalOdometerMiles: number
  /** The cap read as miles driven since purchase: purchase odometer plus ends_at_miles. */
  sincePurchaseMiles: number
}

/**
 * Both readings of a mileage cap, for a warranty whose basis is not yet recorded. Null
 * when the row carries no mileage cap at all.
 */
export function capEndpoints(warranty: Warranty, purchaseOdometer: number): MaxCareEndpoints | null {
  if (warranty.ends_at_miles == null) return null
  return {
    totalOdometerMiles: warranty.ends_at_miles,
    sincePurchaseMiles: purchaseOdometer + warranty.ends_at_miles,
  }
}

/**
 * The single mileage cap a warranty row resolves to, in total odometer terms, once its
 * basis is recorded. Null when there is no mileage cap, or the basis is not recorded.
 * Prefers the row's own starts_from_odometer, the reading recorded at the same time as
 * the basis, over the vehicle's purchase odometer, so a later change to one does not
 * silently move an already recorded cap.
 */
export function resolvedCapMiles(warranty: Warranty, purchaseOdometer: number): number | null {
  if (warranty.ends_at_miles == null || warranty.cap_is_total_odometer == null) return null
  if (warranty.cap_is_total_odometer) return warranty.ends_at_miles
  return (warranty.starts_from_odometer ?? purchaseOdometer) + warranty.ends_at_miles
}

/** Miles left before a mileage cap, negative once past it. Null when capMiles is null. */
export function milesUntilCap(capMiles: number | null, currentOdometer: number): number | null {
  if (capMiles == null) return null
  return capMiles - currentOdometer
}
