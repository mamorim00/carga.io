import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { createAthleteInvite, isEmailTaken } from "@/lib/data";
import type { Sport } from "@/lib/types";

const VALID_SPORTS: Sport[] = ["RUNNING", "CYCLING", "TRIATHLON", "OTHER"];

export async function POST(request: Request) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const sport = body?.sport;

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Nome e e-mail do atleta são obrigatórios." }, { status: 400 });
  }
  if (!VALID_SPORTS.includes(sport)) {
    return NextResponse.json({ error: "Modalidade inválida." }, { status: 400 });
  }
  if (isEmailTaken(email)) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  }

  const athlete = createAthleteInvite({ orgId: coach.orgId, coachId: coach.id, name, email, sport });
  const inviteUrl = new URL(`/invite/${athlete.inviteToken}`, request.url).toString();
  return NextResponse.json(
    { athlete: { id: athlete.id, name: athlete.name, email: athlete.email, sport: athlete.sport }, inviteUrl },
    { status: 201 },
  );
}
