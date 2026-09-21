import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getPainReportsForCoach } from "@/lib/data";
import { BODY_PART_LABEL, formatActivityDate } from "@/lib/presentation";

export default async function PainReviewPage() {
  const coach = await requireCoach();
  const reports = await getPainReportsForCoach(coach.id, 30);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <Link href="/dashboard" className="text-[12.5px] text-muted">
        ← Painel do time
      </Link>
      <div>
        <div className="font-display text-[23px] font-semibold text-ink">Mapa de dor</div>
        <div className="mt-0.5 text-[12.5px] text-muted">Registros de dor de toda a equipe, mais recentes primeiro.</div>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-[12.5px] text-muted">
          Nenhum registro de dor ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5">
              <div>
                <div className="text-[13px] font-semibold text-ink">
                  {r.athleteName} · {BODY_PART_LABEL[r.bodyPart]}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {formatActivityDate(r.createdAt)}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
              </div>
              <span className="font-display text-[15px] font-semibold text-risk">{r.intensity}/10</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
