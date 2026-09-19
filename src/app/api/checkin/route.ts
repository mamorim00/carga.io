import { NextResponse } from "next/server";
import { submitCheckin } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json();
  const { athleteId, activityId, rpe, sleep, soreness, mood, stress, hydration } = body ?? {};

  if (!athleteId || !activityId) {
    return NextResponse.json({ error: "athleteId e activityId são obrigatórios" }, { status: 400 });
  }
  for (const [key, value] of Object.entries({ rpe, sleep, soreness, mood, stress, hydration })) {
    if (typeof value !== "number" || value < 1 || value > 10) {
      return NextResponse.json({ error: `${key} inválido` }, { status: 400 });
    }
  }

  try {
    const result = submitCheckin({ athleteId, activityId, rpe, sleep, soreness, mood, stress, hydration });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
