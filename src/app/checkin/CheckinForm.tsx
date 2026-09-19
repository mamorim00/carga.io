"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Activity } from "@/lib/types";

const RPE_LABELS: Record<number, string> = {
  1: "muito leve",
  2: "leve",
  3: "leve",
  4: "moderado",
  5: "moderado",
  6: "difícil",
  7: "difícil",
  8: "muito difícil",
  9: "muito difícil",
  10: "máximo",
};

function Scale({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2.5 flex justify-between">
        <span className="text-[13px] text-[#4a473c]">{label}</span>
        <span className="text-[12.5px] font-semibold text-ink">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} de 5`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className="h-8 flex-1 cursor-pointer rounded-md border transition-colors"
            style={
              n <= value
                ? { background: color, borderColor: color }
                : { background: "var(--surface)", borderColor: "var(--line)" }
            }
          />
        ))}
      </div>
    </div>
  );
}

export function CheckinForm({
  athleteId,
  athleteName,
  forceManual,
  pendingActivity,
}: {
  athleteId: string;
  athleteName: string;
  forceManual: boolean;
  pendingActivity: Activity | null;
}) {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(pendingActivity);
  const [showManualForm, setShowManualForm] = useState(forceManual);
  const [duration, setDuration] = useState(45);
  const [distance, setDistance] = useState(8);
  const [rpe, setRpe] = useState(6);
  const [sleep, setSleep] = useState(4);
  const [soreness, setSoreness] = useState(2);
  const [mood, setMood] = useState(4);
  const [stress, setStress] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logManualActivity() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activities/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, durationMin: duration, distanceKm: distance }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao registrar treino");
      const { activity: created } = await res.json();
      setActivity(created);
      setShowManualForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCheckin() {
    if (!activity) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, activityId: activity.id, rpe, sleep, soreness, mood, stress }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao enviar check-in");
      router.push("/progress");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!activity || showManualForm) {
    return (
      <div className="flex flex-grow flex-col gap-5 px-6 py-6">
        <p className="text-sm text-muted">
          Olá, {athleteName.split(" ")[0]}. Sem relógio conectado, é só nos contar o que você treinou — o check-in
          de esforço e bem-estar funciona igual.
        </p>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Duração (minutos)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Distância (km, opcional)
          <input
            type="number"
            min={0}
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          />
        </label>
        {error && <p className="text-sm text-risk">{error}</p>}
        <button
          type="button"
          disabled={submitting}
          onClick={logManualActivity}
          className="mt-2 rounded-md bg-ink px-4 py-3.5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {submitting ? "Registrando…" : "Continuar para o check-in"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-grow flex-col gap-6 px-6 py-6">
      <div className="flex items-center gap-3.5 rounded-lg border border-line px-4 py-3.5">
        <div>
          <div className="text-sm font-semibold text-ink">
            {activity.source === "MANUAL" ? "Treino registrado manualmente" : "Corrida · sincronizado"}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {activity.distanceKm ? `${activity.distanceKm} km · ` : ""}
            {activity.durationMin} min
          </div>
        </div>
      </div>

      <div>
        <div className="mb-0.5 flex items-baseline justify-between">
          <span className="text-[15px] font-bold text-ink">Como foi o esforço?</span>
          <span className="font-display text-[22px] font-semibold text-accent">{rpe}</span>
        </div>
        <div className="mb-4 text-xs text-muted">Escala de Foster (CR-10) · {RPE_LABELS[rpe]}</div>
        <div className="flex h-14 items-end gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`RPE ${n}`}
              onClick={() => setRpe(n)}
              className="flex-grow rounded-t-sm"
              style={{ height: 16 + n * 4, background: rpe >= n ? "var(--ink)" : "#dedacb" }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4.5">
        <div className="text-[15px] font-bold text-ink">Bem-estar rápido</div>
        <Scale label="Qualidade do sono" value={sleep} onChange={setSleep} color="var(--ok)" />
        <Scale label="Dor muscular" value={soreness} onChange={setSoreness} color="var(--warn)" />
        <Scale label="Humor" value={mood} onChange={setMood} color="#3b6fa0" />
        <Scale label="Estresse" value={stress} onChange={setStress} color="var(--risk)" />
      </div>

      {error && <p className="text-sm text-risk">{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={submitCheckin}
        className="mt-auto rounded-md bg-ink px-4 py-4 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar check-in"}
      </button>
    </div>
  );
}
