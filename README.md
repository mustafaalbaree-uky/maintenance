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
src/lib/store.tsx       session, vehicle, and derived state
src/content/            onboarding copy, kept out of JSX so template sets can branch
supabase/migrations/    schema, RLS, grants, provisioning function
supabase/seed.sql       templates, watch items, symptoms
```

## Status

Phase 1 is built: auth, vehicle creation, onboarding, odometer entry with the adaptive
projection, Coming up, service logging with receipt capture, tasks, and history.

Phase 2 onward is not built: the trendline chart, timeline, warranty screen with the
unresolved MaxCare cap prompt, symptom lookup, notifications, and budget. Three onboarding
cards point at those screens and currently advance instead of routing.
