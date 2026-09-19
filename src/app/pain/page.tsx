import Link from "next/link";
import { requireAthlete } from "@/lib/auth";
import { getAthletePainReports } from "@/lib/data";
import { BODY_PART_LABEL, formatActivityDate } from "@/lib/presentation";
import { PainForm } from "./PainForm";

export default async function PainPage() {
  const athlete = await requireAthlete();
  const reports = await getAthletePainReports(athlete.id, 5);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <span className="font-display text-lg font-semibold text-ink">Mapa de dor</span>
        <Link href="/progress" className="text-[12.5px] text-muted">
          ← Progresso
        </Link>
      </div>
      <PainForm />
      {reports.length > 0 && (
        <div className="flex flex-col gap-2 px-6 pb-6">
          <div className="text-[13.5px] font-semibold text-ink">Registros recentes</div>
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">{BODY_PART_LABEL[r.bodyPart]}</span>
                <span className="font-display text-[15px] font-semibold text-risk">{r.intensity}/10</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {formatActivityDate(r.createdAt)}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
