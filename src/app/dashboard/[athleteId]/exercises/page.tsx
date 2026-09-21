import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getAthlete, getAthletePrescriptions, getExerciseLibrary } from "@/lib/data";
import { PrescriptionManager } from "./PrescriptionManager";

export default async function AthleteExercisesPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const coach = await requireCoach();
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) notFound();

  const [library, prescriptions] = await Promise.all([
    getExerciseLibrary(),
    getAthletePrescriptions(athleteId, true),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <Link href={`/dashboard/${athleteId}`} className="text-[12.5px] text-muted">
        ← {athlete.name}
      </Link>
      <div>
        <div className="font-display text-[23px] font-semibold text-ink">Exercícios</div>
        <div className="mt-0.5 text-[12.5px] text-muted">
          Aquecimento, fortalecimento preventivo e mobilidade — o atleta marca como feito em /exercises.
        </div>
      </div>
      <PrescriptionManager athleteId={athleteId} library={library} prescriptions={prescriptions} />
    </main>
  );
}
