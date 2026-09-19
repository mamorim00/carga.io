"use client";

import { useState } from "react";

/**
 * Stands in for a real Strava "pull now" until OAuth sync exists (see
 * docs/mvp-tasks.md, item 5) — same honest-about-being-simulated pattern as
 * the "Conectar com Strava" button on /onboarding. No backend call: there's
 * nothing real to trigger yet, and faking a successful sync would create a
 * false impression without creating any real data to back it up.
 */
export function ResyncButton() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setClicked(true)}
        className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5"
      >
        <span className="text-[13px] font-medium text-ink">Sincronizar agora</span>
        <span className="text-muted">↻</span>
      </button>
      {clicked && (
        <p className="text-[11px] leading-relaxed text-muted">
          Simulado por enquanto — a integração real com o Strava ainda não está pronta. Isso vai puxar as
          atividades novas automaticamente assim que estiver.
        </p>
      )}
    </div>
  );
}
