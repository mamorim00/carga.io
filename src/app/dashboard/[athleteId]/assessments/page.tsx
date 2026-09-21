import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getAthlete, getAthleteAssessments } from "@/lib/data";
import { ASSESSMENT_KIND_LABEL, MEASUREMENT_CATEGORY_LABEL, formatActivityDate } from "@/lib/presentation";
import { AssessmentForm } from "./AssessmentForm";

export default async function AthleteAssessmentsPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const coach = await requireCoach();
  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) notFound();

  const assessments = await getAthleteAssessments(athleteId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <Link href={`/dashboard/${athleteId}`} className="text-[12.5px] text-muted">
        ← {athlete.name}
      </Link>
      <div>
        <div className="font-display text-[23px] font-semibold text-ink">Avaliações</div>
        <div className="mt-0.5 text-[12.5px] text-muted">
          Avaliação inicial e reavaliações — amplitude de movimento, força, qualidade de movimento, exames e
          medicamentos.
        </div>
      </div>

      <AssessmentForm athleteId={athleteId} />

      <div>
        <div className="mb-2 text-[13.5px] font-semibold text-ink">
          Histórico {assessments.length > 0 && `(${assessments.length})`}
        </div>
        {assessments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-[12.5px] text-muted">
            Nenhuma avaliação registrada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {assessments.map((a) => (
              <div key={a.id} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">{ASSESSMENT_KIND_LABEL[a.kind]}</span>
                  <span className="text-[11.5px] text-muted">{formatActivityDate(a.date)}</span>
                </div>
                {a.measurements.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {a.measurements.map((m) => (
                      <div key={m.id} className="flex items-baseline justify-between text-[12px]">
                        <span className="text-ink">
                          <span className="text-muted">{MEASUREMENT_CATEGORY_LABEL[m.category]} · </span>
                          {m.label}
                          {m.note ? ` — ${m.note}` : ""}
                        </span>
                        {m.value != null && (
                          <span className="flex-shrink-0 font-semibold text-ink">
                            {m.value}
                            {m.unit ? ` ${m.unit}` : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(a.examsNote || a.medicationsNote || a.generalNote) && (
                  <div className="flex flex-col gap-0.5 border-t border-[#f1eee3] pt-2 text-[11.5px] text-muted">
                    {a.examsNote && <div>Exames: {a.examsNote}</div>}
                    {a.medicationsNote && <div>Medicamentos: {a.medicationsNote}</div>}
                    {a.generalNote && <div>Obs.: {a.generalNote}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
