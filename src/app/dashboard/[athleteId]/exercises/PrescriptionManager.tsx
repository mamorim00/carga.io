"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXERCISE_CATEGORY_LABEL } from "@/lib/presentation";
import type { Exercise, ExerciseCategory, ExercisePrescription } from "@/lib/types";

const CATEGORIES: ExerciseCategory[] = ["WARM_UP", "STRENGTHENING", "MOBILITY"];

export function PrescriptionManager({
  athleteId,
  library,
  prescriptions,
}: {
  athleteId: string;
  library: Exercise[];
  prescriptions: ExercisePrescription[];
}) {
  const router = useRouter();
  const [exerciseId, setExerciseId] = useState(library[0]?.id ?? "");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewExercise, setShowNewExercise] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<ExerciseCategory>("STRENGTHENING");
  const [newInstructions, setNewInstructions] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [creatingExercise, setCreatingExercise] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function prescribe(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseId) {
      setError("Selecione um exercício.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId,
          exerciseId,
          sets: sets.trim() ? Number(sets) : undefined,
          reps: reps.trim() ? Number(reps) : undefined,
          frequency: frequency.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao prescrever exercício");
      setSets("");
      setReps("");
      setFrequency("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreatingExercise(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          instructions: newInstructions.trim() || undefined,
          videoUrl: newVideoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar exercício");
      setExerciseId(data.exercise.id);
      setNewName("");
      setNewInstructions("");
      setNewVideoUrl("");
      setShowNewExercise(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingExercise(false);
    }
  }

  async function deactivate(prescriptionId: string) {
    const res = await fetch(`/api/exercises/prescriptions/${prescriptionId}/deactivate`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  async function importFromExerciseDb() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/exercises/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao importar");
      setImportResult(`${data.imported} exercícios importados, ${data.skipped} já existiam ou vieram inválidos.`);
      router.refresh();
    } catch (err) {
      setImportResult((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12.5px] font-semibold text-ink">Importar da ExerciseDB</div>
            <div className="text-[11px] text-muted">
              Traz exercícios com demonstração animada para a biblioteca inteira (compartilhada entre equipes).
              Precisa de <code>EXERCISEDB_API_KEY</code> configurada no Vercel.
            </div>
          </div>
          <button
            type="button"
            onClick={importFromExerciseDb}
            disabled={importing}
            className="flex-shrink-0 rounded-md border border-ink px-3 py-2 text-[12px] font-semibold text-ink disabled:opacity-60"
          >
            {importing ? "Importando…" : "Importar 50"}
          </button>
        </div>
        {importResult && <p className="text-[11.5px] text-muted">{importResult}</p>}
      </div>

      <form onSubmit={prescribe} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <div className="text-[13.5px] font-semibold text-ink">Prescrever exercício</div>
        {library.length === 0 ? (
          <p className="text-[12.5px] text-muted">
            A biblioteca ainda está vazia — adicione o primeiro exercício abaixo.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px]"
            >
              {library.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {EXERCISE_CATEGORY_LABEL[ex.category]} · {ex.name}
                </option>
              ))}
            </select>
            <input
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              inputMode="numeric"
              placeholder="Séries"
              className="w-20 rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px]"
            />
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              placeholder="Repetições"
              className="w-24 rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px]"
            />
            <input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Frequência (ex.: 3x/semana)"
              className="min-w-[160px] flex-1 rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px]"
            />
          </div>
        )}
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          className="rounded-md border border-line bg-paper px-2.5 py-2 text-[12.5px]"
        />
        {error && <p className="text-sm text-risk">{error}</p>}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowNewExercise((v) => !v)}
            className="text-[12px] font-semibold text-accent"
          >
            {showNewExercise ? "Cancelar novo exercício" : "+ Novo exercício na biblioteca"}
          </button>
          {library.length > 0 && (
            <button
              type="submit"
              disabled={submitting || !exerciseId}
              className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Prescrever"}
            </button>
          )}
        </div>
      </form>

      {showNewExercise && (
        <form
          onSubmit={createExercise}
          className="flex flex-col gap-2.5 rounded-lg border border-dashed border-line bg-paper p-4"
        >
          <div className="text-[12.5px] font-semibold text-ink">Novo exercício</div>
          <div className="flex flex-wrap gap-2">
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome"
              className="min-w-[160px] flex-1 rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ExerciseCategory)}
              className="rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXERCISE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            rows={2}
            placeholder="Instruções (opcional)"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
          />
          <input
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="Link de vídeo (opcional — seu próprio link de confiança)"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px]"
          />
          <button
            type="submit"
            disabled={creatingExercise || !newName.trim()}
            className="self-start rounded-md border border-ink px-3 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-60"
          >
            {creatingExercise ? "Salvando…" : "Adicionar à biblioteca"}
          </button>
        </form>
      )}

      <div>
        <div className="mb-2 text-[13.5px] font-semibold text-ink">
          Prescrições ativas {prescriptions.length > 0 && `(${prescriptions.length})`}
        </div>
        {prescriptions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center text-[12.5px] text-muted">
            Nenhum exercício prescrito ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {prescriptions.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{p.exercise.name}</span>
                    <span className="rounded-[3px] bg-[#f1eee3] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                      {EXERCISE_CATEGORY_LABEL[p.exercise.category]}
                    </span>
                  </div>
                  <div className="truncate text-[11.5px] text-muted">
                    {[p.sets != null && p.reps != null ? `${p.sets}x${p.reps}` : null, p.frequency]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · "}
                    {p.completedLast7Days}/7 dias esta semana
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deactivate(p.id)}
                  className="flex-shrink-0 text-[11.5px] font-semibold text-risk"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
