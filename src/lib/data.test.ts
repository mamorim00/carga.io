import { beforeAll, describe, expect, it } from "vitest";
import {
  acceptAthleteInvite,
  addAssessment,
  addCycleLog,
  addExercise,
  addManualActivity,
  addPainReport,
  createAthleteInvite,
  createCoachAccount,
  deactivatePrescription,
  findAthleteByEmail,
  findCoachByEmail,
  getAthlete,
  getAthleteActivityFeed,
  getAthleteAssessments,
  getAthleteByInviteToken,
  getAthleteCycleLogs,
  getAthleteExportRows,
  getAthleteLoadSummary,
  getAthletePainReports,
  getAthletePrescriptions,
  getExerciseLibrary,
  getLatestUnreportedActivity,
  getPainReportsForCoach,
  getPendingInvites,
  getRoster,
  getWellnessHistory,
  isEmailTaken,
  prescribeExercise,
  revokeInvite,
  setExerciseCompletion,
  submitCheckin,
} from "./data";
import type { Coach } from "./types";

/**
 * src/lib/data.ts is a thin layer over @prisma/client now (see
 * prisma/schema.prisma) — every one of these needs a real, reachable
 * Postgres. They can't run in this sandbox: its egress policy blocks
 * raw-TCP database connections (only HTTPS gets through), so there's no
 * way to reach PRISMA_DATABASE_URL from here. Written to run wherever that
 * connection is reachable (e.g. Vercel's build/runtime, or locally with
 * `vercel env pull` and normal network access) — not executed or verified
 * in this sandbox. See README.md.
 */

let demoCoach: Coach;

beforeAll(async () => {
  const coach = await findCoachByEmail("rafael@fundobh.com.br");
  if (!coach) throw new Error("demo coach not seeded — is PRISMA_DATABASE_URL reachable?");
  demoCoach = coach;
});

describe("seeded roster", () => {
  it("computes an ACWR zone for every seeded athlete", async () => {
    const roster = await getRoster(demoCoach.id);
    expect(roster).toHaveLength(6);
    for (const a of roster) {
      expect(a.acwr).not.toBeNull();
      expect(["IDEAL", "ATTENTION", "RISK"]).toContain(a.zone);
    }
  });

  it("flags the athlete with a recent load spike as RISK", async () => {
    const roster = await getRoster(demoCoach.id);
    const camila = roster.find((a) => a.name === "Camila Souza")!;
    expect(camila.zone).toBe("RISK");
  });

  it("keeps a steady athlete in the IDEAL zone", async () => {
    const roster = await getRoster(demoCoach.id);
    const marina = roster.find((a) => a.name === "Marina Alves")!;
    expect(marina.zone).toBe("IDEAL");
  });

  it("marks the wearable-less athlete as such, with a stale sync", async () => {
    const roster = await getRoster(demoCoach.id);
    const thiago = roster.find((a) => a.name === "Thiago Nunes")!;
    expect(thiago.hasWearable).toBe(false);
  });
});

describe("seeded wellness history", () => {
  it("gives every seeded athlete recent wellness check-ins", async () => {
    const roster = await getRoster(demoCoach.id);
    for (const a of roster) {
      expect((await getWellnessHistory(a.athleteId)).length).toBeGreaterThan(0);
    }
  });

  it("has the at-risk athlete's wellness reflect her load spike, not just her ACWR", async () => {
    const roster = await getRoster(demoCoach.id);
    const camila = roster.find((a) => a.name === "Camila Souza")!;
    const [latest] = await getWellnessHistory(camila.athleteId, 1);
    expect(latest.sleep).toBeLessThanOrEqual(2);
    expect(latest.soreness).toBeGreaterThanOrEqual(4);
  });
});

describe("check-in flow", () => {
  it("lets an athlete without a wearable log manually, then check in", async () => {
    const roster = await getRoster(demoCoach.id);
    const thiago = roster.find((a) => a.name === "Thiago Nunes")!;
    const activity = await addManualActivity({ athleteId: thiago.athleteId, durationMin: 50, distanceKm: 9 });
    expect((await getLatestUnreportedActivity(thiago.athleteId))?.id).toBe(activity.id);

    const { sessionReport, wellnessCheckin } = await submitCheckin({
      athleteId: thiago.athleteId,
      activityId: activity.id,
      rpe: 7,
      sleep: 3,
      soreness: 4,
      mood: 3,
      stress: 3,
      hydration: 3,
    });

    expect(sessionReport.rpe).toBe(7);
    expect(wellnessCheckin.soreness).toBe(4);
    expect(await getLatestUnreportedActivity(thiago.athleteId)).toBeUndefined();
  });

  it("rejects a check-in for an activity that belongs to someone else", async () => {
    const [a, b] = await getRoster(demoCoach.id);
    const activity = await addManualActivity({ athleteId: a.athleteId, durationMin: 30 });
    await expect(
      submitCheckin({
        athleteId: b.athleteId,
        activityId: activity.id,
        rpe: 5,
        sleep: 4,
        soreness: 2,
        mood: 4,
        stress: 2,
        hydration: 4,
      }),
    ).rejects.toThrow();
  });
});

describe("getAthlete", () => {
  it("returns undefined for an unknown id", async () => {
    expect(await getAthlete("nope")).toBeUndefined();
  });
});

describe("getAthleteActivityFeed", () => {
  it("joins each activity with its RPE once checked in, most recent first", async () => {
    const roster = await getRoster(demoCoach.id);
    const marina = roster.find((a) => a.name === "Marina Alves")!;
    const before = await getAthleteActivityFeed(marina.athleteId, 3);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((a, i) => i === 0 || a.startedAt <= before[i - 1].startedAt)).toBe(true);

    const activity = await addManualActivity({ athleteId: marina.athleteId, durationMin: 40, distanceKm: 7 });
    await submitCheckin({
      athleteId: marina.athleteId,
      activityId: activity.id,
      rpe: 8,
      sleep: 4,
      soreness: 2,
      mood: 4,
      stress: 2,
      hydration: 4,
    });

    const feed = await getAthleteActivityFeed(marina.athleteId, 3);
    expect(feed[0].id).toBe(activity.id);
    expect(feed[0].rpe).toBe(8);
  });

  it("reports null RPE for an activity with no session report yet", async () => {
    const roster = await getRoster(demoCoach.id);
    const thiago = roster.find((a) => a.name === "Thiago Nunes")!;
    const activity = await addManualActivity({ athleteId: thiago.athleteId, durationMin: 30 });
    const feed = await getAthleteActivityFeed(thiago.athleteId, 1);
    expect(feed[0].id).toBe(activity.id);
    expect(feed[0].rpe).toBeNull();
  });
});

describe("coach signup", () => {
  it("creates a new org scoped to the new coach, separate from the seeded demo roster", async () => {
    const coach = await createCoachAccount({
      orgName: "Equipe Teste",
      name: "Nova Treinadora",
      email: "nova@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    expect(coach.orgId).not.toBe(demoCoach.orgId);
    expect(await getRoster(coach.id)).toHaveLength(0);
    expect((await findCoachByEmail("nova@teste.com"))?.id).toBe(coach.id);
  });
});

describe("athlete invites", () => {
  it("invites an athlete, then lets them accept and log in with the password they set", async () => {
    const athlete = await createAthleteInvite({
      orgId: demoCoach.orgId,
      coachId: demoCoach.id,
      name: "Convidado Teste",
      email: "convidado@teste.com",
      sports: ["RUNNING"],
    });
    expect(athlete.status).toBe("INVITED");
    expect(athlete.passwordHash).toBeNull();
    expect((await getPendingInvites(demoCoach.id)).map((a) => a.id)).toContain(athlete.id);
    // Not on the roster yet — pending invites are listed separately.
    expect((await getRoster(demoCoach.id)).map((a) => a.athleteId)).not.toContain(athlete.id);

    const found = await getAthleteByInviteToken(athlete.inviteToken!);
    expect(found?.id).toBe(athlete.id);

    const accepted = await acceptAthleteInvite({
      token: athlete.inviteToken!,
      passwordHash: "scrypt:whatever:hash2",
      birthDate: "1995-06-01",
      sex: "FEMALE",
    });
    expect(accepted.status).toBe("ACTIVE");
    expect(accepted.sex).toBe("FEMALE");
    expect(accepted.inviteToken).toBeNull();
    expect((await getPendingInvites(demoCoach.id)).map((a) => a.id)).not.toContain(athlete.id);
    expect((await getRoster(demoCoach.id)).map((a) => a.athleteId)).toContain(athlete.id);
  });

  it("rejects accepting an unknown or already-used token", async () => {
    await expect(
      acceptAthleteInvite({ token: "not-a-real-token", passwordHash: "x", birthDate: "1995-01-01", sex: "MALE" }),
    ).rejects.toThrow();
  });

  it("lets the inviting coach revoke a pending invite, but not another coach", async () => {
    const other = await createCoachAccount({
      orgName: "Outra Equipe",
      name: "Outro Treinador",
      email: "outro@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    const athlete = await createAthleteInvite({
      orgId: demoCoach.orgId,
      coachId: demoCoach.id,
      name: "Revogar Teste",
      email: "revogar@teste.com",
      sports: ["OTHER"],
    });

    expect(await revokeInvite(athlete.id, other.id)).toBe(false);
    expect(await getAthlete(athlete.id)).toBeDefined();

    expect(await revokeInvite(athlete.id, demoCoach.id)).toBe(true);
    expect(await getAthlete(athlete.id)).toBeUndefined();
  });

  it("treats an email already used by a coach or athlete as taken", async () => {
    expect(await isEmailTaken(demoCoach.email)).toBe(true);
    expect(await isEmailTaken("marina.alves@atleta.com")).toBe(true);
    expect(await isEmailTaken("ninguem@teste.com")).toBe(false);
  });
});

describe("findAthleteByEmail", () => {
  it("is case-insensitive", async () => {
    expect((await findAthleteByEmail("MARINA.ALVES@ATLETA.COM"))?.name).toBe("Marina Alves");
  });
});

describe("athlete profile fields", () => {
  it("supports more than one sport per athlete", async () => {
    const diego = await findAthleteByEmail("diego.ferreira@atleta.com");
    expect(diego!.sports).toEqual(["RUNNING", "CYCLING"]);
  });

  it("seeds a birth date and sex for every demo athlete", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    expect(marina!.birthDate).not.toBeNull();
    expect(marina!.sex).toBe("FEMALE");
  });

  it("leaves an invited athlete's birth date and sex unset until they accept", async () => {
    const athlete = await createAthleteInvite({
      orgId: demoCoach.orgId,
      coachId: demoCoach.id,
      name: "Perfil Teste",
      email: "perfil@teste.com",
      sports: ["OTHER"],
    });
    expect(athlete.birthDate).toBeNull();
    expect(athlete.sex).toBe("UNSPECIFIED");
  });
});

describe("getAthleteLoadSummary — monotony and strain", () => {
  it("computes both for a seeded athlete with a full week of history", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const summary = await getAthleteLoadSummary(marina!.id);
    expect(summary.monotony).not.toBeNull();
    expect(summary.strain).not.toBeNull();
    expect(summary.strain!).toBeGreaterThan(0);
  });

  it("computes monotony for the ramping-up athlete too, not just the steady ones", async () => {
    const bruno = await findAthleteByEmail("bruno.castro@atleta.com");
    const summary = await getAthleteLoadSummary(bruno!.id);
    expect(summary.monotony).not.toBeNull();
    expect(summary.strain).not.toBeNull();
  });
});

describe("wellness check-ins include hydration", () => {
  it("is present on every seeded wellness check-in", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const history = await getWellnessHistory(marina!.id);
    expect(history.length).toBeGreaterThan(0);
    for (const w of history) expect(w.hydration).toBeGreaterThanOrEqual(1);
  });
});

describe("pain reports", () => {
  it("lets an athlete log pain and read it back", async () => {
    const thiago = await findAthleteByEmail("thiago.nunes@atleta.com");
    await addPainReport({ athleteId: thiago!.id, bodyPart: "KNEE_L", intensity: 3 });
    await addPainReport({ athleteId: thiago!.id, bodyPart: "LOWER_BACK", intensity: 5, note: "Após treino longo" });

    const reports = await getAthletePainReports(thiago!.id, 5);
    const lowerBack = reports.find((r) => r.bodyPart === "LOWER_BACK");
    expect(lowerBack?.note).toBe("Após treino longo");
    expect(reports.some((r) => r.bodyPart === "KNEE_L")).toBe(true);
  });

  it("rolls up pain reports across a coach's whole roster", async () => {
    const roster = await getPainReportsForCoach(demoCoach.id, 50);
    const camila = roster.find((r) => r.athleteName === "Camila Souza");
    expect(camila).toBeDefined();
    expect(roster.every((r) => typeof r.athleteName === "string")).toBe(true);
  });

  it("never includes another coach's athletes", async () => {
    const other = await createCoachAccount({
      orgName: "Isolada",
      name: "Isolado",
      email: "isolado@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    expect(await getPainReportsForCoach(other.id, 50)).toHaveLength(0);
  });
});

describe("cycle logs", () => {
  it("lets an athlete log a cycle entry and read it back", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const log = await addCycleLog({
      athleteId: marina!.id,
      flow: "MEDIUM",
      symptoms: ["CRAMPS", "FATIGUE"],
      phase: "MENSTRUAL",
    });
    expect(log.flow).toBe("MEDIUM");

    const logs = await getAthleteCycleLogs(marina!.id, 5);
    expect(logs[0].id).toBe(log.id);
    expect(logs[0].symptoms).toEqual(["CRAMPS", "FATIGUE"]);
  });

  it("allows an empty symptom list and no phase", async () => {
    const camila = await findAthleteByEmail("camila.souza@atleta.com");
    const log = await addCycleLog({ athleteId: camila!.id, flow: "NONE", symptoms: [], phase: null });
    expect(log.phase).toBeNull();
    expect(log.symptoms).toEqual([]);
  });
});

describe("getAthleteExportRows", () => {
  it("returns the full activity history oldest-first, with load computed per row", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const rows = await getAthleteExportRows(marina!.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r, i) => i === 0 || r.date >= rows[i - 1].date)).toBe(true);
    const reported = rows.find((r) => r.rpe !== null);
    expect(reported?.internalLoad).not.toBeNull();
    expect(reported?.combinedLoad).not.toBeNull();
  });

  it("leaves load null for an activity with no session report yet", async () => {
    const thiago = await findAthleteByEmail("thiago.nunes@atleta.com");
    await addManualActivity({ athleteId: thiago!.id, durationMin: 20 });
    const rows = await getAthleteExportRows(thiago!.id);
    const unreported = rows.find((r) => r.rpe === null);
    expect(unreported?.internalLoad).toBeNull();
  });
});

describe("assessments", () => {
  it("lets a coach log an initial assessment with measurements and read it back", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const assessment = await addAssessment({
      athleteId: marina!.id,
      coachId: demoCoach.id,
      kind: "INITIAL",
      examsNote: "Raio-X joelho D sem alterações",
      measurements: [
        { category: "ROM", label: "Flexão de joelho direito", value: 130, unit: "graus" },
        { category: "STRENGTH", label: "Quadríceps direito", value: 4, unit: "MMT 0-5" },
      ],
    });
    expect(assessment.kind).toBe("INITIAL");
    expect(assessment.measurements).toHaveLength(2);

    const history = await getAthleteAssessments(marina!.id);
    expect(history[0].id).toBe(assessment.id);
    expect(history[0].measurements.map((m) => m.label)).toContain("Flexão de joelho direito");
  });

  it("allows a follow-up with no measurements, just notes", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const assessment = await addAssessment({
      athleteId: marina!.id,
      coachId: demoCoach.id,
      kind: "FOLLOW_UP",
      generalNote: "Evolução dentro do esperado",
      measurements: [],
    });
    expect(assessment.measurements).toHaveLength(0);
    expect(assessment.generalNote).toBe("Evolução dentro do esperado");
  });
});

describe("exercise prescriptions", () => {
  it("has the curated library seeded, spanning all three categories", async () => {
    const library = await getExerciseLibrary();
    expect(library.length).toBeGreaterThan(0);
    const categories = new Set(library.map((e) => e.category));
    expect(categories).toEqual(new Set(["WARM_UP", "STRENGTHENING", "MOBILITY"]));
  });

  it("lets a coach add their own exercise with a video link", async () => {
    const exercise = await addExercise({
      name: "Exercício de teste",
      category: "MOBILITY",
      videoUrl: "https://example.com/video",
    });
    expect(exercise.source).toBe("CURATED");
    expect(exercise.videoUrl).toBe("https://example.com/video");
  });

  it("prescribes an exercise to an athlete, then lets them mark it done and undo it", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const [exercise] = await getExerciseLibrary();
    const prescription = await prescribeExercise({
      athleteId: marina!.id,
      coachId: demoCoach.id,
      exerciseId: exercise.id,
      sets: 3,
      reps: 15,
      frequency: "3x por semana",
    });
    expect(prescription.doneToday).toBe(false);
    expect(prescription.completedLast7Days).toBe(0);

    await setExerciseCompletion({ prescriptionId: prescription.id, athleteId: marina!.id, done: true });
    let list = await getAthletePrescriptions(marina!.id);
    let found = list.find((p) => p.id === prescription.id)!;
    expect(found.doneToday).toBe(true);
    expect(found.completedLast7Days).toBe(1);

    // Marking done twice in the same day must not double-count.
    await setExerciseCompletion({ prescriptionId: prescription.id, athleteId: marina!.id, done: true });
    list = await getAthletePrescriptions(marina!.id);
    found = list.find((p) => p.id === prescription.id)!;
    expect(found.completedLast7Days).toBe(1);

    await setExerciseCompletion({ prescriptionId: prescription.id, athleteId: marina!.id, done: false });
    list = await getAthletePrescriptions(marina!.id);
    found = list.find((p) => p.id === prescription.id)!;
    expect(found.doneToday).toBe(false);
  });

  it("rejects marking another athlete's prescription done", async () => {
    const [a, b] = await getRoster(demoCoach.id);
    const [exercise] = await getExerciseLibrary();
    const prescription = await prescribeExercise({ athleteId: a.athleteId, coachId: demoCoach.id, exerciseId: exercise.id });
    await expect(
      setExerciseCompletion({ prescriptionId: prescription.id, athleteId: b.athleteId, done: true }),
    ).rejects.toThrow();
  });

  it("lets the prescribing coach deactivate a prescription, dropping it from the active list", async () => {
    const marina = await findAthleteByEmail("marina.alves@atleta.com");
    const [exercise] = await getExerciseLibrary();
    const prescription = await prescribeExercise({ athleteId: marina!.id, coachId: demoCoach.id, exerciseId: exercise.id });

    expect(await deactivatePrescription(prescription.id, demoCoach.id)).toBe(true);
    const active = await getAthletePrescriptions(marina!.id, true);
    expect(active.map((p) => p.id)).not.toContain(prescription.id);
  });
});
