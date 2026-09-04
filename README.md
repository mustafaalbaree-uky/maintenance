# Maintenance

A maintenance planner for one 2022 Genesis G70 3.3T AWD, bought at 42,000 miles and kept
five years.

Every interval, dollar figure, mileage window, and causal claim in the seed data comes
from the ownership guide written for this car. Where that guide is silent, the column is
null and the UI renders without it. If you are adding data, that rule is the important
one: a single invented figure undermines every other figure in the app.

## Stack

Vite, React, TypeScript, Tailwind v4, Recharts, Supabase, GitHub Pages.

## Running it

```sh
npm install
supabase start          # needs a container runtime
cp .env.example .env.local
# fill in .env.local from `supabase status`
npm run dev
```

`npm test` runs the projection and schedule unit tests.
`./scripts/verify-backend.sh` checks provisioning and RLS against the local stack.

### Local Supabase on a small disk

`supabase/config.toml` has analytics, studio, and realtime disabled. Phase 1 uses none of
them, and the full stack does not fit comfortably in a 4 GB VM. Re-enable them if you need
Studio.

## The database is shared

This app's Postgres is the project that also hosts another app in `public`. Everything
here lives in a `maintenance` schema, the storage bucket is `maintenance-receipts`, and
the storage policies are prefixed so they cannot collide. The JS client is pinned with
`db: { schema: 'maintenance' }`.

Two consequences worth knowing:

- `supabase db push` does not work here. The remote migration history contains the other
  app's migrations, which are not in this repo, so the CLI refuses. Apply migrations with
  `supabase db query --linked -f supabase/migrations/<file>.sql` instead, in order.
- `supabase config push` would overwrite the other app's auth and API settings with this
  repo's `config.toml`. Do not run it against the linked project.

Auth users are shared across both apps, since `auth.users` is per project rather than per
schema. RLS keeps the data apart regardless.

Signups are disabled on this project, which is the other app's setting and the right one:
its public key is in a shipped bundle, so open signups would let anyone register. This app
has one user, created once with the admin API, and the auth screen offers sign in and
password reset only. To add a user:

```sh
curl -s "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"...","email_confirm":true,
       "user_metadata":{"must_change_password":true}}'
```

`must_change_password` puts the first sign in on a set your own password screen before the
app is reachable. It is a nudge rather than a control, since a user can clear their own
metadata. Password changes are also available any time from Settings.

## Deploying

GitHub Actions builds on push to `main` and publishes `dist` to Pages. Two repo secrets
are required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The anon key is compiled into the bundle. That is expected, and it is safe only because
RLS is enabled on every table in the same migration that creates it. The service role key
must never reach the frontend.

Routing uses `HashRouter`, and `public/.nojekyll` keeps Pages from eating underscore
paths.

## Layout

```
src/lib/projection.ts   adaptive mileage projection, pure, unit tested
src/lib/schedule.ts     due status for each maintenance item
src/lib/timeline.ts     watch item placement on the mileage axis, pure, unit tested
src/lib/trendline.ts    projected and actual cumulative cost series, pure, unit tested
src/lib/symptoms.ts     symptom search and its related watch item, pure, unit tested
src/lib/warranty.ts     warranty cap math, both readings until the basis is recorded, pure, unit tested
src/lib/budget.ts       next twelve months and rest of ownership cost, built on trendline.ts, pure, unit tested
src/lib/store.tsx       session, vehicle, and derived state
src/content/            onboarding copy, kept out of JSX so template sets can branch
supabase/migrations/    schema, RLS, grants, provisioning function
supabase/seed.sql       templates, watch items, symptoms
```

## Status

Phase 1 is built: auth, vehicle creation, onboarding, odometer entry with the adaptive
projection, Coming up, service logging with receipt capture, tasks, and history.

Phase 2 has the timeline of watch items, the cost over ownership trendline on Coming up,
the symptom lookup at `/symptoms`, and the warranty screen at `/warranty`. The MaxCare
75,000 mile cap is still unresolved there: the screen shows both readings, total odometer
and since purchase, side by side until CarMax answers, and a form on the screen records
the answer once it does. The rest of Phase 2 is not built: notifications and budget. One
onboarding card points at budget and currently advances instead of routing.
