// Mirrors prisma/schema.prisma. Kept as plain TS types (rather than
// `@prisma/client`'s generated types) so the app runs against the in-memory
// store in src/lib/data.ts today and against a real Postgres via Prisma
// later without changing call sites.

export type Sport = "RUNNING" | "CYCLING" | "TRIATHLON" | "OTHER";
export type ActivitySource = "STRAVA" | "GARMIN" | "APPLE_HEALTH" | "MANUAL";
export type AcwrZone = "IDEAL" | "ATTENTION" | "RISK";
/** ACTIVE once the athlete follows their invite link and sets a password. */
export type AthleteStatus = "INVITED" | "ACTIVE";

export interface Org {
  id: string;
  name: string;
}

export interface Coach {
  id: string;
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface Athlete {
  id: string;
  orgId: string;
  coachId: string;
  name: string;
  email: string;
  sport: Sport;
  /** true once the athlete has connected a wearable (Strava, at launch). */
  hasWearable: boolean;
  status: AthleteStatus;
  /** Set once the invite is accepted; null while status is INVITED. */
  passwordHash: string | null;
  /** Opaque, single-use; null once accepted or if never invited this way. */
  inviteToken: string | null;
  inviteExpiresAt: string | null;
}

export interface Activity {
  id: string;
  athleteId: string;
  source: ActivitySource;
  startedAt: string; // ISO date
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  hrZones?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  hasSessionReport: boolean;
}

export interface SessionReport {
  id: string;
  athleteId: string;
  activityId: string;
  rpe: number; // 1–10, Foster CR-10
  createdAt: string;
}

export interface WellnessCheckin {
  id: string;
  athleteId: string;
  date: string; // ISO date
  sleep: number; // 1–5
  soreness: number; // 1–5
  mood: number; // 1–5
  stress: number; // 1–5
}

export interface PainReport {
  id: string;
  athleteId: string;
  bodyPart: string;
  intensity: number; // 1–10
  note?: string;
  createdAt: string;
}

export interface AthleteLoadSummary {
  athleteId: string;
  name: string;
  sport: Sport;
  acwr: number | null;
  zone: AcwrZone | null;
  weeklyLoad: number;
  last7Days: number[]; // combined load per day, oldest first
  lastSyncedAt: string | null;
  hasWearable: boolean;
}
