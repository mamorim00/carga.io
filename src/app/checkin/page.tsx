import { requireAthlete } from "@/lib/auth";
import { getLatestUnreportedActivity } from "@/lib/data";
import { CheckinForm } from "./CheckinForm";

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ manual?: string }>;
}) {
  const { manual } = await searchParams;
  const athlete = await requireAthlete();
  const pendingActivity = getLatestUnreportedActivity(athlete.id) ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <div className="flex items-center gap-3.5 border-b border-line px-6 py-5">
        <span className="font-display text-lg font-semibold text-ink">Check-in pós-treino</span>
      </div>
      <CheckinForm
        athleteId={athlete.id}
        athleteName={athlete.name}
        forceManual={manual === "1" && !pendingActivity}
        pendingActivity={pendingActivity}
      />
    </main>
  );
}
