import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/auth";
import { setExerciseCompletion } from "@/lib/data";

// Athlete-only, taken from the session like /api/pain — toggles today's
// "done" mark for one of the athlete's own prescriptions.
export async function POST(request: Request) {
  const athlete = await getSessionAthlete();
  if (!athlete) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const prescriptionId = typeof body?.prescriptionId === "string" ? body.prescriptionId : "";
  const done = body?.done !== false; // default true — "mark done" is the common case

  if (!prescriptionId) return NextResponse.json({ error: "prescriptionId é obrigatório" }, { status: 400 });

  try {
    await setExerciseCompletion({ prescriptionId, athleteId: athlete.id, done });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
