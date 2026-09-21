import { describe, expect, it } from "vitest";
import { ageFromBirthDate, formatSports, isNonCompliant } from "./presentation";

describe("formatSports", () => {
  it("returns the single label as-is", () => {
    expect(formatSports(["RUNNING"])).toBe("Corrida");
  });

  it("joins two with 'e', lowercasing the second", () => {
    expect(formatSports(["RUNNING", "CYCLING"])).toBe("Corrida e ciclismo");
  });

  it("joins three or more with commas and a final 'e'", () => {
    expect(formatSports(["RUNNING", "CYCLING", "TRIATHLON"])).toBe("Corrida, ciclismo e triatlo");
  });

  it("falls back to an em dash for an empty list", () => {
    expect(formatSports([])).toBe("—");
  });
});

describe("ageFromBirthDate", () => {
  it("returns null when there's no birth date yet", () => {
    expect(ageFromBirthDate(null)).toBeNull();
  });

  it("computes age correctly on and around the birthday", () => {
    const tenYearsAgoToday = new Date();
    tenYearsAgoToday.setFullYear(tenYearsAgoToday.getFullYear() - 10);
    expect(ageFromBirthDate(tenYearsAgoToday.toISOString())).toBe(10);

    const almostTenYearsAgo = new Date();
    almostTenYearsAgo.setFullYear(almostTenYearsAgo.getFullYear() - 10);
    almostTenYearsAgo.setDate(almostTenYearsAgo.getDate() + 1); // birthday is tomorrow
    expect(ageFromBirthDate(almostTenYearsAgo.toISOString())).toBe(9);
  });
});

describe("isNonCompliant", () => {
  it("is true when there's never been a sync", () => {
    expect(isNonCompliant(null)).toBe(true);
  });

  it("is false for something synced today", () => {
    expect(isNonCompliant(new Date().toISOString())).toBe(false);
  });

  it("is true once the threshold has passed", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(isNonCompliant(fourDaysAgo)).toBe(true);
  });
});
