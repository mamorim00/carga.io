# MVP Build Tasks — Training Load Platform

Derived from the product spec (Phase 1, 8–12 weeks). Scope decisions baked in: all sports,
Brazil-first (PT-BR, Pix), web app first, targeting solo trainers/small squads.

**Status key:** `[x]` shipped and working · `[ ]` not started, or noted as partial below its line.
Checked against the codebase as of this commit — a box is only checked if the feature actually
works end to end, not just "modeled in the schema."

## Auth & accounts

- [x] Coach signup/login (email + password) — `/signup`, `/login`, `src/lib/auth.ts`,
      `src/lib/password.ts`. Magic link not built (password only).
- [x] Athlete signup/login, invited by coach (invite link) — `/dashboard/invite`, `/invite/[token]`.
      Link, not a short code; no email sending yet, the coach copies/sends the link themselves.
- [x] Single-coach roster model for MVP — each coach signup gets its own Org; no shared/multi-coach
      rosters (matches "deferred to Phase 2").
- [ ] Basic profile fields: name, sport(s), birthdate, sex. **Partial** — name and one `sport` per
      athlete exist (`src/lib/types.ts`); no birthdate, no sex, no multi-sport.

## Strava integration

- [ ] Strava OAuth app registration + consent flow in onboarding wizard. Onboarding has a
      "Conectar com Strava" button today, but it's a label only — no OAuth app is registered, no
      real consent screen. **Needs a Strava API application (client id/secret) from you before
      this can be built for real** — see "Blocked on credentials" below.
- [ ] Token storage + refresh handling per athlete
- [ ] Webhook or polling to pull newly completed activities
- [ ] Map Strava activity fields → internal `Activity` model
- [x] Handle activities with no HR/power data gracefully — `combinedLoad()` in `src/lib/metrics.ts`
      already falls back to internal-load-only when `external` is undefined; the manual-entry path
      exercises this today.
- [ ] Re-sync / manual "pull now" button for athlete

## Athlete app (web, mobile-responsive)

- [ ] Post-activity push/notification prompt when a new Strava activity lands. Needs both Strava
      sync (above) and a push mechanism (web push/VAPID or a native app) — no decision made yet.
- [x] Session RPE input (Foster CR-10 scale) — `src/app/checkin/CheckinForm.tsx`.
- [ ] Wellness check-in form: sleep, soreness, mood, stress, hydration. **Partial** — sleep,
      soreness, mood, stress all exist and work; no hydration field.
- [ ] Pain map: body diagram, tap-to-mark location, intensity, note. **Partial** — the data write
      path exists (`addPainReport` in `src/lib/data.ts`, mirrors `PainReport` in
      `prisma/schema.prisma`) but nothing calls it: no body diagram, no form, no page.
- [ ] Menstrual cycle log: flow, symptoms, cycle phase. Modeled in `prisma/schema.prisma`
      (`CycleLog`) but not implemented in the in-memory layer or the app at all.
- [x] Personal trends view: athlete's own load history and wellness over time — `/progress`
      (ACWR, weekly load chart, recent activities) plus `/dashboard/[athleteId]` for the coach's
      view of the same athlete. Monotony/strain are computed (`src/lib/metrics.ts`) but not
      plotted anywhere yet — see the dashboard section below.
- [x] Manual activity entry fallback (no wearable / Strava not synced yet) — `/checkin?manual=1`,
      `POST /api/activities/manual`.

## Metrics engine

- [x] Internal load calc: session-RPE × duration — `internalLoad()`.
- [x] External load calc: HR-based TRIMP — `externalLoadFromHrZones()` (Edwards-style, weighted by
      HR zone). Pace-based (running) and power-based (cycling) load are **not** implemented — HR
      zones are the only external-load input today, and only Strava-sourced seed data has them.
- [x] Combined daily/weekly load — `combinedLoad()`.
- [x] Monotony: mean ÷ 7-day stdev — `monotony()`. Computed, unit-tested, **not surfaced in any UI**.
- [x] Strain: weekly load × monotony — `strain()`. Same as above: computed, not shown anywhere.
- [x] ACWR: EWMA, 7-day acute : 28-day chronic — `ewmaAcwr()`, matches the spec's chosen method.
- [ ] Wellness composite score — sleep/soreness/mood/stress are stored and shown as four separate
      numbers; nothing combines them into one score.
- [ ] Background job to recompute metrics on new data. **Partial in spirit, not in mechanism** —
      `submitCheckin()` recomputes that athlete's load synchronously, inline, on the request that
      submits the check-in. That's correct today but isn't a job queue, and a real DB move should
      probably keep it this way (recompute-on-write) rather than add a queue for this scale.

## Coach dashboard (web)

- [x] Roster view: athletes with ACWR status (green/amber/red) — `/dashboard`.
- [x] Per-athlete detail page: daily/weekly load chart — `/dashboard/[athleteId]`. Monotony and
      strain charts are **not** there (engine has the numbers; page doesn't plot them).
- [ ] Pain map review across roster — blocked on the pain map itself existing (see above).
- [ ] Non-compliance flag: athlete hasn't synced/logged RPE in N days. **Partial** — every roster
      card and the athlete detail page show "last synced" / time-ago text, but nothing turns that
      into an alert or a threshold-based flag; `AlertRule` exists in `prisma/schema.prisma` and is
      entirely unused by the app.
- [ ] CSV/PDF export of an athlete's load history

## Billing

- [ ] Pix integration for Brazil-first launch. **Needs a payment provider account and API keys
      from you** (Mercado Pago, PagSeguro, Efí, or Stripe's own Pix support) — nothing to build
      against without one.
- [ ] Stripe as secondary/fallback for card payments. **Needs a Stripe account and API keys.**
- [ ] Starter tier: up to 5 athletes, R$59–69/mo — the athlete-count limit itself is a small check
      in `createAthleteInvite`; the tier/plan concept doesn't exist yet.
- [ ] Subscription management (upgrade/downgrade/cancel)

## Infra & non-functional

- [x] PT-BR as default locale, copy written for Brazilian coaches/physios — the whole app is
      PT-BR today, copy included (see `README.md` for the reasoning behind specific phrasing).
- [ ] Responsive layout. **Partial** — the athlete-facing pages (`/login`, `/onboarding`,
      `/checkin`, `/progress`) are built mobile-first (`max-w-md`) and work on a phone; the coach
      dashboard (`/dashboard`, `/dashboard/[athleteId]`, `/dashboard/invite`) is desktop-oriented
      (fixed sidebar, multi-column grid) and hasn't been checked or adapted for tablet/narrow
      screens.
- [ ] Data model migrations for Athlete, Coach, Org/Team, Activity, SessionReport,
      WellnessCheckin, PainReport, CycleLog, AlertRule. **Partial** — `prisma/schema.prisma` models
      all of these (CycleLog and AlertRule included, even though the app doesn't use them yet);
      no migration has ever run because there's no Postgres instance — **needs a `DATABASE_URL`
      from you** to run `npx prisma migrate dev` for the first time. Until then, `src/lib/data.ts`
      is the real (in-memory) implementation the app runs on.
- [ ] Basic error/observability logging for the Strava sync pipeline — nothing to log yet; there's
      no sync pipeline until Strava OAuth exists.

## Explicitly out of scope for MVP (Phase 2+)

- Multi-coach roles, squad heatmap, configurable alerts, messaging (Phase 2)
- Exercise prescription library, program builder, quizzes, TrainingPeaks push (proposed addition —
  confirm phase placement)
- Garmin/Apple Health/Whoop/Oura integrations (Phase 3)
- AI-flagged insights, predictive injury model, public API (Phase 4)

---

## What's actually left, in a reasonable build order

Everything below is what's still `[ ]` above, grouped by whether I can build it right now or need
something from you first.

### Buildable now — no accounts, keys, or decisions needed from you

1. **Athlete profile fields** — birthdate, sex, multi-sport. Small, and other items (RPE norms,
   cycle log eligibility) depend on it, so it's worth doing early.
2. **Wellness composite score** — one number from sleep/soreness/mood/stress, surfaced next to RPE.
3. **Surface monotony & strain** — the engine already computes both; add them to `/progress` and
   `/dashboard/[athleteId]` next to the existing ACWR card.
4. **Hydration field** on the wellness check-in.
5. **Pain map** — body diagram + tap-to-mark + intensity + note, wired to the `addPainReport` path
   that already exists; then **pain map review across roster** on the coach side.
6. **Menstrual cycle log** — data layer (mirroring `CycleLog` in the schema) + a simple log form.
7. **Non-compliance flag** — pick a threshold (e.g., no sync/RPE in 3 days), badge it on the roster
   and athlete detail page.
8. **CSV/PDF export** of an athlete's load history.
9. **Responsive pass on the coach dashboard** — collapse the sidebar, stack the grid, on narrow
   viewports.
10. **Manual "pull now" resync button** — build the UI/action now against the existing (simulated)
    sync state; it'll call the real Strava pull once that exists, same as everywhere else in this
    app that's honest about being a stand-in today.

### Needs something from you before I can build it for real

11. **Real Postgres + Prisma migration** — give me a `DATABASE_URL` (Vercel Postgres, Neon,
    Supabase all work) and I'll run the first migration and swap `src/lib/data.ts` for the real
    Prisma client. This is the one item that removes a whole class of "in-memory, resets on
    restart" caveats from the README at once, so it's worth prioritizing once you're ready to
    commit to a real database.
12. **Strava OAuth integration** — register an app at
    [developers.strava.com](https://developers.strava.com) and give me the client id/secret (as
    environment variables, never pasted in chat); then I can build consent, token storage +
    refresh, activity sync (webhook or polling), and field mapping.
13. **Push notifications** — decide web push (needs VAPID keys, works in-browser) vs. a native
    app (bigger project) before "post-activity push prompt" can be built.
14. **Billing** — a Pix-capable provider account (Mercado Pago/PagSeguro/Efí, or Stripe if its Pix
    support covers Brazil for your case) and a Stripe account for cards; then subscription tiers
    and management.

Pick any numbered item and tell me to go — I'll work it the same way as everything so far: build
it, verify it (tests + a real click-through, not just a green build), and push.
