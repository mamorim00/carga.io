import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/ActivityFeed";
import { requireCoach } from "@/lib/auth";
import { getAthlete, getAthleteActivityFeed, getAthleteLoadSummary, getAthletePainReports, getWellnessHistory } from "@/lib/data";
import {
  BODY_PART_LABEL,
  SEX_LABEL,
  ZONE_LABEL,
  ZONE_NOTE,
  ZONE_STYLE,
  ageFromBirthDate,
  formatActivityDate,
  formatSports,
  isNonCompliant,
  monotonyNote,
  timeAgo,
} from "@/lib/presentation";

const WELLNESS_LABEL: Record<"sleep" | "soreness" | "mood" | "stress" | "hydration", string> = {
  sleep: "Sono",
  soreness: "Dor muscular",
  mood: "Humor",
  stress: "Estresse",
  hydration: "Hidratação",
};

function fmt(n: number | null): string {
  return n != null && Number.isFinite(n) ? n.toFixed(2) : "—";
}

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const coach = await requireCoach();
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  // notFound() rather than a 403: a coach browsing another org's athlete id
  // shouldn't learn the id is valid at all.
  if (!athlete || athlete.coachId !== coach.id) notFound();

  const [summary, activities, wellness, painReports] = await Promise.all([
    getAthleteLoadSummary(athleteId),
    getAthleteActivityFeed(athleteId, 10),
    getWellnessHistory(athleteId, 5),
    getAthletePainReports(athleteId, 5),
  ]);
  const style = summary.zone ? ZONE_STYLE[summary.zone] : { dot: "#9aa69f", border: "var(--line)", text: "#9aa69f" };
  const maxLoad = Math.max(...summary.last7Days, 1);
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  const age = ageFromBirthDate(athlete.birthDate);
  const nonCompliant = isNonCompliant(summary.lastSyncedAt);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-[12.5px] text-muted">
          ← Painel do time
        </Link>
        <div className="flex gap-3 text-[11.5px] font-semibold text-accent">
          <a href={`/api/athletes/${athleteId}/export`}>Exportar CSV</a>
          <Link href={`/dashboard/${athleteId}/print`}>Relatório (PDF)</Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[23px] font-semibold text-ink">{athlete.name}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {formatSports(athlete.sports)}
            {age != null ? ` · ${age} anos` : ""}
            {athlete.sex !== "UNSPECIFIED" ? ` · ${SEX_LABEL[athlete.sex]}` : ""} ·{" "}
            {athlete.hasWearable ? timeAgo(summary.lastSyncedAt) : "sem wearable"}
          </div>
          {nonCompliant && (
            <div
              className="mt-1.5 inline-block rounded-[3px] px-1.5 py-0.5 text-[10.5px] font-bold"
              style={{ background: "var(--risk-soft)", color: "var(--risk)" }}
            >
              Sem check-in há 3+ dias
            </div>
          )}
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
        <div className="flex gap-px overflow-hidden rounded-lg border border-line bg-line">
          <div className="flex-1 bg-surface px-4 py-3">
            <div className="text-[11px] text-muted">Monotonia</div>
            <div className="font-display mt-0.5 text-[17px] font-semibold text-ink">{fmt(summary.monotony)}</div>
          </div>
          <div className="flex-1 bg-surface px-4 py-3">
            <div className="text-[11px] text-muted">Strain</div>
            <div className="font-display mt-0.5 text-[17px] font-semibold text-ink">{fmt(summary.strain)}</div>
          </div>
        </div>
        {summary.monotony != null && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{monotonyNote(summary.monotony)}</p>
        )}
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
              <div key={w.id} className="grid grid-cols-5 gap-2 rounded-lg border border-line bg-surface px-4 py-3">
                {(["sleep", "soreness", "mood", "stress", "hydration"] as const).map((k) => (
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

      {painReports.length > 0 && (
        <div>
          <div className="mb-2 text-[13.5px] font-semibold text-ink">Mapa de dor</div>
          <div className="flex flex-col gap-2">
            {painReports.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold text-ink">{BODY_PART_LABEL[p.bodyPart]}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {formatActivityDate(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <span className="font-display text-[15px] font-semibold text-risk">{p.intensity}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
