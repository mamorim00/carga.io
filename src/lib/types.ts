// Mirrors prisma/schema.prisma. Kept as plain TS types (rather than
// `@prisma/client`'s generated types) so the app runs against the in-memory
// store in src/lib/data.ts today and against a real Postgres via Prisma
// later without changing call sites.

export type Sport = "RUNNING" | "CYCLING" | "TRIATHLON" | "OTHER";
export type ActivitySource = "STRAVA" | "GARMIN" | "APPLE_HEALTH" | "MANUAL";
export type AcwrZone = "IDEAL" | "ATTENTION" | "RISK";
/** ACTIVE once the athlete follows their invite link and sets a password. */
export type AthleteStatus = "INVITED" | "ACTIVE";
/** Self-reported at invite acceptance; used for RPE/ACWR norms and cycle-log eligibility. */
export type Sex = "FEMALE" | "MALE" | "UNSPECIFIED";

/**
 * Body regions selectable on the pain map (`src/components/BodyMap.tsx`).
 * Most are tappable hotspots on the front-view silhouette; the two "costas"
 * entries aren't visible from the front and are offered as separate chips.
 */
export const BODY_PARTS = [
  "HEAD",
  "NECK",
  "SHOULDER_L",
  "SHOULDER_R",
  "CHEST",
  "ABDOMEN",
  "ARM_L",
  "ARM_R",
  "HIP_L",
  "HIP_R",
  "THIGH_L",
  "THIGH_R",
  "KNEE_L",
  "KNEE_R",
  "LOWER_LEG_L",
  "LOWER_LEG_R",
  "UPPER_BACK",
  "LOWER_BACK",
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export type CycleFlow = "NONE" | "LIGHT" | "MEDIUM" | "HEAVY";
export type CyclePhase = "MENSTRUAL" | "FOLLICULAR" | "OVULATION" | "LUTEAL";

export const CYCLE_SYMPTOMS = ["CRAMPS", "FATIGUE", "HEADACHE", "BLOATING", "MOOD_SWINGS"] as const;
export type CycleSymptom = (typeof CYCLE_SYMPTOMS)[number];

/** INITIAL is the intake exam; every check after that is a FOLLOW_UP. */
export type AssessmentKind = "INITIAL" | "FOLLOW_UP";
export const MEASUREMENT_CATEGORIES = ["ROM", "STRENGTH", "MOVEMENT_QUALITY"] as const;
export type MeasurementCategory = (typeof MEASUREMENT_CATEGORIES)[number];

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
  /** At least one; the coach picks these when creating the invite. */
  sports: Sport[];
  /** ISO date; null until the athlete sets it at invite acceptance. */
  birthDate: string | null;
  sex: Sex;
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
  hydration: number; // 1–5
}

export interface PainReport {
  id: string;
  athleteId: string;
  bodyPart: BodyPart;
  intensity: number; // 1–10
  note?: string;
  createdAt: string;
}

export interface CycleLog {
  id: string;
  athleteId: string;
  date: string; // ISO date
  flow: CycleFlow;
  symptoms: CycleSymptom[];
  /** The athlete's own read on where they are in the cycle; not derived from `flow`. */
  phase: CyclePhase | null;
}

/**
 * One named measurement within an Assessment (e.g. "Flexão de joelho D",
 * 120, "graus"). Free-form label + optional numeric value rather than a
 * fixed joint/muscle taxonomy, so a physio can track whatever they actually
 * measure; reassessments are compared by matching `label` across an
 * athlete's assessments over time.
 */
export interface Measurement {
  id: string;
  category: MeasurementCategory;
  label: string;
  value: number | null;
  unit: string | null;
  note?: string;
}

/**
 * A physio-style intake or follow-up exam — recorded by the professional,
 * not self-reported by the athlete (unlike PainReport). File attachments
 * (exam PDFs, etc.) aren't built yet — examsNote/medicationsNote are free
 * text until this app has a blob-storage decision to attach real files.
 */
export interface Assessment {
  id: string;
  athleteId: string;
  coachId: string;
  kind: AssessmentKind;
  date: string; // ISO date
  examsNote?: string;
  medicationsNote?: string;
  generalNote?: string;
  createdAt: string;
  measurements: Measurement[];
}

export interface AthleteLoadSummary {
  athleteId: string;
  name: string;
  sports: Sport[];
  acwr: number | null;
  zone: AcwrZone | null;
  weeklyLoad: number;
  last7Days: number[]; // combined load per day, oldest first
  /** Foster monotony/strain over the same last7Days window; null until 7 days of history exist. */
  monotony: number | null;
  strain: number | null;
  lastSyncedAt: string | null;
  hasWearable: boolean;
}
