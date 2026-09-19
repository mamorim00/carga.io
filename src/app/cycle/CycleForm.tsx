"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FLOW_LABEL, PHASE_LABEL, SYMPTOM_LABEL } from "@/lib/presentation";
import { CYCLE_SYMPTOMS, type CycleFlow, type CyclePhase, type CycleSymptom } from "@/lib/types";

const FLOWS: CycleFlow[] = ["NONE", "LIGHT", "MEDIUM", "HEAVY"];
const PHASES: CyclePhase[] = ["MENSTRUAL", "FOLLICULAR", "OVULATION", "LUTEAL"];

export function CycleForm() {
  const router = useRouter();
  const [flow, setFlow] = useState<CycleFlow>("NONE");
  const [phase, setPhase] = useState<CyclePhase | "">("");
  const [symptoms, setSymptoms] = useState<CycleSymptom[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSymptom(s: CycleSymptom) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, phase: phase || null, symptoms }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao registrar");
      router.push("/progress");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-6">
      <div>
        <div className="mb-2 text-[13px] font-medium text-ink">Fluxo hoje</div>
        <div className="flex gap-1.5">
          {FLOWS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={flow === f}
              onClick={() => setFlow(f)}
              className="flex-1 rounded-md border px-2 py-2.5 text-[12.5px] font-medium"
              style={
                flow === f
                  ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }
                  : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              {FLOW_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium text-ink">Fase (se souber, opcional)</div>
        <div className="flex flex-wrap gap-1.5">
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setPhase((prev) => (prev === p ? "" : p))}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={
                phase === p
                  ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }
                  : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium text-ink">Sintomas (opcional)</div>
        <div className="flex flex-wrap gap-1.5">
          {CYCLE_SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={symptoms.includes(s)}
              onClick={() => toggleSymptom(s)}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={
                symptoms.includes(s)
                  ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }
                  : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              {SYMPTOM_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-risk">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-ink px-4 py-3.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Registrar"}
      </button>
    </form>
  );
}
