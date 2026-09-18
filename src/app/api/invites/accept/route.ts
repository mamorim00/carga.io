import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { acceptAthleteInvite } from "@/lib/data";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await request.json();
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) return NextResponse.json({ error: "convite inválido" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  try {
    const athlete = acceptAthleteInvite({ token, passwordHash: hashPassword(password) });
    await createSession(athlete.id, "ATHLETE");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
