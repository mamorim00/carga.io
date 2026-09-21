import crypto from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  classifyAcwr,
  combinedLoad,
  ewmaAcwr,
  externalLoadFromHrZones,
  internalLoad,
  monotony,
  strain,
  type HrZoneMinutes,
} from "./metrics";
import { hashPassword } from "./password";
import type {
  Activity,
  Assessment,
  AssessmentKind,
  AthleteLoadSummary,
  Athlete,
  BodyPart,
  Coach,
  CycleFlow,
  CycleLog,
  CyclePhase,
  CycleSymptom,
  Exercise,
  ExerciseCategory,
  ExercisePrescription,
  Measurement,
  MeasurementCategory,
  Org,
  PainReport,
  Sex,
  Sport,
  SessionReport,
  WellnessCheckin,
} from "./types";

/**
 * Data layer — real Postgres via Prisma (prisma/schema.prisma is the source
 * of truth for the shapes below). The in-memory prototype this replaced is
 * gone; every function here does a real query.
 *
 * Two things carried over from the in-memory version, deliberately:
 *
 * - The PrismaClient itself lives on `globalThis`, not a module-level
 *   `const` — the standard fix (same one Next.js's own docs recommend) for
 *   Next.js compiling Route Handlers, Pages/Server Components, and Proxy as
 *   separate bundles that would otherwise each open their own connection
 *   pool. Unlike the old in-memory store, this is purely a connection-count
 *   optimization now — the data itself lives in Postgres, so it's already
 *   shared across every layer/process/region without it.
 * - Daily load history (for ACWR/monotony/strain) is never stored as a
 *   running array. It's recomputed on every read from raw Activity +
 *   SessionReport rows over a rolling calendar window — see
 *   `getDailyLoadsSeries`. docs/mvp-tasks.md's metrics-engine section calls
 *   this out as the intended long-term shape ("recompute-on-write... a real
 *   DB move should probably keep it this way") — recompute-on-read is the
 *   same idea, simpler, and it means there's no derived state that can ever
 *   drift from the activities/session-reports it's derived from.
 *
 * Seeding is idempotent and DB-backed: on first use in a given database,
 * whichever request gets there first seeds the demo org/coach/athletes;
 * every other caller (this process or any other) sees the demo coach
 * already exists and skips it. See `ensureSeeded`.
 *
 * Built and typechecked (`prisma generate` + `next build`) without a live
 * database connection — this sandbox's egress policy blocks raw-TCP
 * Postgres, only HTTPS. Verified against the real thing only via the live
 * Vercel deploy, which does have normal network access. See README.md.
 */

const globalForCarga = globalThis as unknown as {
  __cargaPrisma?: PrismaClient;
  __cargaSeeded?: Promise<void>;
};

const prisma = (globalForCarga.__cargaPrisma ??= new PrismaClient());

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---- Row -> app-type mapping ------------------------------------------
// types.ts is hand-written rather than importing @prisma/client's generated
// types directly, so pages/API routes don't change if the data layer ever
// changes again. These map Prisma's Date objects to the ISO strings that
// contract expects (and fill in the couple of fields, like
// Activity.hasSessionReport, that are derived rather than stored).

function toCoach(c: Prisma.CoachGetPayload<object>): Coach {
  return { id: c.id, orgId: c.orgId, name: c.name, email: c.email, passwordHash: c.passwordHash };
}

function toAthlete(a: Prisma.AthleteGetPayload<object>): Athlete {
  return {
    id: a.id,
    orgId: a.orgId,
    coachId: a.coachId,
    name: a.name,
    email: a.email,
    sports: a.sports as Sport[],
    birthDate: a.birthDate ? a.birthDate.toISOString() : null,
    sex: a.sex as Sex,
    hasWearable: a.hasWearable,
    status: a.status,
    passwordHash: a.passwordHash,
    inviteToken: a.inviteToken,
    inviteExpiresAt: a.inviteExpiresAt ? a.inviteExpiresAt.toISOString() : null,
  };
}

function toActivity(a: Prisma.ActivityGetPayload<object>, hasSessionReport: boolean): Activity {
  return {
    id: a.id,
    athleteId: a.athleteId,
    source: a.source,
    startedAt: a.startedAt.toISOString(),
    durationMin: a.durationMin,
    distanceKm: a.distanceKm ?? undefined,
    avgHr: a.avgHr ?? undefined,
    hrZones: (a.hrZones as HrZoneMinutes | null) ?? undefined,
    hasSessionReport,
  };
}

function toSessionReport(s: Prisma.SessionReportGetPayload<object>): SessionReport {
  return { id: s.id, athleteId: s.athleteId, activityId: s.activityId, rpe: s.rpe, createdAt: s.createdAt.toISOString() };
}

function toWellnessCheckin(w: Prisma.WellnessCheckinGetPayload<object>): WellnessCheckin {
  return {
    id: w.id,
    athleteId: w.athleteId,
    date: w.date.toISOString(),
    sleep: w.sleep,
    soreness: w.soreness,
    mood: w.mood,
    stress: w.stress,
    hydration: w.hydration,
  };
}

function toPainReport(p: Prisma.PainReportGetPayload<object>): PainReport {
  return {
    id: p.id,
    athleteId: p.athleteId,
    bodyPart: p.bodyPart as BodyPart,
    intensity: p.intensity,
    note: p.note ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

function toCycleLog(c: Prisma.CycleLogGetPayload<object>): CycleLog {
  return {
    id: c.id,
    athleteId: c.athleteId,
    date: c.date.toISOString(),
    flow: (c.flow ?? "NONE") as CycleFlow,
    symptoms: c.symptoms as CycleSymptom[],
    phase: (c.phase as CyclePhase | null) ?? null,
  };
}

function toMeasurement(m: Prisma.MeasurementGetPayload<object>): Measurement {
  return {
    id: m.id,
    category: m.category as MeasurementCategory,
    label: m.label,
    value: m.value ?? null,
    unit: m.unit ?? null,
    note: m.note ?? undefined,
  };
}

function toAssessment(
  a: Prisma.AssessmentGetPayload<{ include: { measurements: true } }>,
): Assessment {
  return {
    id: a.id,
    athleteId: a.athleteId,
    coachId: a.coachId,
    kind: a.kind as AssessmentKind,
    date: a.date.toISOString(),
    examsNote: a.examsNote ?? undefined,
    medicationsNote: a.medicationsNote ?? undefined,
    generalNote: a.generalNote ?? undefined,
    createdAt: a.createdAt.toISOString(),
    measurements: a.measurements.map(toMeasurement),
  };
}

function toExercise(e: Prisma.ExerciseGetPayload<object>): Exercise {
  return {
    id: e.id,
    name: e.name,
    category: e.category as ExerciseCategory,
    instructions: e.instructions ?? undefined,
    videoUrl: e.videoUrl ?? undefined,
    source: e.source,
    externalId: e.externalId ?? undefined,
  };
}

function toExercisePrescription(
  p: Prisma.ExercisePrescriptionGetPayload<{ include: { exercise: true } }>,
  doneToday: boolean,
  completedLast7Days: number,
): ExercisePrescription {
  return {
    id: p.id,
    athleteId: p.athleteId,
    coachId: p.coachId,
    exercise: toExercise(p.exercise),
    sets: p.sets ?? null,
    reps: p.reps ?? null,
    frequency: p.frequency ?? undefined,
    notes: p.notes ?? undefined,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    doneToday,
    completedLast7Days,
  };
}

// ---- Seeding (idempotent, DB-backed) -----------------------------------

// Every seeded account (the demo coach and all six demo athletes) shares
// this one password so the demo roster is reachable through the same real
// login as any account created via signup + invite. See README for the
// credentials. Hashed once at module load, not per-account.
const DEMO_PASSWORD_HASH = hashPassword("carga1234");
const DEMO_COACH_EMAIL = "rafael@fundobh.com.br";

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

type WellnessCurve = (
  dayIndex: number,
) => Pick<WellnessCheckin, "sleep" | "soreness" | "mood" | "stress" | "hydration">;

/** Builds `days` days of activity/session-report/wellness rows for one athlete (oldest first). */
function buildHistory(
  athleteId: string,
  days: number,
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null,
  source: Activity["source"],
  wellness?: WellnessCurve,
): {
  activities: Prisma.ActivityCreateManyInput[];
  sessionReports: Prisma.SessionReportCreateManyInput[];
  wellnessCheckins: Prisma.WellnessCheckinCreateManyInput[];
} {
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const sessionReports: Prisma.SessionReportCreateManyInput[] = [];
  const wellnessCheckins: Prisma.WellnessCheckinCreateManyInput[] = [];

  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
    const relativeDay = days - 1 - dayIndex;
    const session = curve(relativeDay);
    if (!session) continue;

    const activityId = newId("act");
    const startedAt = daysAgoDate(dayIndex);
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
      startedAt,
      durationMin: session.durationMin,
      distanceKm: Math.round(session.durationMin * 0.19 * 10) / 10,
      avgHr: 140 + Math.round(session.rpe * 3),
      ...(hrZones ? { hrZones } : {}),
    });
    sessionReports.push({
      id: newId("sr"),
      athleteId,
      activityId,
      rpe: session.rpe,
      createdAt: startedAt,
    });
    if (wellness) {
      wellnessCheckins.push({
        id: newId("wc"),
        athleteId,
        date: startedAt,
        ...wellness(relativeDay),
      });
    }
  }
  return { activities, sessionReports, wellnessCheckins };
}

function buildAthleteSeed(opts: {
  orgId: string;
  coachId: string;
  name: string;
  email: string;
  sports: Sport[];
  birthDate: string;
  sex: Sex;
  hasWearable: boolean;
  curve: (dayIndex: number) => { rpe: number; durationMin: number } | null;
  wellness?: WellnessCurve;
  source: Activity["source"];
}): {
  athlete: Prisma.AthleteCreateManyInput;
  activities: Prisma.ActivityCreateManyInput[];
  sessionReports: Prisma.SessionReportCreateManyInput[];
  wellnessCheckins: Prisma.WellnessCheckinCreateManyInput[];
} {
  const athleteId = newId("ath");
  const athlete: Prisma.AthleteCreateManyInput = {
    id: athleteId,
    orgId: opts.orgId,
    coachId: opts.coachId,
    name: opts.name,
    email: opts.email,
    sports: opts.sports,
    birthDate: new Date(opts.birthDate),
    sex: opts.sex,
    hasWearable: opts.hasWearable,
    // Seeded athletes start ACTIVE (with a demo password — see README) so
    // the demo roster is reachable through the same real login as any
    // account created via signup + invite.
    status: "ACTIVE",
    passwordHash: DEMO_PASSWORD_HASH,
  };
  const history = buildHistory(athleteId, 40, opts.curve, opts.source, opts.wellness);
  return { athlete, ...history };
}

async function seed(): Promise<void> {
  const orgId = newId("org");
  const coachId = newId("coach");

  const athletes: Prisma.AthleteCreateManyInput[] = [];
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const sessionReports: Prisma.SessionReportCreateManyInput[] = [];
  const wellnessCheckins: Prisma.WellnessCheckinCreateManyInput[] = [];
  const painReports: Prisma.PainReportCreateManyInput[] = [];

  function addAthlete(opts: Parameters<typeof buildAthleteSeed>[0]): string {
    const built = buildAthleteSeed(opts);
    athletes.push(built.athlete);
    activities.push(...built.activities);
    sessionReports.push(...built.sessionReports);
    wellnessCheckins.push(...built.wellnessCheckins);
    return built.athlete.id as string;
  }

  // Steady, well-managed load → IDEAL. Wellness matches: consistently good.
  addAthlete({
    orgId,
    coachId,
    name: "Marina Alves",
    email: "marina.alves@atleta.com",
    sports: ["RUNNING"],
    birthDate: "1996-03-14",
    sex: "FEMALE",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5 + (d % 3), durationMin: 35 + (d % 4) * 5 } : null),
    wellness: (d) => ({
      sleep: 4 + (d % 2),
      soreness: 1 + (d % 2),
      mood: 5 - (d % 2),
      stress: 1 + (d % 2),
      hydration: 4,
    }),
  });

  addAthlete({
    orgId,
    coachId,
    name: "Diego Ferreira",
    email: "diego.ferreira@atleta.com",
    sports: ["RUNNING", "CYCLING"], // multi-sport: trains both, no dedicated triathlon block
    birthDate: "1993-11-02",
    sex: "MALE",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 1 ? { rpe: 4 + (d % 4), durationMin: 40 + (d % 5) * 4 } : null),
    wellness: (d) => ({
      sleep: 4,
      soreness: 2 + (d % 2),
      mood: 4,
      stress: 1 + (d % 2),
      hydration: 3 + (d % 2),
    }),
  });

  // Sharp spike in the last 7 days → RISK. Wellness degrades right along with it:
  // sleep and mood drop, soreness and stress climb once the heavy block starts.
  const camilaId = addAthlete({
    orgId,
    coachId,
    name: "Camila Souza",
    email: "camila.souza@atleta.com",
    sports: ["RUNNING"],
    birthDate: "1999-07-22",
    sex: "FEMALE",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => {
      if (d >= 33) return { rpe: 6 + (d % 3), durationMin: 55 + (d % 3) * 6 }; // last 7 days: heavy
      return d % 2 === 0 ? { rpe: 5, durationMin: 32 } : null;
    },
    wellness: (d) =>
      d >= 33
        ? { sleep: 2, soreness: 5, mood: 2, stress: 4 + (d % 2), hydration: 2 }
        : { sleep: 4, soreness: 2, mood: 4, stress: 2, hydration: 4 },
  });
  // Pain reports so the coach's pain-map review isn't empty on first load —
  // consistent with her heavy last-7-days block above.
  painReports.push(
    { id: newId("pr"), athleteId: camilaId, bodyPart: "KNEE_R", intensity: 6, note: "Dói ao descer escadas." },
    { id: newId("pr"), athleteId: camilaId, bodyPart: "LOWER_BACK", intensity: 4 },
  );

  // Trending up but not yet critical → ATTENTION. Wellness slides down the same ramp.
  addAthlete({
    orgId,
    coachId,
    name: "Bruno Castro",
    email: "bruno.castro@atleta.com",
    sports: ["CYCLING"],
    birthDate: "1990-01-30",
    sex: "MALE",
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
        hydration: Math.max(2, Math.round(4 - ramp * 2)),
      };
    },
  });

  addAthlete({
    orgId,
    coachId,
    name: "Ana Paula Lima",
    email: "ana.lima@atleta.com",
    sports: ["RUNNING"],
    birthDate: "1988-09-05",
    sex: "FEMALE",
    hasWearable: true,
    source: "STRAVA",
    curve: (d) => (d % 2 === 0 ? { rpe: 5, durationMin: 38 } : null),
    wellness: () => ({ sleep: 4, soreness: 2, mood: 4, stress: 2, hydration: 4 }),
  });

  // No wearable at all — logs manually, and hasn't in a few days (stale sync).
  // Wellness is a bit more tired overall: sparser, harder sessions with less recovery in between.
  addAthlete({
    orgId,
    coachId,
    name: "Thiago Nunes",
    email: "thiago.nunes@atleta.com",
    sports: ["TRIATHLON"],
    birthDate: "2001-05-18",
    sex: "MALE",
    hasWearable: false,
    source: "MANUAL",
    curve: (d) => {
      if (d >= 35) return null; // nothing logged in the last ~5 days
      return d % 3 === 0 ? { rpe: 6, durationMin: 45 } : null;
    },
    wellness: () => ({ sleep: 3, soreness: 3, mood: 3, stress: 3, hydration: 3 }),
  });

  await prisma.$transaction([
    prisma.org.create({ data: { id: orgId, name: "Fundo BH" } }),
    prisma.coach.create({
      data: { id: coachId, orgId, name: "Rafael Mendes", email: DEMO_COACH_EMAIL, passwordHash: DEMO_PASSWORD_HASH },
    }),
    prisma.athlete.createMany({ data: athletes }),
    prisma.activity.createMany({ data: activities }),
    prisma.sessionReport.createMany({ data: sessionReports }),
    prisma.wellnessCheckin.createMany({ data: wellnessCheckins }),
    prisma.painReport.createMany({ data: painReports }),
  ]);
}

// A starter set of common injury-prevention exercises, so the library and
// the prescription flow have something real to show/test with from the
// first deploy. Fixed ids (not newId()'s random ones) + `skipDuplicates`
// make seeding this safe to attempt from more than one racing process —
// unlike the demo coach/roster, there's no unique column to lean on here
// (a coach can legitimately add their own exercise with any name), so
// idempotency comes from the id instead. No videoUrl: this app doesn't
// invent video links (see the Exercise model's own doc comment) — a coach
// adds their own trusted link per exercise, or edits these later to add one.
const CURATED_EXERCISES: Prisma.ExerciseCreateManyInput[] = [
  {
    id: "ex_curated_corrida_leve",
    name: "Corrida leve",
    category: "WARM_UP",
    instructions: "5–10 min de trote leve para elevar a temperatura corporal antes do treino.",
  },
  {
    id: "ex_curated_skipping_baixo",
    name: "Skipping baixo",
    category: "WARM_UP",
    instructions: "Elevação de joelhos em ritmo baixo, 2x20m.",
  },
  {
    id: "ex_curated_educativo_calcanhar_gluteo",
    name: "Educativo de calcanhar-glúteo",
    category: "WARM_UP",
    instructions: "Corrida educativa levando o calcanhar em direção ao glúteo, 2x20m.",
  },
  {
    id: "ex_curated_prancha_frontal",
    name: "Prancha frontal",
    category: "STRENGTHENING",
    instructions: "Isometria de core mantendo o corpo alinhado, 3x30s.",
  },
  {
    id: "ex_curated_ponte_de_gluteo",
    name: "Ponte de glúteo",
    category: "STRENGTHENING",
    instructions: "Elevação de quadril deitado, ativando o glúteo, 3x15 repetições.",
  },
  {
    id: "ex_curated_afundo_unilateral",
    name: "Agachamento unilateral (afundo)",
    category: "STRENGTHENING",
    instructions: "Afundo controlado, 3x10 repetições de cada lado — foco em estabilidade de joelho e quadril.",
  },
  {
    id: "ex_curated_elevacao_panturrilha",
    name: "Elevação de panturrilha",
    category: "STRENGTHENING",
    instructions: "Elevação nas pontas dos pés, 3x15 repetições — prevenção de lesões de tendão de Aquiles.",
  },
  {
    id: "ex_curated_copenhagen",
    name: "Copenhagen (adução de quadril)",
    category: "STRENGTHENING",
    instructions: "Exercício excêntrico de adutores, 3x10 de cada lado — prevenção de lesão de virilha.",
  },
  {
    id: "ex_curated_nordic_hamstring",
    name: "Nordic hamstring",
    category: "STRENGTHENING",
    instructions: "Exercício excêntrico de isquiotibiais, 3x6 repetições — prevenção de lesão posterior de coxa.",
  },
  {
    id: "ex_curated_mobilidade_tornozelo",
    name: "Mobilidade de tornozelo",
    category: "MOBILITY",
    instructions: "Círculos de tornozelo, 2x10 repetições de cada lado.",
  },
  {
    id: "ex_curated_mobilidade_quadril_90_90",
    name: "Mobilidade de quadril 90/90",
    category: "MOBILITY",
    instructions: "Transição entre apoios com quadril e joelho a 90°, 2x8 de cada lado.",
  },
  {
    id: "ex_curated_rotacao_toracica",
    name: "Rotação torácica em quadrupedia",
    category: "MOBILITY",
    instructions: "Rotação de tronco apoiado em quatro apoios, 2x10 de cada lado.",
  },
];

async function ensureExerciseLibrarySeeded(): Promise<void> {
  const count = await prisma.exercise.count();
  if (count > 0) return;
  await prisma.exercise.createMany({ data: CURATED_EXERCISES, skipDuplicates: true });
}

/**
 * Runs `seed()` once per database, ever — not once per process. Checks for
 * the demo coach by email first; if two requests race on a cold start and
 * both find nothing, the loser's `coach.create` (unique email) throws
 * P2002, which is treated as "someone else already seeded" rather than an
 * error. The exercise library is seeded independently of the demo
 * coach/roster — it's a global, not per-org, catalog, so it needs to exist
 * even for a coach who signed up before this feature shipped.
 */
async function ensureSeeded(): Promise<void> {
  const existing = await prisma.coach.findUnique({ where: { email: DEMO_COACH_EMAIL } });
  if (!existing) {
    try {
      await seed();
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
  await ensureExerciseLibrarySeeded();
}

/**
 * Memoized on `globalThis` like the Prisma client itself, so every layer
 * checks at most once per warm process — except a *failed* attempt (e.g.
 * the database was briefly unreachable) clears itself so the next caller
 * retries instead of every future request failing forever off one bad check.
 */
function getSeeded(): Promise<void> {
  if (!globalForCarga.__cargaSeeded) {
    globalForCarga.__cargaSeeded = ensureSeeded().catch((err) => {
      globalForCarga.__cargaSeeded = undefined;
      throw err;
    });
  }
  return globalForCarga.__cargaSeeded;
}

// ---- Auth: coaches, accounts, sessions ---------------------------------

export async function getOrg(orgId: string): Promise<Org | undefined> {
  await getSeeded();
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  return org ? { id: org.id, name: org.name } : undefined;
}

export async function getCoach(coachId: string): Promise<Coach | undefined> {
  await getSeeded();
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  return coach ? toCoach(coach) : undefined;
}

export async function findCoachByEmail(email: string): Promise<Coach | undefined> {
  await getSeeded();
  const coach = await prisma.coach.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  return coach ? toCoach(coach) : undefined;
}

export async function findAthleteByEmail(email: string): Promise<Athlete | undefined> {
  await getSeeded();
  const athlete = await prisma.athlete.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  return athlete ? toAthlete(athlete) : undefined;
}

/** True if any coach or athlete already uses this email — invites and signup both check this. */
export async function isEmailTaken(email: string): Promise<boolean> {
  const [coach, athlete] = await Promise.all([findCoachByEmail(email), findAthleteByEmail(email)]);
  return Boolean(coach || athlete);
}

/**
 * Coach self-signup: creates a brand-new Org and Coach together (there's no
 * "join an existing org" flow yet — every coach who signs up starts their
 * own, empty roster, and invites athletes into it from there).
 */
export async function createCoachAccount(input: {
  orgName: string;
  name: string;
  email: string;
  passwordHash: string;
}): Promise<Coach> {
  await getSeeded();
  const org = await prisma.org.create({ data: { id: newId("org"), name: input.orgName } });
  const coach = await prisma.coach.create({
    data: { id: newId("coach"), orgId: org.id, name: input.name, email: input.email, passwordHash: input.passwordHash },
  });
  return toCoach(coach);
}

/**
 * Creates the invited athlete's record up front, in INVITED status — there
 * is no separate "invite" entity; the Athlete row itself carries the
 * pending token until accepted (or revoked). This mirrors the flat style
 * of the rest of this file more than a fully normalized invites table
 * would, at the cost of losing history for revoked/expired invites.
 */
export async function createAthleteInvite(input: {
  orgId: string;
  coachId: string;
  name: string;
  email: string;
  sports: Sport[];
}): Promise<Athlete> {
  await getSeeded();
  const athlete = await prisma.athlete.create({
    data: {
      id: newId("ath"),
      orgId: input.orgId,
      coachId: input.coachId,
      name: input.name,
      email: input.email,
      sports: input.sports,
      status: "INVITED",
      inviteToken: generateInviteToken(),
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return toAthlete(athlete);
}

/** Invites this coach has sent that are still awaiting acceptance. */
export async function getPendingInvites(coachId: string): Promise<Athlete[]> {
  await getSeeded();
  const rows = await prisma.athlete.findMany({ where: { coachId, status: "INVITED" } });
  return rows.map(toAthlete);
}

/** Cancels a pending invite. Only the inviting coach can revoke it; a no-op otherwise. */
export async function revokeInvite(athleteId: string, coachId: string): Promise<boolean> {
  await getSeeded();
  const result = await prisma.athlete.deleteMany({ where: { id: athleteId, coachId, status: "INVITED" } });
  return result.count > 0;
}

/** Looks up a pending, unexpired invite by its token — used by the public accept-invite page. */
export async function getAthleteByInviteToken(token: string): Promise<Athlete | undefined> {
  await getSeeded();
  const athlete = await prisma.athlete.findFirst({
    where: { inviteToken: token, status: "INVITED", inviteExpiresAt: { gt: new Date() } },
  });
  return athlete ? toAthlete(athlete) : undefined;
}

/** Activates an invited athlete's account with the password and profile info they just set. */
export async function acceptAthleteInvite(input: {
  token: string;
  passwordHash: string;
  birthDate: string;
  sex: Sex;
}): Promise<Athlete> {
  await getSeeded();
  const existing = await getAthleteByInviteToken(input.token);
  if (!existing) throw new Error("convite inválido ou expirado");
  const athlete = await prisma.athlete.update({
    where: { id: existing.id },
    data: {
      status: "ACTIVE",
      passwordHash: input.passwordHash,
      birthDate: new Date(input.birthDate),
      sex: input.sex,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });
  return toAthlete(athlete);
}

// ---- Read API (roster, athlete detail) --------------------------------

export async function getAthlete(athleteId: string): Promise<Athlete | undefined> {
  await getSeeded();
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  return athlete ? toAthlete(athlete) : undefined;
}

export async function getAthleteActivities(athleteId: string): Promise<Activity[]> {
  await getSeeded();
  const rows = await prisma.activity.findMany({
    where: { athleteId },
    include: { sessionReport: true },
    orderBy: { startedAt: "desc" },
  });
  return rows.map((a) => toActivity(a, a.sessionReport != null));
}

export async function getLatestUnreportedActivity(athleteId: string): Promise<Activity | undefined> {
  await getSeeded();
  const row = await prisma.activity.findFirst({
    where: { athleteId, sessionReport: { is: null } },
    orderBy: { startedAt: "desc" },
  });
  return row ? toActivity(row, false) : undefined;
}

export interface ActivityFeedItem extends Activity {
  /** RPE from the linked session report, once the athlete has checked in. */
  rpe: number | null;
}

/** Recent activities for an athlete, most recent first, joined with their RPE if reported. */
export async function getAthleteActivityFeed(athleteId: string, limit = 10): Promise<ActivityFeedItem[]> {
  await getSeeded();
  const rows = await prisma.activity.findMany({
    where: { athleteId },
    include: { sessionReport: true },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return rows.map((a) => ({ ...toActivity(a, a.sessionReport != null), rpe: a.sessionReport?.rpe ?? null }));
}

export interface ExportRow {
  date: string;
  source: Activity["source"];
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
  rpe: number | null;
  internalLoad: number | null;
  externalLoad: number | null;
  combinedLoad: number | null;
}

/** An athlete's full activity + load history, oldest first — the CSV/PDF export's source data. */
export async function getAthleteExportRows(athleteId: string): Promise<ExportRow[]> {
  await getSeeded();
  const rows = await prisma.activity.findMany({
    where: { athleteId },
    include: { sessionReport: true },
    orderBy: { startedAt: "asc" },
  });
  return rows.map((activity) => {
    const rpe = activity.sessionReport?.rpe ?? null;
    const hrZones = activity.hrZones as HrZoneMinutes | null;
    const external = hrZones ? externalLoadFromHrZones(hrZones) : null;
    const internal = rpe != null ? internalLoad(rpe, activity.durationMin) : null;
    return {
      date: activity.startedAt.toISOString(),
      source: activity.source,
      durationMin: activity.durationMin,
      distanceKm: activity.distanceKm ?? null,
      avgHr: activity.avgHr ?? null,
      rpe,
      internalLoad: internal,
      externalLoad: external,
      combinedLoad: internal != null ? combinedLoad(internal, external ?? undefined) : null,
    };
  });
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Wider than ewmaAcwr's 28-day chronic window so a full chronic window is
// always available once an athlete has that much real history; padded with
// zeros (rest days) for anyone newer than that, same as the old in-memory
// seed did for its first days.
const LOAD_SERIES_DAYS = 35;

/**
 * Daily combined load, oldest first, one entry per calendar day (0 for rest
 * days), for the last `days` days up to and including today. Computed
 * fresh from Activity + SessionReport every call — see the module doc
 * comment for why there's no stored running total anymore.
 */
async function getDailyLoadsSeries(athleteId: string, days: number): Promise<number[]> {
  const since = daysAgoDate(days - 1);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.activity.findMany({
    where: { athleteId, startedAt: { gte: since } },
    include: { sessionReport: true },
  });

  const byDay = new Map<string, number>();
  for (const activity of rows) {
    if (!activity.sessionReport) continue; // unreported activities carry no RPE yet — no load to add
    const internal = internalLoad(activity.sessionReport.rpe, activity.durationMin);
    const hrZones = activity.hrZones as HrZoneMinutes | null;
    const external = hrZones ? externalLoadFromHrZones(hrZones) : undefined;
    const key = dayKey(activity.startedAt);
    byDay.set(key, (byDay.get(key) ?? 0) + combinedLoad(internal, external));
  }

  const series: number[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < days; i++) {
    series.push(byDay.get(dayKey(cursor)) ?? 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

export async function getAthleteLoadSummary(athleteId: string): Promise<AthleteLoadSummary> {
  await getSeeded();
  const athlete = await getAthlete(athleteId);
  if (!athlete) throw new Error(`unknown athlete ${athleteId}`);

  const [loads, latestActivity] = await Promise.all([
    getDailyLoadsSeries(athleteId, LOAD_SERIES_DAYS),
    prisma.activity.findFirst({ where: { athleteId }, orderBy: { startedAt: "desc" } }),
  ]);
  const acwr = ewmaAcwr(loads);
  const last7 = loads.slice(-7);
  // Foster monotony/strain are computed over the same 7-day window as
  // weeklyLoad, and both need at least one non-zero day to be meaningful.
  const hasRecentLoad = last7.some((l) => l > 0);
  return {
    athleteId,
    name: athlete.name,
    sports: athlete.sports,
    acwr,
    zone: acwr == null ? null : classifyAcwr(acwr),
    weeklyLoad: Math.round(last7.reduce((a, b) => a + b, 0)),
    last7Days: last7,
    monotony: hasRecentLoad ? monotony(last7) : null,
    strain: hasRecentLoad ? strain(last7) : null,
    lastSyncedAt: latestActivity ? latestActivity.startedAt.toISOString() : null,
    hasWearable: athlete.hasWearable,
  };
}

/** Active athletes on this coach's roster. Pending invites are listed separately — see getPendingInvites. */
export async function getRoster(coachId: string): Promise<AthleteLoadSummary[]> {
  await getSeeded();
  const rows = await prisma.athlete.findMany({ where: { coachId, status: "ACTIVE" } });
  return Promise.all(rows.map((a) => getAthleteLoadSummary(a.id)));
}

export async function getWellnessHistory(athleteId: string, days = 7): Promise<WellnessCheckin[]> {
  await getSeeded();
  const rows = await prisma.wellnessCheckin.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: days,
  });
  return rows.map(toWellnessCheckin);
}

// ---- Write API (check-in flow, manual entry) ---------------------------

export async function addManualActivity(input: {
  athleteId: string;
  durationMin: number;
  distanceKm?: number;
  startedAt?: string;
}): Promise<Activity> {
  await getSeeded();
  const activity = await prisma.activity.create({
    data: {
      id: newId("act"),
      athleteId: input.athleteId,
      source: "MANUAL",
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      durationMin: input.durationMin,
      distanceKm: input.distanceKm,
    },
  });
  return toActivity(activity, false);
}

export async function submitCheckin(input: {
  athleteId: string;
  activityId: string;
  rpe: number;
  sleep: number;
  soreness: number;
  mood: number;
  stress: number;
  hydration: number;
}): Promise<{ sessionReport: SessionReport; wellnessCheckin: WellnessCheckin }> {
  await getSeeded();
  const activity = await prisma.activity.findUnique({ where: { id: input.activityId } });
  if (!activity || activity.athleteId !== input.athleteId) {
    throw new Error("activity not found for this athlete");
  }

  const [sessionReport, wellnessCheckin] = await prisma.$transaction([
    prisma.sessionReport.create({
      data: { id: newId("sr"), athleteId: input.athleteId, activityId: input.activityId, rpe: input.rpe },
    }),
    prisma.wellnessCheckin.create({
      data: {
        id: newId("wc"),
        athleteId: input.athleteId,
        sleep: input.sleep,
        soreness: input.soreness,
        mood: input.mood,
        stress: input.stress,
        hydration: input.hydration,
      },
    }),
  ]);

  return { sessionReport: toSessionReport(sessionReport), wellnessCheckin: toWellnessCheckin(wellnessCheckin) };
}

export async function addPainReport(input: {
  athleteId: string;
  bodyPart: BodyPart;
  intensity: number;
  note?: string;
}): Promise<PainReport> {
  await getSeeded();
  const report = await prisma.painReport.create({
    data: {
      id: newId("pr"),
      athleteId: input.athleteId,
      bodyPart: input.bodyPart,
      intensity: input.intensity,
      note: input.note,
    },
  });
  return toPainReport(report);
}

/** An athlete's own pain reports, most recent first. */
export async function getAthletePainReports(athleteId: string, limit = 10): Promise<PainReport[]> {
  await getSeeded();
  const rows = await prisma.painReport.findMany({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toPainReport);
}

export interface RosterPainReport extends PainReport {
  athleteName: string;
}

/** Pain reports across a coach's whole roster, most recent first — the "pain map review". */
export async function getPainReportsForCoach(coachId: string, limit = 20): Promise<RosterPainReport[]> {
  await getSeeded();
  const rows = await prisma.painReport.findMany({
    where: { athlete: { coachId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { athlete: { select: { name: true } } },
  });
  return rows.map((p) => ({ ...toPainReport(p), athleteName: p.athlete.name }));
}

// Cycle logs are personal health data an athlete tracks for themselves —
// unlike pain reports, there's deliberately no coach-facing rollup of these.

export async function addCycleLog(input: {
  athleteId: string;
  date?: string;
  flow: CycleLog["flow"];
  symptoms: CycleLog["symptoms"];
  phase: CycleLog["phase"];
}): Promise<CycleLog> {
  await getSeeded();
  const log = await prisma.cycleLog.create({
    data: {
      id: newId("cl"),
      athleteId: input.athleteId,
      date: input.date ? new Date(input.date) : new Date(),
      flow: input.flow,
      symptoms: input.symptoms,
      phase: input.phase,
    },
  });
  return toCycleLog(log);
}

/** An athlete's own cycle logs, most recent first. */
export async function getAthleteCycleLogs(athleteId: string, limit = 10): Promise<CycleLog[]> {
  await getSeeded();
  const rows = await prisma.cycleLog.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map(toCycleLog);
}

// ---- Assessments (physio-style intake/reassessment records) -----------
// Recorded by the professional (coach today — there's no separate physio
// login yet, see prisma/schema.prisma's Role enum), not self-reported by
// the athlete, so these always require getSessionCoach()-style
// authorization at the route level, same as invites/roster.

export async function addAssessment(input: {
  athleteId: string;
  coachId: string;
  kind: AssessmentKind;
  date?: string;
  examsNote?: string;
  medicationsNote?: string;
  generalNote?: string;
  measurements: Array<{
    category: MeasurementCategory;
    label: string;
    value?: number | null;
    unit?: string | null;
    note?: string;
  }>;
}): Promise<Assessment> {
  await getSeeded();
  const assessment = await prisma.assessment.create({
    data: {
      id: newId("asmt"),
      athleteId: input.athleteId,
      coachId: input.coachId,
      kind: input.kind,
      date: input.date ? new Date(input.date) : new Date(),
      examsNote: input.examsNote,
      medicationsNote: input.medicationsNote,
      generalNote: input.generalNote,
      measurements: {
        create: input.measurements.map((m) => ({
          id: newId("meas"),
          category: m.category,
          label: m.label,
          value: m.value ?? null,
          unit: m.unit ?? null,
          note: m.note,
        })),
      },
    },
    include: { measurements: true },
  });
  return toAssessment(assessment);
}

/** An athlete's assessments (initial + follow-ups), most recent first. */
export async function getAthleteAssessments(athleteId: string, limit = 20): Promise<Assessment[]> {
  await getSeeded();
  const rows = await prisma.assessment.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: limit,
    include: { measurements: true },
  });
  return rows.map(toAssessment);
}

// ---- Exercise library, prescriptions & completions ---------------------
// Feedback from a physiotherapist in the field: "controle de carga no
// mesmo app de exercícios de aquecimento ou fortalecimento específico,
// preventivo". The library is global (not per-Org) — exercise content
// itself isn't client-specific — but prescriptions are always scoped to
// one athlete + the coach who prescribed them.

/** The shared exercise library, grouped by category then name. */
export async function getExerciseLibrary(): Promise<Exercise[]> {
  await getSeeded();
  const rows = await prisma.exercise.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return rows.map(toExercise);
}

/** Adds a coach-authored entry to the shared library — never a fabricated video URL, only what the coach pastes in. */
export async function addExercise(input: {
  name: string;
  category: ExerciseCategory;
  instructions?: string;
  videoUrl?: string;
}): Promise<Exercise> {
  await getSeeded();
  const exercise = await prisma.exercise.create({
    data: {
      id: newId("ex"),
      name: input.name,
      category: input.category,
      instructions: input.instructions,
      videoUrl: input.videoUrl,
    },
  });
  return toExercise(exercise);
}

export async function prescribeExercise(input: {
  athleteId: string;
  coachId: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  frequency?: string;
  notes?: string;
}): Promise<ExercisePrescription> {
  await getSeeded();
  const prescription = await prisma.exercisePrescription.create({
    data: {
      id: newId("rx"),
      athleteId: input.athleteId,
      coachId: input.coachId,
      exerciseId: input.exerciseId,
      sets: input.sets ?? null,
      reps: input.reps ?? null,
      frequency: input.frequency,
      notes: input.notes,
    },
    include: { exercise: true },
  });
  // Just created: no completions exist for it yet.
  return toExercisePrescription(prescription, false, 0);
}

/**
 * An athlete's prescriptions, joined with the exercise and a 7-day
 * adherence signal (`doneToday`, `completedLast7Days`) computed fresh from
 * ExerciseCompletion — same "recompute on read, never store a running
 * total" approach as the load summary elsewhere in this file.
 */
export async function getAthletePrescriptions(athleteId: string, activeOnly = true): Promise<ExercisePrescription[]> {
  await getSeeded();
  const prescriptions = await prisma.exercisePrescription.findMany({
    where: activeOnly ? { athleteId, active: true } : { athleteId },
    include: { exercise: true },
    orderBy: { createdAt: "asc" },
  });
  if (prescriptions.length === 0) return [];

  const since = daysAgoDate(6); // today + 6 days back = last 7 calendar days
  since.setUTCHours(0, 0, 0, 0);
  const completions = await prisma.exerciseCompletion.findMany({
    where: { prescriptionId: { in: prescriptions.map((p) => p.id) }, date: { gte: since } },
  });
  const todayKey = dayKey(daysAgoDate(0));
  const daysByPrescription = new Map<string, Set<string>>();
  for (const c of completions) {
    const set = daysByPrescription.get(c.prescriptionId) ?? new Set<string>();
    set.add(dayKey(c.date));
    daysByPrescription.set(c.prescriptionId, set);
  }

  return prescriptions.map((p) => {
    const days = daysByPrescription.get(p.id) ?? new Set<string>();
    return toExercisePrescription(p, days.has(todayKey), days.size);
  });
}

/** Coach-only: stops a prescription from showing up as active for the athlete. Only the prescribing coach can. */
export async function deactivatePrescription(prescriptionId: string, coachId: string): Promise<boolean> {
  await getSeeded();
  const result = await prisma.exercisePrescription.updateMany({
    where: { id: prescriptionId, coachId },
    data: { active: false },
  });
  return result.count > 0;
}

/** Athlete-only: toggles today's "done" mark for one of their own prescriptions. */
export async function setExerciseCompletion(input: {
  prescriptionId: string;
  athleteId: string;
  done: boolean;
}): Promise<void> {
  await getSeeded();
  const prescription = await prisma.exercisePrescription.findUnique({ where: { id: input.prescriptionId } });
  if (!prescription || prescription.athleteId !== input.athleteId) {
    throw new Error("prescription not found for this athlete");
  }
  const today = daysAgoDate(0);
  if (input.done) {
    await prisma.exerciseCompletion.upsert({
      where: { prescriptionId_date: { prescriptionId: input.prescriptionId, date: today } },
      create: { id: newId("exc"), prescriptionId: input.prescriptionId, date: today },
      update: {},
    });
  } else {
    await prisma.exerciseCompletion.deleteMany({ where: { prescriptionId: input.prescriptionId, date: today } });
  }
}
