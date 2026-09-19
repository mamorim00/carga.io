import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { revokeInvite } from "@/lib/data";

export async function POST(_request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { athleteId } = await params;
  const revoked = await revokeInvite(athleteId, coach.id);
  if (!revoked) return NextResponse.json({ error: "convite não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
