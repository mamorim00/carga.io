import crypto from "crypto";
import {
  classifyAcwr,
  combinedLoad,
  ewmaAcwr,
  externalLoadFromHrZones,
  internalLoad,
} from "./metrics";
import { hashPassword } from "./password";
import type {
  Activity,
  AthleteLoadSummary,
  Athlete,
  Coach,
  Org,
  PainReport,
  SessionReport,
  WellnessCheckin,
} from "./types";

/**
 * In-memory data layer for the prototype build.
 *
 * This stands in for Prisma + Postgres (see prisma/schema.prisma for the
 * real schema) so the app is runnable in this sandbox, where outbound
 * access to fetch Prisma's query-engine binary is blocked and there's no
 * live Postgres instance. Every function here has a 1:1 real counterpart
 * once DATABASE_URL points at a real database — swap the body, keep the
 * signature, and the pages/API routes above it don't change.
 *
 * Password hashing itself lives in src/lib/password.ts, not here — this
 * module only ever stores/compares the resulting hash string, the same way
 * a real users table would.
 *
 * State lives on `globalThis`, not in plain module-level `let`/`const`
 * bindings. Next.js compiles Route Handlers, Server Components/Pages, and
 * Proxy as separate bundles ("layers"), and each one gets its own
 * instantiation of this module — confirmed by testing: an activity POSTed
 * to /api/activities/manual was invisible to the /checkin *page*'s render
 * moments later, in both `next dev` and a production `next start`. Plain
 * module state would silently fork into N independent copies. `globalThis`
 * is the one thing guaranteed to be the same object across all of them
 * within a single process — the same trick Next.js's own docs recommend
 * for a singleton Prisma client in dev.
 */

interface Store {
  nextId: number;
  seeded: boolean;
  orgs: Org[];
  coaches: Coach[];
  athletes: Athlete[];
  activities: Activity[];
  sessionReports: SessionReport[];
  wellnessCheckins: WellnessCheckin[];
  painReports: PainReport[];
  loadsByAthlete: Map<string, number[]>;
}

const globalForCarga = globalThis as unknown as { __cargaStore?: Store };
const store: Store = (globalForCarga.__cargaStore ??= {
  nextId: 1,
  seeded: false,
  orgs: [],
  coaches: [],
  athletes: [],
  activities: [],
  sessionReports: [],
  wellnessCheckins: [],
  painReports: [],
  loadsByAthlete: new Map(),
});

function id(prefix: string): string {
  return `${prefix}_${store.nextId++}`;
}

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const orgs = store.orgs;
const coaches = store.coaches;
const athletes = store.athletes;
const activities = store.activities;
const sessionReports = store.sessionReports;
const wellnessCheckins = store.wellnessCheckins;
const painReports = store.painReports;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

type WellnessCurve = (dayIndex: number) => Pick<WellnessCheckin, "sleep" | "soreness" | "mood" | "stress">;

/**
 * Builds `days` days of activity history for one athlete (oldest first),
 * using a per-day RPE/duration curve, and returns the combined daily loads
 * alongside the created Activity/SessionReport rows. When `wellness` is
 * given, every trained day also gets a WellnessCheckin — mirroring the real
 * check-in flow, where a session report and a wellness check-in are
 * submitted together.
 */
function seedHistory(
  athleteId: string,
  days: number,
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null,
  source: Activity["source"],
  wellness?: WellnessCurve,
) {
  const loads: number[] = [];
  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
    const relativeDay = days - 1 - dayIndex;
    const session = curve(relativeDay);
    if (!session) {
      loads.push(0);
      continue;
    }
    const activityId = id("act");
    const hrZones =
      source === "MANUAL"
        ? undefined
        : {
            z1: session.durationMin * 0.3,
            z2: session.durationMin * 0.3,
            z3: session.durationMin * 0.25,
            z4: session.durationMin * 0.1,
            z5: session.durationMin * 0.05,
          };
    activities.push({
      id: activityId,
      athleteId,
      source,
      startedAt: isoDaysAgo(dayIndex),
      durationMin: session.durationMin,
      distanceKm: Math.round(session.durationMin * 0.19 * 10) / 10,
      avgHr: 140 + Math.round(session.rpe * 3),
      hrZones,
      hasSessionReport: true,
    });
    sessionReports.push({
      id: id("sr"),
      athleteId,
      activityId,
      rpe: session.rpe,
      createdAt: isoDaysAgo(dayIndex),
    });
    if (wellness) {
      wellnessCheckins.push({
        id: id("wc"),
        athleteId,
        date: isoDaysAgo(dayIndex),
        ...wellness(relativeDay),
      });
    }
    const internal = internalLoad(session.rpe, session.durationMin);
    const external = hrZones ? externalLoadFromHrZones(hrZones) : undefined;
    loads.push(combinedLoad(internal, external));
  }
  return loads;
}

function seedAthlete(opts: {
  orgId: string;
  coachId: string;
  name: string;
  email: string;
  sport: Athlete["sport"];
  hasWearable: boolean;
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null;
  wellness?: WellnessCurve;
  source: Activity["source"];
}): { athlete: Athlete; loads: number[] } {
  const athlete: Athlete = {
    id: id("ath"),
    orgId: opts.orgId,
    coachId: opts.coachId,
    name: opts.name,
    email: opts.email,
    sport: opts.sport,
    hasWearable: opts.hasWearable,
    // Seeded athletes start ACTIVE (with a demo password — see README) so
    // the demo roster is reachable through the same real login as any
    // account created via signup + invite.
    status: "ACTIVE",
    passwordHash: DEMO_PASSWORD_HASH,
    inviteToken: null,
    inviteExpiresAt: null,
  };
  athletes.push(athlete);
  const loads = seedHistory(athlete.id, 40, opts.curve, opts.source, opts.wellness);
  return { athlete, loads };
}

const loadsByAthlete = store.loadsByAthlete;

// Every seeded account (the demo coach and all six demo athletes) shares
// this one password so the demo roster is reachable through the same real
// login as any account created via signup + invite. See README for the
// credentials. Hashed once at module load, not per-account.
const DEMO_PASSWORD_HASH = hashPassword("carga1234");

function seed() {
  const org: Org = { id: id("org"), name: "Fundo BH" };
  orgs.push(org);
  const coach: Coach = {
    id: id("coach"),
    orgId: org.id,
    name: "Rafael Mendes",
    email: "rafael@fundobh.com.br",
    passwordHash: DEMO_PASSWORD_HASH,
  };
  coaches.push(coach);

  // Steady, well-managed load → IDEAL. Wellness matches: consistently good.
  const marina = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Marina Alves",
    email: "marina.alves@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5 + (d % 3), durationMin: 35 + (d % 4) * 5 } : null),
    wellness: (d) => ({ sleep: 4 + (d % 2), soreness: 1 + (d % 2), mood: 5 - (d % 2), stress: 1 + (d % 2) }),
  });
  loadsByAthlete.set(marina.athlete.id, marina.loads);

  const diego = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Diego Ferreira",
    email: "diego.ferreira@atleta.com",
    sport: "TRIATHLON",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 1 ? { rpe: 4 + (d % 4), durationMin: 40 + (d % 5) * 4 } : null),
    wellness: (d) => ({ sleep: 4, soreness: 2 + (d % 2), mood: 4, stress: 1 + (d % 2) }),
  });
  loadsByAthlete.set(diego.athlete.id, diego.loads);

  // Sharp spike in the last 7 days → RISK. Wellness degrades right along with it:
  // sleep and mood drop, soreness and stress climb once the heavy block starts.
  const camila = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Camila Souza",
    email: "camila.souza@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => {
      if (d >= 33) return { rpe: 6 + (d % 3), durationMin: 55 + (d % 3) * 6 }; // last 7 days: heavy
      return d % 2 === 0 ? { rpe: 5, durationMin: 32 } : null;
    },
    wellness: (d) =>
      d >= 33
        ? { sleep: 2, soreness: 5, mood: 2, stress: 4 + (d % 2) }
        : { sleep: 4, soreness: 2, mood: 4, stress: 2 },
  });
  loadsByAthlete.set(camila.athlete.id, camila.loads);

  // Trending up but not yet critical → ATTENTION. Wellness slides down the same ramp.
  const bruno = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Bruno Castro",
    email: "bruno.castro@atleta.com",
    sport: "CYCLING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => {
      const ramp = Math.min(d / 39, 1);
      return d % 2 === 0 ? { rpe: 5 + Math.round(ramp * 3), durationMin: 40 + ramp * 25 } : null;
    },
    wellness: (d) => {
      const ramp = Math.min(d / 39, 1);
      return {
        sleep: Math.max(2, Math.round(4 - ramp * 2)),
        soreness: Math.min(5, Math.round(1 + ramp * 3)),
        mood: Math.max(2, Math.round(4 - ramp * 2)),
        stress: Math.min(5, Math.round(1 + ramp * 3)),
      };
    },
  });
  loadsByAthlete.set(bruno.athlete.id, bruno.loads);

  const ana = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Ana Paula Lima",
    email: "ana.lima@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5, durationMin: 38 } : null),
    wellness: () => ({ sleep: 4, soreness: 2, mood: 4, stress: 2 }),
  });
  loadsByAthlete.set(ana.athlete.id, ana.loads);

  // No wearable at all — logs manually, and hasn't in a few days (stale sync).
  // Wellness is a bit more tired overall: sparser, harder sessions with less recovery in between.
  const thiago = seedAthlete({
    orgId: org.id,
    coachId: coach.id,
    name: "Thiago Nunes",
    email: "thiago.nunes@atleta.com",
    sport: "TRIATHLON",
    hasWearable: false,
    source: "MANUAL",
    curve: (d) => {
      if (d >= 35) return null; // nothing logged in the last ~5 days
      return d % 3 === 0 ? { rpe: 6, durationMin: 45 } : null;
    },
    wellness: () => ({ sleep: 3, soreness: 3, mood: 3, stress: 3 }),
  });
  loadsByAthlete.set(thiago.athlete.id, thiago.loads);
}

// Guarded by the shared store, not module-load order: whichever
// compilation layer (Route Handler, Page, Proxy) happens to load this
// module first seeds the shared arrays; every other layer sees
// `store.seeded` already true (same global object) and reuses them as-is.
if (!store.seeded) {
  seed();
  store.seeded = true;
}

// ---- Auth: coaches, accounts, sessions ---------------------------------

export function getOrg(orgId: string): Org | undefined {
  return orgs.find((o) => o.id === orgId);
}

export function getCoach(coachId: string): Coach | undefined {
  return coaches.find((c) => c.id === coachId);
}

export function findCoachByEmail(email: string): Coach | undefined {
  return coaches.find((c) => c.email.toLowerCase() === email.toLowerCase());
}

export function findAthleteByEmail(email: string): Athlete | undefined {
  return athletes.find((a) => a.email.toLowerCase() === email.toLowerCase());
}

/** True if any coach or athlete already uses this email — invites and signup both check this. */
export function isEmailTaken(email: string): boolean {
  return Boolean(findCoachByEmail(email) || findAthleteByEmail(email));
}

/**
 * Coach self-signup: creates a brand-new Org and Coach together (there's no
 * "join an existing org" flow yet — every coach who signs up starts their
 * own, empty roster, and invites athletes into it from there).
 */
export function createCoachAccount(input: { orgName: string; name: string; email: string; passwordHash: string }): Coach {
  const org: Org = { id: id("org"), name: input.orgName };
  orgs.push(org);
  const coach: Coach = {
    id: id("coach"),
    orgId: org.id,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
  };
  coaches.push(coach);
  return coach;
}

/**
 * Creates the invited athlete's record up front, in INVITED status — there
 * is no separate "invite" entity; the Athlete row itself carries the
 * pending token until accepted (or revoked). This mirrors the flat style
 * of the rest of this file more than a fully normalized invites table
 * would, at the cost of losing history for revoked/expired invites.
 */
export function createAthleteInvite(input: {
  orgId: string;
  coachId: string;
  name: string;
  email: string;
  sport: Athlete["sport"];
}): Athlete {
  const athlete: Athlete = {
    id: id("ath"),
    orgId: input.orgId,
    coachId: input.coachId,
    name: input.name,
    email: input.email,
    sport: input.sport,
    hasWearable: false,
    status: "INVITED",
    passwordHash: null,
    inviteToken: generateInviteToken(),
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  };
  athletes.push(athlete);
  return athlete;
}

/** Invites this coach has sent that are still awaiting acceptance. */
export function getPendingInvites(coachId: string): Athlete[] {
  return athletes.filter((a) => a.coachId === coachId && a.status === "INVITED");
}

/** Cancels a pending invite. Only the inviting coach can revoke it; a no-op otherwise. */
export function revokeInvite(athleteId: string, coachId: string): boolean {
  const index = athletes.findIndex((a) => a.id === athleteId && a.coachId === coachId && a.status === "INVITED");
  if (index === -1) return false;
  athletes.splice(index, 1);
  return true;
}

/** Looks up a pending, unexpired invite by its token — used by the public accept-invite page. */
export function getAthleteByInviteToken(token: string): Athlete | undefined {
  return athletes.find(
    (a) =>
      a.inviteToken === token &&
      a.status === "INVITED" &&
      a.inviteExpiresAt !== null &&
      new Date(a.inviteExpiresAt).getTime() > Date.now(),
  );
}

/** Activates an invited athlete's account with the password they just set. */
export function acceptAthleteInvite(input: { token: string; passwordHash: string }): Athlete {
  const athlete = getAthleteByInviteToken(input.token);
  if (!athlete) throw new Error("convite inválido ou expirado");
  athlete.status = "ACTIVE";
  athlete.passwordHash = input.passwordHash;
  athlete.inviteToken = null;
  athlete.inviteExpiresAt = null;
  return athlete;
}

// ---- Read API (roster, athlete detail) --------------------------------

export function getAthlete(athleteId: string): Athlete | undefined {
  return athletes.find((a) => a.id === athleteId);
}

export function getAthleteActivities(athleteId: string): Activity[] {
  return activities
    .filter((a) => a.athleteId === athleteId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getLatestUnreportedActivity(athleteId: string): Activity | undefined {
  return getAthleteActivities(athleteId).find((a) => !a.hasSessionReport);
}

export interface ActivityFeedItem extends Activity {
  /** RPE from the linked session report, once the athlete has checked in. */
  rpe: number | null;
}

/** Recent activities for an athlete, most recent first, joined with their RPE if reported. */
export function getAthleteActivityFeed(athleteId: string, limit = 10): ActivityFeedItem[] {
  return getAthleteActivities(athleteId)
    .slice(0, limit)
    .map((activity) => ({
      ...activity,
      rpe: sessionReports.find((r) => r.activityId === activity.id)?.rpe ?? null,
    }));
}

export function getAthleteLoadSummary(athleteId: string): AthleteLoadSummary {
  const athlete = getAthlete(athleteId);
  if (!athlete) throw new Error(`unknown athlete ${athleteId}`);
  const loads = loadsByAthlete.get(athleteId) ?? [];
  const acwr = loads.length ? ewmaAcwr(loads) : null;
  const last7 = loads.slice(-7);
  const activitiesForAthlete = getAthleteActivities(athleteId);
  return {
    athleteId,
    name: athlete.name,
    sport: athlete.sport,
    acwr,
    zone: acwr == null ? null : classifyAcwr(acwr),
    weeklyLoad: Math.round(last7.reduce((a, b) => a + b, 0)),
    last7Days: last7,
    lastSyncedAt: activitiesForAthlete[0]?.startedAt ?? null,
    hasWearable: athlete.hasWearable,
  };
}

/** Active athletes on this coach's roster. Pending invites are listed separately — see getPendingInvites. */
export function getRoster(coachId: string): AthleteLoadSummary[] {
  return athletes.filter((a) => a.coachId === coachId && a.status === "ACTIVE").map((a) => getAthleteLoadSummary(a.id));
}

export function getWellnessHistory(athleteId: string, days = 7): WellnessCheckin[] {
  return wellnessCheckins
    .filter((w) => w.athleteId === athleteId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
}

// ---- Write API (check-in flow, manual entry) ---------------------------

export function addManualActivity(input: {
  athleteId: string;
  durationMin: number;
  distanceKm?: number;
  startedAt?: string;
}): Activity {
  const activity: Activity = {
    id: id("act"),
    athleteId: input.athleteId,
    source: "MANUAL",
    startedAt: input.startedAt ?? new Date().toISOString(),
    durationMin: input.durationMin,
    distanceKm: input.distanceKm,
    hasSessionReport: false,
  };
  activities.unshift(activity);
  return activity;
}

export function submitCheckin(input: {
  athleteId: string;
  activityId: string;
  rpe: number;
  sleep: number;
  soreness: number;
  mood: number;
  stress: number;
}): { sessionReport: SessionReport; wellnessCheckin: WellnessCheckin } {
  const activity = activities.find((a) => a.id === input.activityId);
  if (!activity || activity.athleteId !== input.athleteId) {
    throw new Error("activity not found for this athlete");
  }
  const sessionReport: SessionReport = {
    id: id("sr"),
    athleteId: input.athleteId,
    activityId: input.activityId,
    rpe: input.rpe,
    createdAt: new Date().toISOString(),
  };
  sessionReports.push(sessionReport);
  activity.hasSessionReport = true;

  const wellnessCheckin: WellnessCheckin = {
    id: id("wc"),
    athleteId: input.athleteId,
    date: new Date().toISOString(),
    sleep: input.sleep,
    soreness: input.soreness,
    mood: input.mood,
    stress: input.stress,
  };
  wellnessCheckins.push(wellnessCheckin);

  // Fold the new day's load into this athlete's history so the dashboard
  // and progress view reflect the check-in immediately.
  const internal = internalLoad(input.rpe, activity.durationMin);
  const external = activity.hrZones ? externalLoadFromHrZones(activity.hrZones) : undefined;
  const loads = loadsByAthlete.get(input.athleteId) ?? [];
  loads.push(combinedLoad(internal, external));
  loadsByAthlete.set(input.athleteId, loads);

  return { sessionReport, wellnessCheckin };
}

export function addPainReport(input: {
  athleteId: string;
  bodyPart: string;
  intensity: number;
  note?: string;
}): PainReport {
  const report: PainReport = {
    id: id("pr"),
    athleteId: input.athleteId,
    bodyPart: input.bodyPart,
    intensity: input.intensity,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  painReports.push(report);
  return report;
}
