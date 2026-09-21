"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXERCISE_CATEGORY_LABEL } from "@/lib/presentation";
import type { ExercisePrescription } from "@/lib/types";

export function ExerciseChecklist({ prescriptions }: { prescriptions: ExercisePrescription[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(p: ExercisePrescription) {
    setPending(p.id);
    try {
      const res = await fetch("/api/exercises/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId: p.id, done: !p.doneToday }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (prescriptions.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-6 text-center text-[12.5px] text-muted">
        Nenhum exercício prescrito ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {prescriptions.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => toggle(p)}
            disabled={pending === p.id}
            aria-pressed={p.doneToday}
            aria-label={p.doneToday ? "Marcar como não feito hoje" : "Marcar como feito hoje"}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-[13px] font-bold disabled:opacity-60"
            style={
              p.doneToday
                ? { background: "var(--ok)", borderColor: "var(--ok)", color: "var(--paper)" }
                : { background: "var(--paper)", borderColor: "var(--line)", color: "transparent" }
            }
          >
            ✓
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">{p.exercise.name}</span>
              <span className="rounded-[3px] bg-[#f1eee3] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                {EXERCISE_CATEGORY_LABEL[p.exercise.category]}
              </span>
            </div>
            <div className="truncate text-[11.5px] text-muted">
              {[
                p.sets != null && p.reps != null ? `${p.sets}x${p.reps}` : null,
                p.frequency,
                p.exercise.instructions,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {p.exercise.videoUrl && (
              <a
                href={p.exercise.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-accent"
              >
                Ver demonstração
              </a>
            )}
          </div>
          <span className="flex-shrink-0 text-[10.5px] text-muted">{p.completedLast7Days}/7 dias</span>
        </div>
      ))}
    </div>
  );
}
