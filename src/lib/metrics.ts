/**
 * Training-load metrics engine.
 *
 * Foundation: session-RPE (Foster, 1998) load, monotony/strain (Foster
 * 1998/2001), and an EWMA-based acute:chronic workload ratio (Williams et
 * al., 2016) — the same math eLoad uses, plus a hybrid external-load figure
 * (HR-based TRIMP) layered on top when wearable data is available.
 *
 * Pure functions only: no I/O, no framework dependency, so this is easy to
 * unit test and safe to run both server-side (nightly recompute) and in a
 * background job.
 */

export interface DailyLoad {
  /** ISO date (YYYY-MM-DD), one entry per day, oldest first, no gaps. */
  date: string;
  /** Combined internal + external load for that day (0 for a rest day). */
  load: number;
}

export type AcwrZone = "IDEAL" | "ATTENTION" | "RISK";

/** Internal load from session-RPE: RPE (1–10, Foster CR-10) × duration in minutes. */
export function internalLoad(rpe: number, durationMin: number): number {
  if (rpe < 1 || rpe > 10) throw new Error("rpe must be between 1 and 10");
  if (durationMin < 0) throw new Error("durationMin must be >= 0");
  return rpe * durationMin;
}

export interface HrZoneMinutes {
  /** Minutes spent in each HR zone, zone 1 (easiest) to zone 5 (hardest). */
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
}

// Edwards-style TRIMP: minutes per zone weighted by zone intensity (1..5).
const ZONE_WEIGHTS = [1, 2, 3, 4, 5] as const;

/** External load from HR-zone minutes (a simple Edwards TRIMP variant). */
export function externalLoadFromHrZones(zones: HrZoneMinutes): number {
  const minutes = [zones.z1, zones.z2, zones.z3, zones.z4, zones.z5];
  return minutes.reduce((sum, min, i) => sum + min * ZONE_WEIGHTS[i], 0);
}

/** Blend internal and external load into one daily figure for ACWR/monotony. */
export function combinedLoad(internal: number, external?: number): number {
  if (external == null) return internal;
  // Equal-weight blend; a coach-configurable weighting can replace this later.
  return internal * 0.5 + external * 0.5;
}

/**
 * Monotony: mean daily load ÷ population standard deviation, over a window
 * (7 days by default). High monotony (low variability) is itself a risk
 * factor even when absolute load is unremarkable.
 */
export function monotony(loads: number[]): number {
  if (loads.length === 0) throw new Error("loads must not be empty");
  const mean = average(loads);
  const sd = stddev(loads, mean);
  if (sd === 0) return mean === 0 ? 0 : Infinity;
  return mean / sd;
}

/** Strain: total load over the window × monotony for that window. */
export function strain(loads: number[]): number {
  const total = loads.reduce((a, b) => a + b, 0);
  return total * monotony(loads);
}

/**
 * EWMA acute:chronic workload ratio (Williams et al., 2016), the current
 * sports-science standard over a plain rolling average — it weights recent
 * days more heavily and never has a hard 7/28-day cliff.
 *
 * @param loads daily loads, oldest first, no gaps (fill rest days with 0).
 * @param acuteDays acute window in days (default 7).
 * @param chronicDays chronic window in days (default 28).
 * @returns the ACWR for the LAST day in `loads`, or null if there is not
 *   enough history yet (fewer than `chronicDays` entries).
 */
export function ewmaAcwr(
  loads: number[],
  acuteDays = 7,
  chronicDays = 28,
): number | null {
  if (loads.length < chronicDays) return null;
  const acute = ewma(loads, acuteDays);
  const chronic = ewma(loads, chronicDays);
  if (chronic === 0) return null;
  return acute / chronic;
}

function ewma(loads: number[], windowDays: number): number {
  const lambda = 2 / (windowDays + 1);
  let value = loads[0];
  for (let i = 1; i < loads.length; i++) {
    value = loads[i] * lambda + value * (1 - lambda);
  }
  return value;
}

/** Classify an ACWR value into the traffic-light zone shown on the dashboard. */
export function classifyAcwr(acwr: number): AcwrZone {
  if (acwr >= 0.8 && acwr <= 1.3) return "IDEAL";
  if (acwr > 1.3 && acwr <= 1.5) return "ATTENTION";
  if (acwr < 0.8) return "ATTENTION"; // undertraining is a risk factor too
  return "RISK";
}

function average(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[], mean: number): number {
  const variance = xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}
