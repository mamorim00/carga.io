import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/auth";
import { addPainReport } from "@/lib/data";
import { BODY_PARTS, type BodyPart } from "@/lib/types";

// Unlike /api/checkin and /api/activities/manual (which trust a
// client-supplied athleteId — a pre-existing gap, not fixed here), this
// route takes the athlete from the session: nothing in the request body
// says who it's for, so there's nothing to spoof.
export async function POST(request: Request) {
  const athlete = await getSessionAthlete();
  if (!athlete) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const bodyPart = body?.bodyPart;
  const intensity = body?.intensity;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  if (!BODY_PARTS.includes(bodyPart)) {
    return NextResponse.json({ error: "Selecione uma região do corpo." }, { status: 400 });
  }
  if (typeof intensity !== "number" || intensity < 1 || intensity > 10) {
    return NextResponse.json({ error: "Intensidade deve ser de 1 a 10." }, { status: 400 });
  }

  const report = addPainReport({ athleteId: athlete.id, bodyPart: bodyPart as BodyPart, intensity, note });
  return NextResponse.json({ report }, { status: 201 });
}
