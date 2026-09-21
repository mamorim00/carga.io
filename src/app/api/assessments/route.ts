import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { addAssessment, getAthlete } from "@/lib/data";
import { MEASUREMENT_CATEGORIES, type AssessmentKind, type MeasurementCategory } from "@/lib/types";

const VALID_KIND: AssessmentKind[] = ["INITIAL", "FOLLOW_UP"];

interface RawMeasurement {
  category?: unknown;
  label?: unknown;
  value?: unknown;
  unit?: unknown;
  note?: unknown;
}

// Coach-only (physios use the coach login today — there's no separate
// physio account type yet, see prisma/schema.prisma's unused Role enum):
// takes an explicit athleteId in the body, like /api/checkin and
// /api/activities/manual, so it must check the athlete belongs to this
// coach itself rather than trusting the session for identity.
export async function POST(request: Request) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const athleteId = typeof body?.athleteId === "string" ? body.athleteId : "";
  const kind = body?.kind;
  const examsNote = typeof body?.examsNote === "string" && body.examsNote.trim() ? body.examsNote.trim() : undefined;
  const medicationsNote =
    typeof body?.medicationsNote === "string" && body.medicationsNote.trim() ? body.medicationsNote.trim() : undefined;
  const generalNote =
    typeof body?.generalNote === "string" && body.generalNote.trim() ? body.generalNote.trim() : undefined;
  const rawMeasurements: RawMeasurement[] = Array.isArray(body?.measurements) ? body.measurements : [];

  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) {
    return NextResponse.json({ error: "atleta não encontrado" }, { status: 404 });
  }
  if (!VALID_KIND.includes(kind)) {
    return NextResponse.json({ error: "Selecione o tipo de avaliação." }, { status: 400 });
  }

  const measurements: Array<{ category: MeasurementCategory; label: string; value: number | null; unit: string | null; note?: string }> =
    [];
  for (const m of rawMeasurements) {
    const label = typeof m.label === "string" ? m.label.trim() : "";
    if (!label) continue; // rows the physio started but never named are dropped, not rejected
    if (!MEASUREMENT_CATEGORIES.includes(m.category as MeasurementCategory)) {
      return NextResponse.json({ error: "Categoria de medida inválida." }, { status: 400 });
    }
    const value = typeof m.value === "number" && Number.isFinite(m.value) ? m.value : null;
    const unit = typeof m.unit === "string" && m.unit.trim() ? m.unit.trim() : null;
    const note = typeof m.note === "string" && m.note.trim() ? m.note.trim() : undefined;
    measurements.push({ category: m.category as MeasurementCategory, label, value, unit, note });
  }

  const assessment = await addAssessment({
    athleteId,
    coachId: coach.id,
    kind,
    examsNote,
    medicationsNote,
    generalNote,
    measurements,
  });
  return NextResponse.json({ assessment }, { status: 201 });
}
