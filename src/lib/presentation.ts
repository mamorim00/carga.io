// Display-only helpers shared across the athlete and coach views: copy,
// colors and formatting for the same handful of domain concepts (ACWR zone,
// activity source, relative dates). Kept separate from lib/data.ts because
// none of this is queried or persisted — it only shapes what's already read.

import type { AcwrZone, ActivitySource, Sport } from "./types";

export const SPORT_LABEL: Record<Sport, string> = {
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  TRIATHLON: "Triatlo",
  OTHER: "Outro",
};

export const ZONE_LABEL: Record<AcwrZone, string> = {
  IDEAL: "Zona ideal",
  ATTENTION: "Atenção",
  RISK: "Risco elevado",
};

export const ZONE_NOTE: Record<AcwrZone, string> = {
  IDEAL: "Carga aguda equilibrada com a crônica. Siga a progressão da semana.",
  ATTENTION: "Carga se afastando da faixa ideal. Vale monitorar de perto.",
  RISK: "ACWR acima do recomendado. Considere reduzir volume esta semana.",
};

export const ZONE_STYLE: Record<AcwrZone, { dot: string; border: string; text: string }> = {
  IDEAL: { dot: "var(--ok)", border: "var(--line)", text: "var(--ok)" },
  ATTENTION: { dot: "var(--warn)", border: "#ebd2a6", text: "var(--warn)" },
  RISK: { dot: "var(--risk)", border: "#e3b7b3", text: "var(--risk)" },
};

export const SOURCE_LABEL: Record<ActivitySource, string> = {
  STRAVA: "Strava",
  GARMIN: "Garmin",
  APPLE_HEALTH: "Apple Health",
  MANUAL: "Manual",
};

/** Relative "last synced" phrasing used on roster cards and athlete headers. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "nunca sincronizou";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "há poucos min";
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** Short absolute date for activity feed rows, e.g. "12 mar". */
export function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
