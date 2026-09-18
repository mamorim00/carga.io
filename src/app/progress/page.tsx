import Link from "next/link";
import { getAthlete, getAthleteLoadSummary, getDemoAthleteId } from "@/lib/data";

const ZONE_COPY: Record<string, { label: string; note: string }> = {
  IDEAL: { label: "Zona ideal", note: "Carga aguda equilibrada com a crônica. Siga a progressão da semana." },
  ATTENTION: { label: "Atenção", note: "Carga se afastando da faixa ideal. Vale monitorar de perto." },
  RISK: { label: "Risco elevado", note: "ACWR acima do recomendado. Considere reduzir volume esta semana." },
};

export default async function ProgressPage() {
  const athleteId = getDemoAthleteId();
  const athlete = getAthlete(athleteId)!;
  const summary = getAthleteLoadSummary(athleteId);
  const zone = summary.zone ? ZONE_COPY[summary.zone] : null;

  const maxLoad = Math.max(...summary.last7Days, 1);
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-paper px-6 pt-6 pb-8">
      <div>
        <div className="text-[12.5px] text-muted">Olá, {athlete.name.split(" ")[0]}</div>
        <div className="font-display text-[23px] font-semibold text-ink">Seu progresso</div>
      </div>

      <div className="flex items-center gap-5 rounded-lg bg-ink p-5">
        <div className="flex flex-col items-center">
          <span className="font-display text-[22px] font-semibold text-paper">
            {summary.acwr ? summary.acwr.toFixed(2) : "—"}
          </span>
          <span className="text-[9px] tracking-wide text-[#8b8878]">ACWR</span>
        </div>
        <div>
          <div className="text-[12.5px] font-bold text-[#7fc79b]">{zone?.label ?? "Coletando dados"}</div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-[#8b8878]">
            {zone?.note ?? "Precisamos de mais dias de histórico para calcular seu ACWR."}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-ink">Carga semanal</span>
          <span className="text-[11px] text-muted">últimos 7 dias</span>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4.5">
          <div className="flex h-[70px] items-end justify-between">
            {summary.last7Days.map((load, i) => (
              <div key={i} className="flex w-6 flex-col items-center gap-1.5">
                <div
                  className="w-3 rounded-sm bg-ink"
                  style={{ height: Math.max(4, (load / maxLoad) * 70) }}
                />
                <span className="text-[10px] text-muted">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        href="/checkin"
        className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5"
      >
        <span className="text-[13px] font-medium text-ink">Fazer novo check-in</span>
        <span className="text-muted">→</span>
      </Link>
    </main>
  );
}
