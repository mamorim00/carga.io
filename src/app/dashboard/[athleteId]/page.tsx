import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getAthlete, getAthleteActivityFeed, getAthleteLoadSummary, getWellnessHistory } from "@/lib/data";
import { ZONE_LABEL, ZONE_NOTE, ZONE_STYLE, timeAgo } from "@/lib/presentation";

const SPORT_LABEL: Record<string, string> = {
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  TRIATHLON: "Triatlo",
  OTHER: "Outro",
};

const WELLNESS_LABEL: Record<"sleep" | "soreness" | "mood" | "stress", string> = {
  sleep: "Sono",
  soreness: "Dor muscular",
  mood: "Humor",
  stress: "Estresse",
};

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const athlete = getAthlete(athleteId);
  if (!athlete) notFound();

  const summary = getAthleteLoadSummary(athleteId);
  const activities = getAthleteActivityFeed(athleteId, 10);
  const wellness = getWellnessHistory(athleteId, 5);
  const style = summary.zone ? ZONE_STYLE[summary.zone] : { dot: "#9aa69f", border: "var(--line)", text: "#9aa69f" };
  const maxLoad = Math.max(...summary.last7Days, 1);
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <Link href="/dashboard" className="text-[12.5px] text-muted">
        ← Painel do time
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[23px] font-semibold text-ink">{athlete.name}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {SPORT_LABEL[athlete.sport] ?? athlete.sport} · {athlete.hasWearable ? timeAgo(summary.lastSyncedAt) : "sem wearable"}
          </div>
        </div>
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: style.dot }} />
      </div>

      <div className="flex items-center gap-5 rounded-lg bg-ink p-5">
        <div className="flex flex-col items-center">
          <span className="font-display text-[22px] font-semibold text-paper">
            {summary.acwr ? summary.acwr.toFixed(2) : "—"}
          </span>
          <span className="text-[9px] tracking-wide text-[#8b8878]">ACWR</span>
        </div>
        <div>
          <div className="text-[12.5px] font-bold" style={{ color: style.text }}>
            {summary.zone ? ZONE_LABEL[summary.zone] : "Coletando dados"}
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed text-[#8b8878]">
            {summary.zone ? ZONE_NOTE[summary.zone] : "Precisamos de mais dias de histórico para calcular o ACWR."}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-ink">Carga semanal</span>
          <span className="text-[11px] text-muted">{summary.weeklyLoad} UA · últimos 7 dias</span>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4.5">
          <div className="flex h-[70px] items-end justify-between">
            {summary.last7Days.map((load, i) => (
              <div key={i} className="flex w-6 flex-col items-center gap-1.5">
                <div className="w-3 rounded-sm bg-ink" style={{ height: Math.max(4, (load / maxLoad) * 70) }} />
                <span className="text-[10px] text-muted">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-ink">Atividades recentes</span>
          <span className="text-[11px] text-muted">duração, distância e FC</span>
        </div>
        <ActivityFeed activities={activities} />
      </div>

      {wellness.length > 0 && (
        <div>
          <div className="mb-2 text-[13.5px] font-semibold text-ink">Bem-estar recente</div>
          <div className="flex flex-col gap-2">
            {wellness.map((w) => (
              <div key={w.id} className="grid grid-cols-4 gap-2 rounded-lg border border-line bg-surface px-4 py-3">
                {(["sleep", "soreness", "mood", "stress"] as const).map((k) => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <span className="font-display text-[15px] font-semibold text-ink">{w[k]}</span>
                    <span className="text-[9.5px] text-muted">{WELLNESS_LABEL[k]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
