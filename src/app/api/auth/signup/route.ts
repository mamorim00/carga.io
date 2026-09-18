import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { createCoachAccount, isEmailTaken } from "@/lib/data";
import { hashPassword } from "@/lib/password";

// Coach self-signup only — there is no athlete self-signup. Athletes get an
// account by accepting an invite (see /api/invites and /api/invites/accept).
export async function POST(request: Request) {
  const body = await request.json();
  const orgName = typeof body?.orgName === "string" ? body.orgName.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!orgName || !name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Preencha nome da equipe, nome, e-mail e senha." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (isEmailTaken(email)) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  }

  const coach = createCoachAccount({ orgName, name, email, passwordHash: hashPassword(password) });
  await createSession(coach.id, "COACH");
  return NextResponse.json({ coach: { id: coach.id, name: coach.name, email: coach.email } }, { status: 201 });
}
