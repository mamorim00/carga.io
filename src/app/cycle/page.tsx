import Link from "next/link";
import { requireAthlete } from "@/lib/auth";
import { getAthleteCycleLogs } from "@/lib/data";
import { FLOW_LABEL, PHASE_LABEL, SYMPTOM_LABEL, formatActivityDate } from "@/lib/presentation";
import { CycleForm } from "./CycleForm";

export default async function CyclePage() {
  const athlete = await requireAthlete();
  const logs = await getAthleteCycleLogs(athlete.id, 5);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <span className="font-display text-lg font-semibold text-ink">Ciclo menstrual</span>
        <Link href="/progress" className="text-[12.5px] text-muted">
          ← Progresso
        </Link>
      </div>
      <CycleForm />
      {logs.length > 0 && (
        <div className="flex flex-col gap-2 px-6 pb-6">
          <div className="text-[13.5px] font-semibold text-ink">Registros recentes</div>
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">{formatActivityDate(l.date)}</span>
                <span className="text-[11.5px] text-muted">{FLOW_LABEL[l.flow]}</span>
              </div>
              {(l.phase || l.symptoms.length > 0) && (
                <div className="mt-0.5 text-[11px] text-muted">
                  {l.phase ? PHASE_LABEL[l.phase] : ""}
                  {l.phase && l.symptoms.length > 0 ? " · " : ""}
                  {l.symptoms.map((s) => SYMPTOM_LABEL[s]).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
