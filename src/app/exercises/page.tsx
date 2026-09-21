import Link from "next/link";
import { requireAthlete } from "@/lib/auth";
import { getAthletePrescriptions } from "@/lib/data";
import { ExerciseChecklist } from "./ExerciseChecklist";

export default async function ExercisesPage() {
  const athlete = await requireAthlete();
  const prescriptions = await getAthletePrescriptions(athlete.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <span className="font-display text-lg font-semibold text-ink">Meus exercícios</span>
        <Link href="/progress" className="text-[12.5px] text-muted">
          ← Progresso
        </Link>
      </div>
      <div className="flex flex-col gap-3 px-6 py-6">
        <p className="text-[11.5px] leading-relaxed text-muted">
          Aquecimento, fortalecimento preventivo e mobilidade prescritos pelo seu treinador ou fisioterapeuta.
          Marque como feito assim que concluir no dia.
        </p>
        <ExerciseChecklist prescriptions={prescriptions} />
      </div>
    </main>
  );
}
