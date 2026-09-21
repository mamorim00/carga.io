import { describe, expect, it } from "vitest";
import { parseExerciseDbEntry } from "./data";

/**
 * parseExerciseDbEntry is the one piece of the ExerciseDB import this
 * project could never exercise against a live response — this sandbox's
 * network policy blocks both rapidapi.com and exercisedb.p.rapidapi.com
 * (confirmed: CONNECT rejected), so the mapping was written from
 * documented API shape, not a real one. Kept in its own file, separate
 * from data.test.ts, specifically so it runs standalone: it's pure (no
 * database), but data.test.ts's shared beforeAll hits the (unreachable)
 * database and Vitest skips every test in a file whose beforeAll throws —
 * these would otherwise never actually execute anywhere useful.
 */
describe("parseExerciseDbEntry", () => {
  it("maps a well-formed entry, joining instructions and renaming gifUrl to videoUrl", () => {
    const parsed = parseExerciseDbEntry({
      id: "0001",
      name: "3/4 sit-up",
      gifUrl: "https://v2.exercisedb.io/image/abc123",
      instructions: ["Lie on the floor.", "Crunch up.", "Lower back down."],
      bodyPart: "waist",
      target: "abs",
    });
    expect(parsed).toEqual({
      externalId: "0001",
      name: "3/4 sit-up",
      instructions: "Lie on the floor. Crunch up. Lower back down.",
      videoUrl: "https://v2.exercisedb.io/image/abc123",
    });
  });

  it("accepts a numeric id, coercing it to a string", () => {
    expect(parseExerciseDbEntry({ id: 42, name: "Push-up" })?.externalId).toBe("42");
  });

  it("returns null for a missing or blank name", () => {
    expect(parseExerciseDbEntry({ id: "1", name: "" })).toBeNull();
    expect(parseExerciseDbEntry({ id: "1" })).toBeNull();
  });

  it("returns null for a missing id", () => {
    expect(parseExerciseDbEntry({ name: "Push-up" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseExerciseDbEntry(null)).toBeNull();
    expect(parseExerciseDbEntry("Push-up")).toBeNull();
    expect(parseExerciseDbEntry(undefined)).toBeNull();
  });

  it("tolerates missing instructions/gifUrl, and drops non-string instruction entries", () => {
    const parsed = parseExerciseDbEntry({ id: "2", name: "Plank", instructions: ["Hold.", 42, null, "Breathe."] });
    expect(parsed?.instructions).toBe("Hold. Breathe.");
    expect(parsed?.videoUrl).toBeUndefined();
  });

  it("trims a padded name", () => {
    expect(parseExerciseDbEntry({ id: "3", name: "  Squat  " })?.name).toBe("Squat");
  });
});
