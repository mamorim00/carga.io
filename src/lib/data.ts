import {
  classifyAcwr,
  combinedLoad,
  ewmaAcwr,
  externalLoadFromHrZones,
  internalLoad,
} from "./metrics";
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
 */

let nextId = 1;
function id(prefix: string): string {
  return `${prefix}_${nextId++}`;
}

const org: Org = { id: "org_1", name: "Fundo BH" };
const coach: Coach = { id: "coach_1", name: "Rafael Mendes", email: "rafael@fundobh.com.br" };

const athletes: Athlete[] = [];
const activities: Activity[] = [];
const sessionReports: SessionReport[] = [];
const wellnessCheckins: WellnessCheckin[] = [];
const painReports: PainReport[] = [];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Builds `days` days of activity history for one athlete (oldest first),
 * using a per-day RPE/duration curve, and returns the combined daily loads
 * alongside the created Activity/SessionReport rows.
 */
function seedHistory(
  athleteId: string,
  days: number,
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null,
  source: Activity["source"],
) {
  const loads: number[] = [];
  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
    const session = curve(days - 1 - dayIndex);
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
    const internal = internalLoad(session.rpe, session.durationMin);
    const external = hrZones ? externalLoadFromHrZones(hrZones) : undefined;
    loads.push(combinedLoad(internal, external));
  }
  return loads;
}

function seedAthlete(opts: {
  name: string;
  email: string;
  sport: Athlete["sport"];
  hasWearable: boolean;
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null;
  source: Activity["source"];
}): { athlete: Athlete; loads: number[] } {
  const athlete: Athlete = {
    id: id("ath"),
    orgId: org.id,
    coachId: coach.id,
    name: opts.name,
    email: opts.email,
    sport: opts.sport,
    hasWearable: opts.hasWearable,
  };
  athletes.push(athlete);
  const loads = seedHistory(athlete.id, 40, opts.curve, opts.source);
  return { athlete, loads };
}

const loadsByAthlete = new Map<string, number[]>();

function seed() {
  // Steady, well-managed load → IDEAL.
  const marina = seedAthlete({
    name: "Marina Alves",
    email: "marina.alves@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5 + (d % 3), durationMin: 35 + (d % 4) * 5 } : null),
  });
  loadsByAthlete.set(marina.athlete.id, marina.loads);

  const diego = seedAthlete({
    name: "Diego Ferreira",
    email: "diego.ferreira@atleta.com",
    sport: "TRIATHLON",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 1 ? { rpe: 4 + (d % 4), durationMin: 40 + (d % 5) * 4 } : null),
  });
  loadsByAthlete.set(diego.athlete.id, diego.loads);

  // Sharp spike in the last 7 days → RISK.
  const camila = seedAthlete({
    name: "Camila Souza",
    email: "camila.souza@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => {
      if (d >= 33) return { rpe: 6 + (d % 3), durationMin: 55 + (d % 3) * 6 }; // last 7 days: heavy
      return d % 2 === 0 ? { rpe: 5, durationMin: 32 } : null;
    },
  });
  loadsByAthlete.set(camila.athlete.id, camila.loads);

  // Trending up but not yet critical → ATTENTION.
  const bruno = seedAthlete({
    name: "Bruno Castro",
    email: "bruno.castro@atleta.com",
    sport: "CYCLING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => {
      const ramp = Math.min(d / 39, 1);
      return d % 2 === 0 ? { rpe: 5 + Math.round(ramp * 3), durationMin: 40 + ramp * 25 } : null;
    },
  });
  loadsByAthlete.set(bruno.athlete.id, bruno.loads);

  const ana = seedAthlete({
    name: "Ana Paula Lima",
    email: "ana.lima@atleta.com",
    sport: "RUNNING",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5, durationMin: 38 } : null),
  });
  loadsByAthlete.set(ana.athlete.id, ana.loads);

  // No wearable at all — logs manually, and hasn't in a few days (stale sync).
  const thiago = seedAthlete({
    name: "Thiago Nunes",
    email: "thiago.nunes@atleta.com",
    sport: "TRIATHLON",
    hasWearable: false,
    source: "MANUAL",
    curve: (d) => {
      if (d >= 35) return null; // nothing logged in the last ~5 days
      return d % 3 === 0 ? { rpe: 6, durationMin: 45 } : null;
    },
  });
  loadsByAthlete.set(thiago.athlete.id, thiago.loads);
}

seed();

// ---- Read API (roster, athlete detail) --------------------------------

export function getOrg(): Org {
  return org;
}

export function getCoach(): Coach {
  return coach;
}

export function listAthletes(): Athlete[] {
  return athletes;
}

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

export function getRoster(): AthleteLoadSummary[] {
  return athletes.map((a) => getAthleteLoadSummary(a.id));
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

/** The athlete used by the check-in/progress pages until real auth exists. */
export function getDemoAthleteId(): string {
  return athletes[0].id;
}
