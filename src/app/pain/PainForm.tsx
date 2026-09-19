"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BodyMap } from "@/components/BodyMap";
import type { BodyPart } from "@/lib/types";

export function PainForm() {
  const router = useRouter();
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyPart) {
      setError("Toque em uma região do corpo.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyPart, intensity, note: note.trim() || undefined }),
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
      <BodyMap selected={bodyPart} onSelect={setBodyPart} />

      <div>
        <div className="mb-0.5 flex items-baseline justify-between">
          <span className="text-[15px] font-bold text-ink">Intensidade</span>
          <span className="font-display text-[22px] font-semibold text-accent">{intensity}</span>
        </div>
        <div className="mb-2 text-xs text-muted">0 = nenhuma dor · 10 = a pior dor possível</div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Intensidade ${n}`}
              onClick={() => setIntensity(n)}
              className="h-8 flex-1 cursor-pointer rounded-md border transition-colors"
              style={
                n <= intensity
                  ? { background: "var(--risk)", borderColor: "var(--risk)" }
                  : { background: "var(--surface)", borderColor: "var(--line)" }
              }
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Nota (opcional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Quando começou, o que piora, o que ajuda…"
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
      </label>

      {error && <p className="text-sm text-risk">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-ink px-4 py-3.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Registrar dor"}
      </button>
    </form>
  );
}
