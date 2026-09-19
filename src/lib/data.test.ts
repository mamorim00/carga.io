import { describe, expect, it } from "vitest";
import {
  acceptAthleteInvite,
  addManualActivity,
  addPainReport,
  createAthleteInvite,
  createCoachAccount,
  findAthleteByEmail,
  findCoachByEmail,
  getAthlete,
  getAthleteActivityFeed,
  getAthleteByInviteToken,
  getAthleteLoadSummary,
  getAthletePainReports,
  getLatestUnreportedActivity,
  getPainReportsForCoach,
  getPendingInvites,
  getRoster,
  getWellnessHistory,
  isEmailTaken,
  revokeInvite,
  submitCheckin,
} from "./data";

const demoCoach = findCoachByEmail("rafael@fundobh.com.br")!;

describe("seeded roster", () => {
  const roster = getRoster(demoCoach.id);

  it("computes an ACWR zone for every seeded athlete", () => {
    expect(roster).toHaveLength(6);
    for (const a of roster) {
      expect(a.acwr).not.toBeNull();
      expect(["IDEAL", "ATTENTION", "RISK"]).toContain(a.zone);
    }
  });

  it("flags the athlete with a recent load spike as RISK", () => {
    const camila = roster.find((a) => a.name === "Camila Souza")!;
    expect(camila.zone).toBe("RISK");
  });

  it("keeps a steady athlete in the IDEAL zone", () => {
    const marina = roster.find((a) => a.name === "Marina Alves")!;
    expect(marina.zone).toBe("IDEAL");
  });

  it("marks the wearable-less athlete as such, with a stale sync", () => {
    const thiago = roster.find((a) => a.name === "Thiago Nunes")!;
    expect(thiago.hasWearable).toBe(false);
  });
});

describe("seeded wellness history", () => {
  it("gives every seeded athlete recent wellness check-ins", () => {
    for (const a of getRoster(demoCoach.id)) {
      expect(getWellnessHistory(a.athleteId).length).toBeGreaterThan(0);
    }
  });

  it("has the at-risk athlete's wellness reflect her load spike, not just her ACWR", () => {
    const camila = getRoster(demoCoach.id).find((a) => a.name === "Camila Souza")!;
    const [latest] = getWellnessHistory(camila.athleteId, 1);
    expect(latest.sleep).toBeLessThanOrEqual(2);
    expect(latest.soreness).toBeGreaterThanOrEqual(4);
  });
});

describe("check-in flow", () => {
  it("lets an athlete without a wearable log manually, then check in", () => {
    const thiago = getRoster(demoCoach.id).find((a) => a.name === "Thiago Nunes")!;
    const activity = addManualActivity({ athleteId: thiago.athleteId, durationMin: 50, distanceKm: 9 });
    expect(getLatestUnreportedActivity(thiago.athleteId)?.id).toBe(activity.id);

    const { sessionReport, wellnessCheckin } = submitCheckin({
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
    expect(getLatestUnreportedActivity(thiago.athleteId)).toBeUndefined();
  });

  it("rejects a check-in for an activity that belongs to someone else", () => {
    const [a, b] = getRoster(demoCoach.id);
    const activity = addManualActivity({ athleteId: a.athleteId, durationMin: 30 });
    expect(() =>
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
    ).toThrow();
  });
});

describe("getAthlete", () => {
  it("returns undefined for an unknown id", () => {
    expect(getAthlete("nope")).toBeUndefined();
  });
});

describe("getAthleteActivityFeed", () => {
  it("joins each activity with its RPE once checked in, most recent first", () => {
    const marina = getRoster(demoCoach.id).find((a) => a.name === "Marina Alves")!;
    const before = getAthleteActivityFeed(marina.athleteId, 3);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((a, i) => i === 0 || a.startedAt <= before[i - 1].startedAt)).toBe(true);

    const activity = addManualActivity({ athleteId: marina.athleteId, durationMin: 40, distanceKm: 7 });
    submitCheckin({
      athleteId: marina.athleteId,
      activityId: activity.id,
      rpe: 8,
      sleep: 4,
      soreness: 2,
      mood: 4,
      stress: 2,
      hydration: 4,
    });

    const feed = getAthleteActivityFeed(marina.athleteId, 3);
    expect(feed[0].id).toBe(activity.id);
    expect(feed[0].rpe).toBe(8);
  });

  it("reports null RPE for an activity with no session report yet", () => {
    const thiago = getRoster(demoCoach.id).find((a) => a.name === "Thiago Nunes")!;
    const activity = addManualActivity({ athleteId: thiago.athleteId, durationMin: 30 });
    const feed = getAthleteActivityFeed(thiago.athleteId, 1);
    expect(feed[0].id).toBe(activity.id);
    expect(feed[0].rpe).toBeNull();
  });
});

describe("coach signup", () => {
  it("creates a new org scoped to the new coach, separate from the seeded demo roster", () => {
    const coach = createCoachAccount({
      orgName: "Equipe Teste",
      name: "Nova Treinadora",
      email: "nova@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    expect(coach.orgId).not.toBe(demoCoach.orgId);
    expect(getRoster(coach.id)).toHaveLength(0);
    expect(findCoachByEmail("nova@teste.com")?.id).toBe(coach.id);
  });
});

describe("athlete invites", () => {
  it("invites an athlete, then lets them accept and log in with the password they set", () => {
    const athlete = createAthleteInvite({
      orgId: demoCoach.orgId,
      coachId: demoCoach.id,
      name: "Convidado Teste",
      email: "convidado@teste.com",
      sports: ["RUNNING"],
    });
    expect(athlete.status).toBe("INVITED");
    expect(athlete.passwordHash).toBeNull();
    expect(getPendingInvites(demoCoach.id).map((a) => a.id)).toContain(athlete.id);
    // Not on the roster yet — pending invites are listed separately.
    expect(getRoster(demoCoach.id).map((a) => a.athleteId)).not.toContain(athlete.id);

    const found = getAthleteByInviteToken(athlete.inviteToken!);
    expect(found?.id).toBe(athlete.id);

    const accepted = acceptAthleteInvite({
      token: athlete.inviteToken!,
      passwordHash: "scrypt:whatever:hash2",
      birthDate: "1995-06-01",
      sex: "FEMALE",
    });
    expect(accepted.status).toBe("ACTIVE");
    expect(accepted.sex).toBe("FEMALE");
    expect(accepted.inviteToken).toBeNull();
    expect(getPendingInvites(demoCoach.id).map((a) => a.id)).not.toContain(athlete.id);
    expect(getRoster(demoCoach.id).map((a) => a.athleteId)).toContain(athlete.id);
  });

  it("rejects accepting an unknown or already-used token", () => {
    expect(() =>
      acceptAthleteInvite({ token: "not-a-real-token", passwordHash: "x", birthDate: "1995-01-01", sex: "MALE" }),
    ).toThrow();
  });

  it("lets the inviting coach revoke a pending invite, but not another coach", () => {
    const other = createCoachAccount({
      orgName: "Outra Equipe",
      name: "Outro Treinador",
      email: "outro@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    const athlete = createAthleteInvite({
      orgId: demoCoach.orgId,
      coachId: demoCoach.id,
      name: "Revogar Teste",
      email: "revogar@teste.com",
      sports: ["OTHER"],
    });

    expect(revokeInvite(athlete.id, other.id)).toBe(false);
    expect(getAthlete(athlete.id)).toBeDefined();

    expect(revokeInvite(athlete.id, demoCoach.id)).toBe(true);
    expect(getAthlete(athlete.id)).toBeUndefined();
  });

  it("treats an email already used by a coach or athlete as taken", () => {
    expect(isEmailTaken(demoCoach.email)).toBe(true);
    expect(isEmailTaken("marina.alves@atleta.com")).toBe(true);
    expect(isEmailTaken("ninguem@teste.com")).toBe(false);
  });
});

describe("findAthleteByEmail", () => {
  it("is case-insensitive", () => {
    expect(findAthleteByEmail("MARINA.ALVES@ATLETA.COM")?.name).toBe("Marina Alves");
  });
});

describe("athlete profile fields", () => {
  it("supports more than one sport per athlete", () => {
    const diego = findAthleteByEmail("diego.ferreira@atleta.com")!;
    expect(diego.sports).toEqual(["RUNNING", "CYCLING"]);
  });

  it("seeds a birth date and sex for every demo athlete", () => {
    const marina = findAthleteByEmail("marina.alves@atleta.com")!;
    expect(marina.birthDate).not.toBeNull();
    expect(marina.sex).toBe("FEMALE");
  });

  it("leaves an invited athlete's birth date and sex unset until they accept", () => {
    const athlete = createAthleteInvite({
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
  it("computes both for a seeded athlete with a full week of history", () => {
    const marina = findAthleteByEmail("marina.alves@atleta.com")!;
    const summary = getAthleteLoadSummary(marina.id);
    expect(summary.monotony).not.toBeNull();
    expect(summary.strain).not.toBeNull();
    expect(summary.strain!).toBeGreaterThan(0);
  });

  it("computes monotony for the ramping-up athlete too, not just the steady ones", () => {
    const bruno = findAthleteByEmail("bruno.castro@atleta.com")!;
    const summary = getAthleteLoadSummary(bruno.id);
    expect(summary.monotony).not.toBeNull();
    expect(summary.strain).not.toBeNull();
  });
});

describe("wellness check-ins include hydration", () => {
  it("is present on every seeded wellness check-in", () => {
    const marina = findAthleteByEmail("marina.alves@atleta.com")!;
    const history = getWellnessHistory(marina.id);
    expect(history.length).toBeGreaterThan(0);
    for (const w of history) expect(w.hydration).toBeGreaterThanOrEqual(1);
  });
});

describe("pain reports", () => {
  it("lets an athlete log pain and read it back", () => {
    const thiago = findAthleteByEmail("thiago.nunes@atleta.com")!;
    addPainReport({ athleteId: thiago.id, bodyPart: "KNEE_L", intensity: 3 });
    addPainReport({ athleteId: thiago.id, bodyPart: "LOWER_BACK", intensity: 5, note: "Após treino longo" });

    const reports = getAthletePainReports(thiago.id, 5);
    const lowerBack = reports.find((r) => r.bodyPart === "LOWER_BACK");
    expect(lowerBack?.note).toBe("Após treino longo");
    expect(reports.some((r) => r.bodyPart === "KNEE_L")).toBe(true);
  });

  it("rolls up pain reports across a coach's whole roster", () => {
    const roster = getPainReportsForCoach(demoCoach.id, 50);
    const camila = roster.find((r) => r.athleteName === "Camila Souza");
    expect(camila).toBeDefined();
    expect(roster.every((r) => typeof r.athleteName === "string")).toBe(true);
  });

  it("never includes another coach's athletes", () => {
    const other = createCoachAccount({
      orgName: "Isolada",
      name: "Isolado",
      email: "isolado@teste.com",
      passwordHash: "scrypt:whatever:hash",
    });
    expect(getPainReportsForCoach(other.id, 50)).toHaveLength(0);
  });
});
