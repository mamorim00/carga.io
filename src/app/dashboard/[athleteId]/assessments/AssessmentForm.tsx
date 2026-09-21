"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MEASUREMENT_CATEGORY_LABEL } from "@/lib/presentation";
import type { AssessmentKind, MeasurementCategory } from "@/lib/types";

const KINDS: { value: AssessmentKind; label: string }[] = [
  { value: "INITIAL", label: "Avaliação inicial" },
  { value: "FOLLOW_UP", label: "Reavaliação" },
];

const CATEGORIES: MeasurementCategory[] = ["ROM", "STRENGTH", "MOVEMENT_QUALITY"];

interface MeasurementRow {
  category: MeasurementCategory;
  label: string;
  value: string;
  unit: string;
  note: string;
}

function emptyRow(): MeasurementRow {
  return { category: "ROM", label: "", value: "", unit: "", note: "" };
}

export function AssessmentForm({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<AssessmentKind>("FOLLOW_UP");
  const [rows, setRows] = useState<MeasurementRow[]>([emptyRow()]);
  const [examsNote, setExamsNote] = useState("");
  const [medicationsNote, setMedicationsNote] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<MeasurementRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const measurements = rows
        .filter((r) => r.label.trim())
        .map((r) => ({
          category: r.category,
          label: r.label.trim(),
          value: r.value.trim() ? Number(r.value) : null,
          unit: r.unit.trim() || null,
          note: r.note.trim() || undefined,
        }));
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId,
          kind,
          examsNote: examsNote.trim() || undefined,
          medicationsNote: medicationsNote.trim() || undefined,
          generalNote: generalNote.trim() || undefined,
          measurements,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao registrar avaliação");
      setRows([emptyRow()]);
      setExamsNote("");
      setMedicationsNote("");
      setGeneralNote("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-ink">Nova avaliação</span>
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={
                kind === k.value
                  ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }
                  : { background: "var(--paper)", borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink">Medidas</span>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-paper p-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={row.category}
                onChange={(e) => updateRow(i, { category: e.target.value as MeasurementCategory })}
                className="rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MEASUREMENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <input
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="Ex.: Flexão de joelho direito"
                className="min-w-[160px] flex-1 rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
              />
              <input
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                inputMode="decimal"
                placeholder="Valor"
                className="w-20 rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
              />
              <input
                value={row.unit}
                onChange={(e) => updateRow(i, { unit: e.target.value })}
                placeholder="Unidade"
                className="w-24 rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remover medida"
                  className="rounded-md px-2 text-[12.5px] font-semibold text-risk"
                >
                  Remover
                </button>
              )}
            </div>
            <input
              value={row.note}
              onChange={(e) => updateRow(i, { note: e.target.value })}
              placeholder="Nota (opcional)"
              className="rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="self-start text-[12.5px] font-semibold text-accent"
        >
          + Adicionar medida
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Exames (opcional)
        <textarea
          value={examsNote}
          onChange={(e) => setExamsNote(e.target.value)}
          rows={2}
          placeholder="Exames relevantes relatados ou anexados — só texto por enquanto, sem upload de arquivo"
          className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Medicamentos (opcional)
        <textarea
          value={medicationsNote}
          onChange={(e) => setMedicationsNote(e.target.value)}
          rows={2}
          className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Observações gerais (opcional)
        <textarea
          value={generalNote}
          onChange={(e) => setGeneralNote(e.target.value)}
          rows={2}
          className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>

      {error && <p className="text-sm text-risk">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Registrar avaliação"}
      </button>
    </form>
  );
}
