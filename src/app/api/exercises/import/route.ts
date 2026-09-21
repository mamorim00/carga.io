import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { importExercisesFromExerciseDb } from "@/lib/data";

// Coach-only: pulls a batch of exercises from ExerciseDB into the shared
// library. Needs EXERCISEDB_API_KEY set in the environment (Vercel, not
// this repo) — see README.md. A rate-limited third-party call, so this is
// a deliberate button press, not something that runs automatically.
export async function POST(request: Request) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const limit = typeof body?.limit === "number" && body.limit > 0 && body.limit <= 200 ? body.limit : 50;

  try {
    const result = await importExercisesFromExerciseDb(limit);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
