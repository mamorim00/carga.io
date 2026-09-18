import { NextResponse } from "next/server";
import { addManualActivity } from "@/lib/data";

// The manual-entry fallback: an athlete with no wearable connected still
// gets the same RPE + wellness check-in as one whose activity synced from
// Strava — they just tell us the activity happened instead of it arriving
// automatically.
export async function POST(request: Request) {
  const body = await request.json();
  const { athleteId, durationMin, distanceKm } = body ?? {};

  if (!athleteId || typeof durationMin !== "number" || durationMin <= 0) {
    return NextResponse.json({ error: "athleteId e durationMin (> 0) são obrigatórios" }, { status: 400 });
  }

  const activity = addManualActivity({ athleteId, durationMin, distanceKm });
  return NextResponse.json({ activity }, { status: 201 });
}
