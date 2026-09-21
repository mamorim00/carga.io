import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { addExercise } from "@/lib/data";
import { EXERCISE_CATEGORIES, type ExerciseCategory } from "@/lib/types";

// Coach-only: adds an entry to the shared library. A coach may paste their
// own trusted videoUrl — this app never fabricates one (see the Exercise
// model's doc comment in prisma/schema.prisma).
export async function POST(request: Request) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = body?.category;
  const instructions =
    typeof body?.instructions === "string" && body.instructions.trim() ? body.instructions.trim() : undefined;
  const videoUrl = typeof body?.videoUrl === "string" && body.videoUrl.trim() ? body.videoUrl.trim() : undefined;

  if (!name) return NextResponse.json({ error: "Nome do exercício é obrigatório." }, { status: 400 });
  if (!EXERCISE_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  if (videoUrl) {
    try {
      new URL(videoUrl);
    } catch {
      return NextResponse.json({ error: "Link de vídeo inválido." }, { status: 400 });
    }
  }

  const exercise = await addExercise({ name, category: category as ExerciseCategory, instructions, videoUrl });
  return NextResponse.json({ exercise }, { status: 201 });
}
