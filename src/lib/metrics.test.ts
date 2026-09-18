import { describe, expect, it } from "vitest";
import {
  classifyAcwr,
  combinedLoad,
  ewmaAcwr,
  externalLoadFromHrZones,
  internalLoad,
  monotony,
  strain,
} from "./metrics";

describe("internalLoad", () => {
  it("multiplies RPE by duration", () => {
    expect(internalLoad(6, 42)).toBe(252);
  });

  it("rejects an RPE outside the CR-10 scale", () => {
    expect(() => internalLoad(11, 30)).toThrow();
    expect(() => internalLoad(0, 30)).toThrow();
  });

  it("rejects a negative duration", () => {
    expect(() => internalLoad(5, -1)).toThrow();
  });
});

describe("externalLoadFromHrZones", () => {
  it("weights higher zones more heavily", () => {
    const allZ1 = externalLoadFromHrZones({ z1: 60, z2: 0, z3: 0, z4: 0, z5: 0 });
    const allZ5 = externalLoadFromHrZones({ z1: 0, z2: 0, z3: 0, z4: 0, z5: 60 });
    expect(allZ5).toBeGreaterThan(allZ1);
    expect(allZ1).toBe(60);
    expect(allZ5).toBe(300);
  });
});

describe("combinedLoad", () => {
  it("falls back to internal load alone when there's no wearable data", () => {
    expect(combinedLoad(200)).toBe(200);
  });

  it("blends internal and external evenly", () => {
    expect(combinedLoad(200, 100)).toBe(150);
  });
});

describe("monotony", () => {
  it("is high when the daily loads barely vary", () => {
    const flat = monotony([100, 100, 100, 100, 100, 100, 100]);
    const varied = monotony([50, 200, 20, 300, 10, 150, 80]);
    expect(flat).toBeGreaterThan(varied);
  });

  it("handles an all-zero week without dividing by zero", () => {
    expect(monotony([0, 0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it("rejects an empty window", () => {
    expect(() => monotony([])).toThrow();
  });
});

describe("strain", () => {
  it("is total weekly load times monotony", () => {
    const loads = [100, 100, 100, 100, 100, 100, 100];
    const total = loads.reduce((a, b) => a + b, 0);
    expect(strain(loads)).toBeCloseTo(total * monotony(loads));
  });
});

describe("ewmaAcwr", () => {
  it("returns null with less than a chronic window of history", () => {
    const loads = Array(20).fill(100);
    expect(ewmaAcwr(loads)).toBeNull();
  });

  it("is close to 1 for a steady, unchanging load", () => {
    const loads = Array(40).fill(150);
    const acwr = ewmaAcwr(loads);
    expect(acwr).not.toBeNull();
    expect(acwr as number).toBeCloseTo(1, 1);
  });

  it("rises above 1 after a sharp spike in recent load", () => {
    const steady = Array(35).fill(100);
    const spike = Array(7).fill(400);
    const acwr = ewmaAcwr([...steady, ...spike]);
    expect(acwr).not.toBeNull();
    expect(acwr as number).toBeGreaterThan(1.3);
  });

  it("drops below 1 after tapering off recent load", () => {
    const steady = Array(35).fill(200);
    const taper = Array(7).fill(20);
    const acwr = ewmaAcwr([...steady, ...taper]);
    expect(acwr).not.toBeNull();
    expect(acwr as number).toBeLessThan(0.8);
  });
});

describe("classifyAcwr", () => {
  it("classifies the ideal zone", () => {
    expect(classifyAcwr(0.8)).toBe("IDEAL");
    expect(classifyAcwr(1.1)).toBe("IDEAL");
    expect(classifyAcwr(1.3)).toBe("IDEAL");
  });

  it("classifies attention on both sides of ideal", () => {
    expect(classifyAcwr(1.4)).toBe("ATTENTION");
    expect(classifyAcwr(0.6)).toBe("ATTENTION");
  });

  it("classifies risk above 1.5", () => {
    expect(classifyAcwr(1.58)).toBe("RISK");
    expect(classifyAcwr(1.61)).toBe("RISK");
  });
});
