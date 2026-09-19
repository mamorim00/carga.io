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
- [x] Basic profile fields: name, sport(s), birthdate, sex — `Athlete.sports: Sport[]` (multi-sport),
      `birthDate`/`sex` self-reported by the athlete at invite acceptance (`/invite/[token]`), sport(s)
      picked by the coach at invite time (`/dashboard/invite`).

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
- [x] Re-sync / manual "pull now" button for athlete — `src/components/ResyncButton.tsx` on
      `/progress` (shown when `hasWearable`). Client-only, no backend call: labeled as simulated,
      same as the "Conectar com Strava" button — there's nothing real to trigger yet, and faking a
      successful sync would create data that isn't backed by anything real.

## Athlete app (web, mobile-responsive)

- [ ] Post-activity push/notification prompt when a new Strava activity lands. Needs both Strava
      sync (above) and a push mechanism (web push/VAPID or a native app) — no decision made yet.
- [x] Session RPE input (Foster CR-10 scale) — `src/app/checkin/CheckinForm.tsx`.
- [x] Wellness check-in form: sleep, soreness, mood, stress, hydration — all five, all required —
      `src/app/checkin/CheckinForm.tsx`.
- [x] Pain map: body diagram, tap-to-mark location, intensity, note — `src/components/BodyMap.tsx`
      (16 front-view hotspots + 2 "not visible from front" chips for upper/lower back), `/pain`
      (athlete self-reports anytime, not tied to a check-in), backed by `addPainReport`.
- [x] Menstrual cycle log: flow, symptoms, cycle phase — `/cycle`, backed by `addCycleLog`/
      `getAthleteCycleLogs`. Linked from `/progress` only when `athlete.sex === "FEMALE"`; not
      hard-blocked for anyone else who navigates there directly (sex is self-reported and often
      `UNSPECIFIED`, and gating personal health data entry felt more paternalistic than helpful).
      No coach-facing view of this anywhere — unlike pain reports, this is data an athlete tracks
      only for themselves.
- [x] Personal trends view: athlete's own load history and wellness over time — `/progress`
      (ACWR, monotony, strain, wellness composite, weekly load chart, recent activities) plus
      `/dashboard/[athleteId]` for the coach's view of the same athlete.
- [x] Manual activity entry fallback (no wearable / Strava not synced yet) — `/checkin?manual=1`,
      `POST /api/activities/manual`.

## Metrics engine

- [x] Internal load calc: session-RPE × duration — `internalLoad()`.
- [x] External load calc: HR-based TRIMP — `externalLoadFromHrZones()` (Edwards-style, weighted by
      HR zone). Pace-based (running) and power-based (cycling) load are **not** implemented — HR
      zones are the only external-load input today, and only Strava-sourced seed data has them.
- [x] Combined daily/weekly load — `combinedLoad()`.
- [x] Monotony: mean ÷ 7-day stdev — `monotony()`, surfaced on `/progress` and `/dashboard/[athleteId]`.
- [x] Strain: weekly load × monotony — `strain()`, surfaced alongside monotony.
- [x] ACWR: EWMA, 7-day acute : 28-day chronic — `ewmaAcwr()`, matches the spec's chosen method.
- [x] Wellness composite score — `wellnessComposite()` (sleep + mood + hydration, soreness/stress
      inverted, averaged to one 1–5 score), shown next to ACWR on `/progress`.
- [ ] Background job to recompute metrics on new data. **Partial in spirit, not in mechanism** —
      `submitCheckin()` recomputes that athlete's load synchronously, inline, on the request that
      submits the check-in. That's correct today but isn't a job queue, and a real DB move should
      probably keep it this way (recompute-on-write) rather than add a queue for this scale.

## Coach dashboard (web)

- [x] Roster view: athletes with ACWR status (green/amber/red) — `/dashboard`.
- [x] Per-athlete detail page: daily/weekly load, monotony, strain — `/dashboard/[athleteId]`.
      Numbers, not charts, for monotony/strain (matches the weekly-load bar chart's own simplicity).
- [x] Pain map review across roster — `/dashboard/pain`, via `getPainReportsForCoach`.
- [x] Non-compliance flag: athlete hasn't synced/logged RPE in N days — `isNonCompliant()`
      (threshold: 3 days, this app's own choice, no literature citation for it), a stat tile on
      `/dashboard`, a badge on the roster card and the athlete detail page. `AlertRule` in
      `prisma/schema.prisma` is still unused by the app — this flag is computed on read, not
      backed by a stored rule (no coach-configurable thresholds yet; that's Phase 2's
      "configurable alerts").
- [x] CSV/PDF export of an athlete's load history — `GET /api/athletes/[athleteId]/export` for a
      real CSV download; `/dashboard/[athleteId]/print` for PDF, via the browser's own print
      dialog against a print-styled report page rather than a new PDF-generation dependency.

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
- [x] Responsive layout — `/dashboard`'s sidebar stacks to a horizontal scrollable bar and the
      roster grid/side panel collapse to one column below `md`/`lg`; the athlete-facing pages were
      already mobile-first. Verified via the actual rendered class names over curl (no headless
      browser in this sandbox to screenshot different viewports), not just written and assumed.
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

### In progress

1. **Real Postgres + Prisma migration** — connection string is in hand (Prisma Postgres, via
   Vercel's integration) and sitting in a local, gitignored `.env`. Not yet done: running the
   first `prisma db push`/`migrate dev` against it, then swapping `src/lib/data.ts`'s in-memory
   arrays for the real Prisma client (same function signatures, so nothing above it changes) and
   converting every caller to `await` it. This is the one item that removes a whole class of
   "in-memory, resets on restart, and even forks per Next.js compilation layer within one
   process" caveats from the README at once.

### Needs something from you before I can build it for real

2. **Strava OAuth integration** — register an app at
   [developers.strava.com](https://developers.strava.com) and give me the client id/secret (as
   environment variables, never pasted in chat); then I can build consent, token storage +
   refresh, activity sync (webhook or polling), and field mapping.
3. **Push notifications** — decide web push (needs VAPID keys, works in-browser) vs. a native
   app (bigger project) before "post-activity push prompt" can be built.
4. **Billing** — a Pix-capable provider account (Mercado Pago/PagSeguro/Efí, or Stripe if its Pix
   support covers Brazil for your case) and a Stripe account for cards; then subscription tiers
   and management.

### Everything else buildable now is done

The only "buildable now, no accounts needed" items left are ones tied to a bigger effort above
(e.g., real subscription tiers depend on billing being wired up first) or genuinely Phase 2+ per
the spec's own scope line (multi-coach roles, configurable alert thresholds, messaging).

Pick any numbered item and tell me to go — I'll work it the same way as everything so far: build
it, verify it (tests + a real click-through, not just a green build), and push.
