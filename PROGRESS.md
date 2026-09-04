# Progress

Working record of what is built, what is deliberately not, and what to pick up next.
Update this in the same commit as the work it describes.

Last updated: 4 Sep 2026.

---

## Where it runs

| | |
|---|---|
| Repo | `mustafaalbaree-uky/maintenance`, public because Pages requires it on the free plan |
| Live | https://mustafaalbaree-uky.github.io/maintenance/ |
| Deploy | GitHub Actions on push to `main`. Runs the unit tests, then builds and publishes `dist` |
| Backend | Supabase project `otruqvbnxjqmjstmmawf`, **shared with the mailbox app** |
| Schema | Everything in the `maintenance` schema. Mailbox owns `public` |
| Storage | Bucket `maintenance-receipts`, private, signed URLs only |

### Rules that come with sharing the project

- **`supabase db push` does not work.** The remote migration history holds mailbox's
  migrations, which are not in this repo, so the CLI refuses. Apply new migrations with
  `supabase db query --linked -f supabase/migrations/<file>.sql`, in order.
- **Never run `supabase config push`.** No scoping flag, so it would overwrite mailbox's
  auth and API settings with this repo's `config.toml`.
- **Never run the CLI's suggested `migration repair --status reverted`.** It would corrupt
  mailbox's history.
- `auth.users` is shared, so a mailbox login is a valid login here. Membership in
  `maintenance.app_member` is what actually grants access, and the `vehicle` policy checks
  it. Add someone with an insert into that table.
- **Both apps are served from the same github.io origin**, so they would share one
  localStorage session slot. The client sets `storageKey: 'maintenance-auth'` to prevent
  that, and signs out with `scope: 'local'` so it cannot end the other app's session.
- `service_role` needs its own grants on this schema. Only `authenticated` had them at
  first, which silently refused every admin script before RLS was even consulted.
- Signups are disabled on the project, correctly: mailbox's public key ships in a bundle.
  Accounts are created with the admin API. See README for the call.
- The `maintenance` schema had to be added to Exposed schemas in the dashboard.

---

## Accounts

| Account | Purpose |
|---|---|
| `mohammadalbaree@gmail.com` | The real one. Untouched, no vehicle yet |
| `mammergaming55+maintenance@gmail.com` | Tester. Carries `is_tester`, which reveals the Testing panel in Settings |

New accounts get `must_change_password` in user metadata, which routes the first sign in
to a set your own password screen.

---

## Phase 1, done

- Migrations, RLS **and grants** on every table. Policies alone deny everything: Supabase
  issues no table grants to `authenticated` by default. That cost a debugging cycle.
- `provision_vehicle` copies templates into a working plan: 18 schedule items, 9 watch
  items, 19 tasks, 2 warranties.
- Seed data from the ownership guide only. Exactly four populated cost fields. No timing
  chain item, which the guide calls a forum myth.
- Adaptive projection and schedule logic, pure and unit tested.
- Auth, vehicle setup, twelve card onboarding, odometer entry, Coming up, service logging,
  tasks, Receipts.
- Deployed as an installable PWA.

## Phase 2

**Timeline of watch items, built 4 Sep 2026.** `/timeline` lists every watch item on the
vehicle, ordered by where its mileage window starts, each on its own segment of a shared
axis running from the purchase odometer forward. A marker on every segment shows the
current odometer, so a glance says whether the car is ahead of, inside, or past each
window. Cost figures only render where the seed data has them; the rest render without
that line rather than inventing one. Reuses `useStore` and the existing card and
typography language, no new colors. `BUILT_ROUTES` in `Onboarding.tsx` now includes it,
so the onboarding card that promises the timeline now routes there instead of advancing
past it.

Verified with unit tests on the placement math (`src/lib/timeline.test.ts`, purchase to
plan end range, window position relative to the current odometer, fraction clamping) and
a Playwright render against the local dev server with every Supabase call intercepted and
answered from fixture data shaped like the real tables (`scripts/check-timeline-render.mjs`).
The local Supabase stack could not be started to verify against it directly: no container
runtime was running on this machine (`docker ps` failed with no daemon socket), so this
is the fallback the repo's own verification section already allows for.

**Cost over ownership trendline, built 4 Sep 2026.** A card on Coming up, not its own
route. No onboarding card names a trendline screen the way cards point at `/timeline`,
`/symptoms`, and `/budget`, and Coming up is the screen a person actually opens
repeatedly, which is where a running number like this belongs.

The projected line sums, on the mileage axis Timeline already established, every active
`maintenance_item` that carries a cost figure in the ownership guide: as of this seed
data, that is exactly two items, the transmission fluid service and the 12V battery load
test. A mileage interval item places directly. A calendar interval item is converted to a
mileage position with the same adaptive daily rate `projection.ts` uses everywhere else,
reused rather than re-derived. The line holds flat between occurrences and out to the end
of the range rather than stopping at the last dollar figure the guide happens to give.
Watch items are deliberately excluded from this line: `coverage_guess` is a guess, not a
certainty, and folding a maybe into a cumulative cost of ownership number would state it
as fact. Watch items keep their own figures on `/timeline`.

Logged spend overlays the line as points, one per visit rather than one per logged job,
matching the grouping History.tsx already uses (a receipt covering three jobs is one
dollar total, not three), reading `Receipt.total_cost_cents` first and a bare
`ServiceLog.cost_cents` only when no receipt is attached. A visit with no cost figure at
all contributes no point.

Recharts, first use in this repo despite being a dependency since Phase 1. One line, no
legend: the card title and caption carry what the line and the dot mean. Muted grid,
labelled axes, the existing dark theme's action and clear colors, no new palette.

Verified with unit tests on the series builders (`src/lib/trendline.test.ts`: the
ownership range, the cost midpoint rule, mileage and calendar interval placement, the
inactive and uncosted item exclusions, the flat tail, the per visit dedupe on actuals)
and a Playwright render against the local dev server with Supabase intercepted and
answered from fixture data, checking the chart renders, the line and dot counts, and that
no legend appears (`scripts/check-trendline-render.mjs`). Same fallback as the timeline
slice: no container runtime on this machine to verify against the local Supabase stack
directly.

**Symptom lookup, built 4 Sep 2026.** `/symptoms` lists every symptom the ownership guide
names, searchable by a word from the symptom itself or from one of its aliases (`clunk`
matches "Clunk from the rear over bumps"; `rattle` matches the same row through an
alias). Each row opens to the guide's likely cause and what to check first. Where a
symptom traces to a `watch_template`, the row also shows the vehicle's own provisioned
watch item from that template (its name, window, coverage sentence, and cost range),
found by matching `watch_template_id` against `useStore().watchItems` rather than
against the global template table. A symptom with no `watch_template_id`, such as the
fuel pump recall symptom, opens to just the guide text with no related item line. Cost
renders only where the matched watch item carries a figure; the rest render without that
line, matching the rule the rest of the app already follows.

The matching logic (`src/lib/symptoms.ts`: `searchSymptoms`, `relatedWatchItem`) is pure
and unit tested (`src/lib/symptoms.test.ts`), same shape as `timeline.ts`. `symptom_ref`
is a global template table like `watch_template`, so the screen fetches it directly with
a scoped `supabase.from('symptom_ref').select('*')` rather than adding it to the store,
since nothing else in the app needs it yet.

Reuses `Card`, `SectionLabel`, `Input`, `EmptyState`, `useStore`, and the theme's status
colors (an urgency of `stop_driving` reads in the overdue color, `soon` in the soon
color, `normal` carries no badge). No new colors, no free text generated by the app: the
likely cause, first check, and cost figures are all guide text or guide numbers.

Verified with unit tests on the search and relation logic and a Playwright render
against the local dev server with Supabase intercepted and answered from fixture data,
checking the unfiltered list, an alias search narrowing it, an opened row's guide text
and related item, a cost figure rendering where the fixture has one, and no dollar
figure rendering where it does not (`scripts/check-symptoms-render.mjs`). Same fallback
as Timeline and the trendline card: no container runtime on this machine to verify
against the local Supabase stack directly.

`BUILT_ROUTES` in `Onboarding.tsx` now includes `/symptoms`, so onboarding card 8 routes
there instead of advancing past it.

**Warranty screen, built 4 Sep 2026.** `/warranty` lists both provisioned warranty rows.
Each card shows what it covers and excludes from the seed's `notes` text, the deductible
figures where the row has them, and the current odometer's position against every
mileage or date cap the row carries. The current odometer is the last logged reading
(`estimate.latest.miles`), not the adaptive projection Timeline and Home show, since a
warranty cap is a contractual fact to check against a receipt rather than an
extrapolation. It falls back to the purchase odometer, a real measurement, when no
reading has been logged.

MaxCare's 75,000 mile cap stays unresolved: `warranty.cap_is_total_odometer` is null in
the seed, so the card shows both readings side by side, "if total odometer" and "if since
purchase," each against the current odometer, rather than picking one. **This is still an
open question**, waiting on CarMax to answer the "First week" task already in the seed.
The factory warranty's basis was already known at seed time (`cap_is_total_odometer:
true`), so it shows one mileage cap line plus its date cap, which stays blank until the
in service date is recorded.

A form under the MaxCare card records the answer once it comes back: total odometer or
since purchase, plus the date CarMax answered. Recording writes
`cap_is_total_odometer`, `starts_from_odometer` (the purchase odometer, only for a since
purchase answer), and the new `cap_basis_recorded_at` date onto the warranty row, and the
card collapses from two readings to the one the answer resolved to. `starts_from_odometer`
already existed on the table for exactly this; `cap_basis_recorded_at` did not, so
`supabase/migrations/20260904000100_warranty_basis_recorded.sql` adds it, applied to the
linked project with `supabase db query --linked -f`.

The math (`src/lib/warranty.ts`: `capEndpoints`, `resolvedCapMiles`, `milesUntilCap`) is
pure and unit tested (`src/lib/warranty.test.ts`), same shape as `timeline.ts` and
`symptoms.ts`. Reuses `Card`, `SectionLabel`, `Button`, `ErrorText`, `useStore`, and
`statusFor` from `schedule.ts` for the overdue and due soon coloring, so a warranty a
person is about to run out on reads the same as a maintenance item that is.

Verified with unit tests on the cap math and a Playwright render against the local dev
server with Supabase intercepted and answered from fixture data, including a PATCH
handler that mutates the fixture in place so the render script can pick "since purchase,"
submit, and confirm the card actually collapses to one cap line
(`scripts/check-warranty-render.mjs`). Same fallback as the rest of Phase 2: no
container runtime on this machine to verify against the local Supabase stack directly.

No onboarding card names `/warranty`, so it is not in `BUILT_ROUTES` and there is no in
app link to it yet, matching how `/timeline` and `/symptoms` are also only reachable
through their onboarding cards or a direct URL today.

**Budget, built 4 Sep 2026.** `/budget` shows three figures: what the coming twelve
months are projected to cost, what the rest of ownership is projected to cost, and what
has already been spent. `src/lib/budget.ts` builds all three on top of
`src/lib/trendline.ts` rather than re-deriving occurrence placement or cost summing: the
twelve month mark is a mileage, not a date, found with the same adaptive daily rate the
rest of the app uses to move between the two, and the cost through that mileage (and
through the end of the ownership range) is read off the trendline's step series. Spent so
far is the last point of the same actual series Coming up already plots. A MaxCare
deductible card shows wherever a warranty row carries a deductible figure; nothing is
shown for a warranty row without one.

Same exclusion as the trendline card: only active `maintenance_item` rows with a cost
figure feed the projection, watch items are left out because their figures are a
coverage guess rather than a certainty. When no active item carries a cost figure, the
two projected cards give way to a line saying so rather than a pair of zeros.

Reuses `Card`, `SectionLabel`, `useStore`, `budgetSummary` built on `trendline.ts`, and
the Shell auth guard. No new colors, no free text advice, nothing invented.

Verified with unit tests on the summary math (`src/lib/budget.test.ts`: clamping the
current mileage into the ownership range, projecting the twelve month boundary forward
with the daily rate and clamping it to the range end, an occurrence that falls outside
versus inside the twelve month window, the no cost data case, and reading spent so far
off the actual series) and a Playwright render against the local dev server with
Supabase intercepted and answered from fixture data, checking all three cards, the
MaxCare deductible card, and that no undefined or NaN value renders
(`scripts/check-budget-render.mjs`). Same fallback as the rest of Phase 2: no container
runtime on this machine to verify against the local Supabase stack directly.

`BUILT_ROUTES` in `Onboarding.tsx` now includes `/budget`, so onboarding card 9 routes
there instead of advancing past it.

Not started: notifications, offline queue flush, PDF export, desktop density pass.

## Phase 3, not started

Notification dispatch: `pg_cron` job, outbox rows, dedupe, `NoneChannel`, preview screen.
Offline queue flush. PDF export.

The channel preference UI exists in Settings and writes `notification_preference`. Nothing
sends. The UI says so rather than implying otherwise.

## Phase 4

The chosen notification channel, multi user. Not planned.

---

## Changes made after the original spec, and why

- **Sign in only, no signup screen.** Forced by the shared project, and correct for a one
  user app.
- **History renamed to Receipts**, with logging as its primary action. "History" read as
  optional; this screen is the warranty record.
- **Movement is a setting** (Still, Considered, Full), defaulting to Still. The spec argued
  for near total restraint. That argument holds for someone opening the app to read one
  number, so it stays the default rather than being overwritten. `prefers-reduced-motion`
  overrides all three.
- **A car silhouette sits inside the gauge.**
- **Twelve onboarding cards**, adding Receipts and reminders.
- **Form controls are 16px**, not the 14px in the type scale. iOS Safari zooms into any
  focused field under 16px and does not zoom back out. Platform constraint, not a choice.
- **Receipts are their own row.** One visit covers several jobs on one piece of paper, so
  a receipt is a row and services point at it. Money lives on the receipt so summing
  service rows cannot double count.

## iOS specifics

Everything here was found on a real phone, not in a browser.

- **Form controls are 16px.** Safari zooms into any focused field under that and does not
  zoom back out.
- **Page zoom is locked at 1x** by `lock-zoom.ts`, at the owner's request. The viewport tag
  does nothing in Safari, which has ignored `user-scalable` since iOS 10; what works is
  preventDefault on the gesture events and on a multi touch touchmove, all with
  `passive: false`. System wide accessibility zoom is untouched. This does cost the ability
  to magnify a receipt photo.
- **The session lives in IndexedDB**, mirrored to localStorage. iOS clears script written
  localStorage, which signed him out on every launch from the Home Screen.
- **An `apple-touch-icon` is declared explicitly.** With none, iOS falls back to Safari's
  icon cache for the origin, which is shared with the other app, so the Home Screen icon
  was mailbox's. iOS caches the icon at save time: the shortcut has to be removed and
  re-added to pick up a change.
- **Safe area insets** on the body and tab bar. The status bar is translucent over a
  `viewport-fit=cover` page, so without them the header draws under the clock.

## Bugs found and fixed

- **The two apps shared one login.** Both are served from the same github.io origin and
  point at the same Supabase project, so supabase-js defaulted both to
  `sb-<ref>-auth-token`: one localStorage slot for two apps. Signing into mailbox signed
  you into Maintenance. Fixed with `storageKey: 'maintenance-auth'`. Sign out is also
  scoped `local` now, because the default revokes every refresh token the user holds and
  would sign them out of mailbox too.
- **Any mailbox account could use this app.** Owning a row was the only requirement.
  There is now an `app_member` table, checked inside the `vehicle` RLS policy, so the
  database refuses non members. Non members get an explaining screen rather than an empty
  app. Add someone with an insert into `maintenance.app_member`.
- **Two cars, one merged schedule.** Child queries relied on RLS to scope rows, which
  scopes them to the *user*, not to the car being shown. An account with two vehicles saw
  every item twice. Queries now filter on `vehicle_id`, vehicle setup refuses to make a
  second car, and `provision_vehicle` returns quietly if the car is already set up.

- "Nothing's due. Leather conditioning in about 0 miles." A time based item has no
  mileage, and the empty state asked for its miles anyway. Pinned by tests.
- A vehicle with no readings showed 0 miles. It now falls back to the purchase odometer,
  which is a real measurement on the vehicle row.
- The shell chose between the app and the sign in screen before the stored session had
  been read, flashing a screen the visitor should not see.

---

## Verification

```sh
npm test                          # 32 unit tests, projection and schedule
./scripts/verify-backend.sh       # provisioning and RLS, needs API and ANON env for remote
node scripts/check-auth-gate.mjs  # signed out visitor is held at sign in, phone and desktop
SVC=<service_role_key> node scripts/smoke-ui.mjs   # walks every screen, both widths
SVC=<service_role_key> node scripts/check-session-persistence.mjs  # survives a storage wipe
```

`smoke-ui.mjs` creates a throwaway account, screenshots every screen to `/tmp/ui-*.png`,
then deletes the account and its rows. It never uses a real password: the session is
injected from an admin issued token. If it exits early the account survives, so check
`auth.users` for `uismoke%` leftovers.

The auth gate check runs Playwright against the deployed site with clean storage, and
covers deep links.

## Known gaps

- The Chrome extension never responded this session. Playwright is the way to look at
  this app now, through the two scripts above.
- No screen yet lets you attach a photo to a receipt that was saved without one.
- The dryness of the visual design was only half addressed. Motion is now optional; the
  layout and hierarchy pass has not been done.
- The weighted least squares rate moves slower than the spec's "absorbed within a few
  months" claims. The formula matches the spec; the claim is optimistic. A 60 day halflife
  would match the wording, and would change every projected date.
