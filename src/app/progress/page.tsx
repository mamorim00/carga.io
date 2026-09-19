import Link from "next/link";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LogoutButton } from "@/components/LogoutButton";
import { ResyncButton } from "@/components/ResyncButton";
import { requireAthlete } from "@/lib/auth";
import { getAthleteActivityFeed, getAthleteLoadSummary, getWellnessHistory } from "@/lib/data";
import { wellnessComposite } from "@/lib/metrics";
import { ZONE_LABEL, ZONE_NOTE, monotonyNote } from "@/lib/presentation";

/** Guards against Infinity (metrics.monotony() when a week's loads have zero variance). */
function fmt(n: number | null): string {
  return n != null && Number.isFinite(n) ? n.toFixed(2) : "—";
}

export default async function ProgressPage() {
  const athlete = await requireAthlete();
  const [summary, activities, wellnessHistory] = await Promise.all([
    getAthleteLoadSummary(athlete.id),
    getAthleteActivityFeed(athlete.id, 5),
    getWellnessHistory(athlete.id, 1),
  ]);
  const [latestWellness] = wellnessHistory;
  const zone = summary.zone
    ? { label: ZONE_LABEL[summary.zone], note: ZONE_NOTE[summary.zone] }
    : null;

  const maxLoad = Math.max(...summary.last7Days, 1);
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-paper px-6 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12.5px] text-muted">Olá, {athlete.name.split(" ")[0]}</div>
          <div className="font-display text-[23px] font-semibold text-ink">Seu progresso</div>
        </div>
        <LogoutButton className="text-[11px] font-semibold text-muted" />
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

      <div className="flex gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="flex-1 bg-surface px-4 py-3">
          <div className="text-[11px] text-muted">Monotonia</div>
          <div className="font-display mt-0.5 text-[17px] font-semibold text-ink">{fmt(summary.monotony)}</div>
        </div>
        <div className="flex-1 bg-surface px-4 py-3">
          <div className="text-[11px] text-muted">Strain</div>
          <div className="font-display mt-0.5 text-[17px] font-semibold text-ink">{fmt(summary.strain)}</div>
        </div>
        {latestWellness && (
          <div className="flex-1 bg-surface px-4 py-3">
            <div className="text-[11px] text-muted">Bem-estar</div>
            <div className="font-display mt-0.5 text-[17px] font-semibold text-ink">
              {wellnessComposite(latestWellness).toFixed(1)}/5
            </div>
          </div>
        )}
      </div>
      {summary.monotony != null && (
        <p className="-mt-2 text-[11px] leading-relaxed text-muted">{monotonyNote(summary.monotony)}</p>
      )}

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

      <div className="flex gap-2">
        <Link
          href="/checkin"
          className="flex flex-1 items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5"
        >
          <span className="text-[13px] font-medium text-ink">Fazer novo check-in</span>
          <span className="text-muted">→</span>
        </Link>
        <Link
          href="/pain"
          className="flex flex-1 items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5"
        >
          <span className="text-[13px] font-medium text-ink">Registrar dor</span>
          <span className="text-muted">→</span>
        </Link>
      </div>

      {athlete.sex === "FEMALE" && (
        <Link
          href="/cycle"
          className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5"
        >
          <span className="text-[13px] font-medium text-ink">Registrar ciclo</span>
          <span className="text-muted">→</span>
        </Link>
      )}

      {athlete.hasWearable && <ResyncButton />}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-ink">Atividades recentes</span>
          <span className="text-[11px] text-muted">duração, distância e FC</span>
        </div>
        <ActivityFeed activities={activities} />
      </div>
    </main>
  );
}
