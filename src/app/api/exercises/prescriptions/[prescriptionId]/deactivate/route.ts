import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { deactivatePrescription } from "@/lib/data";

export async function POST(_request: Request, { params }: { params: Promise<{ prescriptionId: string }> }) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { prescriptionId } = await params;
  const deactivated = await deactivatePrescription(prescriptionId, coach.id);
  if (!deactivated) return NextResponse.json({ error: "prescrição não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
