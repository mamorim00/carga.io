import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { getAthlete, prescribeExercise } from "@/lib/data";

// Coach-only: prescribes a library exercise to one of their own athletes.
export async function POST(request: Request) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const athleteId = typeof body?.athleteId === "string" ? body.athleteId : "";
  const exerciseId = typeof body?.exerciseId === "string" ? body.exerciseId : "";
  const sets = typeof body?.sets === "number" && Number.isFinite(body.sets) ? body.sets : undefined;
  const reps = typeof body?.reps === "number" && Number.isFinite(body.reps) ? body.reps : undefined;
  const frequency = typeof body?.frequency === "string" && body.frequency.trim() ? body.frequency.trim() : undefined;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) {
    return NextResponse.json({ error: "atleta não encontrado" }, { status: 404 });
  }
  if (!exerciseId) return NextResponse.json({ error: "Selecione um exercício." }, { status: 400 });

  const prescription = await prescribeExercise({
    athleteId,
    coachId: coach.id,
    exerciseId,
    sets,
    reps,
    frequency,
    notes,
  });
  return NextResponse.json({ prescription }, { status: 201 });
}
