# Progress

Working record of what is built, what is deliberately not, and what to pick up next.
Update this in the same commit as the work it describes.

Last updated: 16 Aug 2026.

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

## Phase 2, not started

Trendline chart, Timeline of watch items, Warranty screen including the unresolved MaxCare
cap prompt, Symptom lookup, desktop density pass.

Onboarding cards 7, 8 and 9 point at `/timeline`, `/symptoms` and `/budget`. Until those
routes exist the cards advance instead of routing. `BUILT_ROUTES` in `Onboarding.tsx` is
the switch. **Add each route there as it ships.**

## Phase 3, not started

Notification dispatch: `pg_cron` job, outbox rows, dedupe, `NoneChannel`, preview screen.
Budget. Offline queue flush. PDF export.

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
