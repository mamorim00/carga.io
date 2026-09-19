import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { findAthleteByEmail, findCoachByEmail } from "@/lib/data";
import { verifyPassword } from "@/lib/password";

const INVALID = { error: "E-mail ou senha inválidos." } as const;

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json(INVALID, { status: 401 });

  const coach = await findCoachByEmail(email);
  if (coach && verifyPassword(password, coach.passwordHash)) {
    await createSession(coach.id, "COACH");
    return NextResponse.json({ role: "COACH" });
  }

  const athlete = await findAthleteByEmail(email);
  if (athlete && athlete.status === "ACTIVE" && athlete.passwordHash && verifyPassword(password, athlete.passwordHash)) {
    await createSession(athlete.id, "ATHLETE");
    return NextResponse.json({ role: "ATHLETE" });
  }

  // Same generic error whether the email doesn't exist, the password is
  // wrong, or the athlete hasn't accepted their invite yet — never confirm
  // which, to an unauthenticated caller.
  return NextResponse.json(INVALID, { status: 401 });
}
