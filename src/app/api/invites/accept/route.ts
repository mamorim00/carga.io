import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { acceptAthleteInvite } from "@/lib/data";
import { hashPassword } from "@/lib/password";
import type { Sex } from "@/lib/types";

const VALID_SEX: Sex[] = ["FEMALE", "MALE", "UNSPECIFIED"];

export async function POST(request: Request) {
  const body = await request.json();
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
  const sex = body?.sex;

  if (!token) return NextResponse.json({ error: "convite inválido" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  const birthDateMs = Date.parse(birthDate);
  const age = Number.isNaN(birthDateMs) ? null : (Date.now() - birthDateMs) / (365.25 * 24 * 3_600_000);
  if (age === null || age < 5 || age > 100) {
    return NextResponse.json({ error: "Informe uma data de nascimento válida." }, { status: 400 });
  }
  if (!VALID_SEX.includes(sex)) {
    return NextResponse.json({ error: "Selecione uma opção de sexo." }, { status: 400 });
  }

  try {
    const athlete = acceptAthleteInvite({ token, passwordHash: hashPassword(password), birthDate, sex });
    await createSession(athlete.id, "ATHLETE");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
