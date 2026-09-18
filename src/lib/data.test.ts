import { describe, expect, it } from "vitest";
import { getRoster, getAthlete, getLatestUnreportedActivity, submitCheckin, addManualActivity } from "./data";

describe("seeded roster", () => {
  const roster = getRoster();

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

describe("check-in flow", () => {
  it("lets an athlete without a wearable log manually, then check in", () => {
    const thiago = getRoster().find((a) => a.name === "Thiago Nunes")!;
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
    });

    expect(sessionReport.rpe).toBe(7);
    expect(wellnessCheckin.soreness).toBe(4);
    expect(getLatestUnreportedActivity(thiago.athleteId)).toBeUndefined();
  });

  it("rejects a check-in for an activity that belongs to someone else", () => {
    const [a, b] = getRoster();
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
      }),
    ).toThrow();
  });
});

describe("getAthlete", () => {
  it("returns undefined for an unknown id", () => {
    expect(getAthlete("nope")).toBeUndefined();
  });
});
