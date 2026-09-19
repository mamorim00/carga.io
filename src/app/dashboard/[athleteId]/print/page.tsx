import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getAthlete, getAthleteExportRows, getAthleteLoadSummary } from "@/lib/data";
import { SOURCE_LABEL, ZONE_LABEL, formatActivityDate, formatSports } from "@/lib/presentation";
import { PrintButton } from "./PrintButton";

// A print stylesheet rather than a PDF library: no new dependency, and the
// browser's own "Print > Save as PDF" produces a perfectly real PDF from
// this same markup. See docs/mvp-tasks.md, item 3.
export default async function AthletePrintReportPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const coach = await requireCoach();
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) notFound();

  const [summary, rows] = await Promise.all([getAthleteLoadSummary(athleteId), getAthleteExportRows(athleteId)]);

  return (
    <main className="mx-auto max-w-3xl bg-paper px-8 py-8 text-ink print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/dashboard/${athleteId}`} className="text-[12.5px] text-muted">
          ← Voltar
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div>
          <div className="font-display text-[22px] font-semibold text-ink">{athlete.name}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">{formatSports(athlete.sports)}</div>
        </div>
        <div className="text-right text-[11px] text-muted">
          Relatório de carga
          <br />
          {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="font-display text-[20px] font-semibold text-ink">
            {summary.acwr ? summary.acwr.toFixed(2) : "—"}
          </div>
          <div className="text-[10.5px] text-muted">ACWR ({summary.zone ? ZONE_LABEL[summary.zone] : "—"})</div>
        </div>
        <div>
          <div className="font-display text-[20px] font-semibold text-ink">
            {summary.monotony != null && Number.isFinite(summary.monotony) ? summary.monotony.toFixed(2) : "—"}
          </div>
          <div className="text-[10.5px] text-muted">Monotonia</div>
        </div>
        <div>
          <div className="font-display text-[20px] font-semibold text-ink">
            {summary.strain != null && Number.isFinite(summary.strain) ? summary.strain.toFixed(0) : "—"}
          </div>
          <div className="text-[10.5px] text-muted">Strain</div>
        </div>
        <div>
          <div className="font-display text-[20px] font-semibold text-ink">{summary.weeklyLoad}</div>
          <div className="text-[10.5px] text-muted">Carga semanal (UA)</div>
        </div>
      </div>

      <div className="text-[13.5px] font-semibold text-ink">Histórico de atividades</div>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1.5 pr-2 font-medium">Data</th>
            <th className="py-1.5 pr-2 font-medium">Origem</th>
            <th className="py-1.5 pr-2 font-medium">Min</th>
            <th className="py-1.5 pr-2 font-medium">Km</th>
            <th className="py-1.5 pr-2 font-medium">RPE</th>
            <th className="py-1.5 pr-2 font-medium">Carga</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-muted">
                Nenhuma atividade registrada ainda.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-[#f1eee3]">
                <td className="py-1.5 pr-2">{formatActivityDate(r.date)}</td>
                <td className="py-1.5 pr-2">{SOURCE_LABEL[r.source]}</td>
                <td className="py-1.5 pr-2">{r.durationMin}</td>
                <td className="py-1.5 pr-2">{r.distanceKm ?? "—"}</td>
                <td className="py-1.5 pr-2">{r.rpe ?? "—"}</td>
                <td className="py-1.5 pr-2">{r.combinedLoad != null ? Math.round(r.combinedLoad) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
