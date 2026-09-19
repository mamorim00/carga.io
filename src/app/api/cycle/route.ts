import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/auth";
import { addCycleLog } from "@/lib/data";
import { CYCLE_SYMPTOMS, type CycleFlow, type CyclePhase, type CycleSymptom } from "@/lib/types";

const VALID_FLOW: CycleFlow[] = ["NONE", "LIGHT", "MEDIUM", "HEAVY"];
const VALID_PHASE: CyclePhase[] = ["MENSTRUAL", "FOLLICULAR", "OVULATION", "LUTEAL"];

// Athlete-only, taken from the session like /api/pain — this is personal
// health data with no coach-facing view anywhere in the app.
export async function POST(request: Request) {
  const athlete = await getSessionAthlete();
  if (!athlete) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const flow = body?.flow;
  const phase = body?.phase ?? null;
  const symptoms = Array.isArray(body?.symptoms) ? body.symptoms : [];

  if (!VALID_FLOW.includes(flow)) {
    return NextResponse.json({ error: "Selecione o fluxo." }, { status: 400 });
  }
  if (phase !== null && !VALID_PHASE.includes(phase)) {
    return NextResponse.json({ error: "Fase inválida." }, { status: 400 });
  }
  if (!symptoms.every((s: unknown) => CYCLE_SYMPTOMS.includes(s as CycleSymptom))) {
    return NextResponse.json({ error: "Sintoma inválido." }, { status: 400 });
  }

  const log = await addCycleLog({ athleteId: athlete.id, flow, phase, symptoms });
  return NextResponse.json({ log }, { status: 201 });
}
