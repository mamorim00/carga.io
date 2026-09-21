// Display-only helpers shared across the athlete and coach views: copy,
// colors and formatting for the same handful of domain concepts (ACWR zone,
// activity source, relative dates). Kept separate from lib/data.ts because
// none of this is queried or persisted — it only shapes what's already read.

import type {
  AcwrZone,
  ActivitySource,
  AssessmentKind,
  BodyPart,
  CycleFlow,
  CyclePhase,
  CycleSymptom,
  ExerciseCategory,
  MeasurementCategory,
  Sex,
  Sport,
} from "./types";

export const SPORT_LABEL: Record<Sport, string> = {
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  TRIATHLON: "Triatlo",
  OTHER: "Outro",
};

/** "Corrida" · "Corrida e ciclismo" · "Corrida, ciclismo e triatlo" — never empty; falls back to "—". */
export function formatSports(sports: Sport[]): string {
  const labels = sports.map((s) => SPORT_LABEL[s]);
  if (labels.length === 0) return "—";
  if (labels.length === 1) return labels[0];
  // Only the first label keeps its standalone-label capitalization; the
  // rest read as a lowercase running list, same as "Corrida e ciclismo".
  const lower = labels.map((l, i) => (i === 0 ? l : l.toLowerCase()));
  return `${lower.slice(0, -1).join(", ")} e ${lower[lower.length - 1]}`;
}

export const SEX_LABEL: Record<Sex, string> = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  UNSPECIFIED: "Prefere não dizer",
};

/** Age in years from an ISO birth date, as of today; null if there's no birth date yet. */
export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  HEAD: "Cabeça",
  NECK: "Pescoço",
  SHOULDER_L: "Ombro esquerdo",
  SHOULDER_R: "Ombro direito",
  CHEST: "Peito",
  ABDOMEN: "Abdômen",
  ARM_L: "Braço esquerdo",
  ARM_R: "Braço direito",
  HIP_L: "Quadril esquerdo",
  HIP_R: "Quadril direito",
  THIGH_L: "Coxa esquerda",
  THIGH_R: "Coxa direita",
  KNEE_L: "Joelho esquerdo",
  KNEE_R: "Joelho direito",
  LOWER_LEG_L: "Perna esquerda (canela/panturrilha)",
  LOWER_LEG_R: "Perna direita (canela/panturrilha)",
  UPPER_BACK: "Parte superior das costas",
  LOWER_BACK: "Lombar",
};

export const FLOW_LABEL: Record<CycleFlow, string> = {
  NONE: "Sem fluxo",
  LIGHT: "Leve",
  MEDIUM: "Moderado",
  HEAVY: "Intenso",
};

export const PHASE_LABEL: Record<CyclePhase, string> = {
  MENSTRUAL: "Menstrual",
  FOLLICULAR: "Folicular",
  OVULATION: "Ovulação",
  LUTEAL: "Lútea",
};

export const SYMPTOM_LABEL: Record<CycleSymptom, string> = {
  CRAMPS: "Cólica",
  FATIGUE: "Fadiga",
  HEADACHE: "Dor de cabeça",
  BLOATING: "Inchaço",
  MOOD_SWINGS: "Alteração de humor",
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

// No specific threshold appears in the sports-science literature the rest of
// this app cites (ACWR, monotony) — 3 days is this app's own choice, matching
// the number already floated for it in docs/mvp-tasks.md.
const NON_COMPLIANCE_THRESHOLD_DAYS = 3;

/** True once an athlete has gone NON_COMPLIANCE_THRESHOLD_DAYS+ without a synced or logged activity. */
export function isNonCompliant(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const days = (Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000;
  return days >= NON_COMPLIANCE_THRESHOLD_DAYS;
}

// Foster's own monotony scale doesn't have a single official cutoff the way
// ACWR's 0.8–1.3 band does — 2.0 is the threshold most commonly cited in the
// sports-science literature as where low day-to-day variation itself starts
// to matter, so it's what this app flags on.
const MONOTONY_RISK_THRESHOLD = 2;

/** Short note on whether the week's day-to-day load variation is itself a risk factor. */
export function monotonyNote(value: number): string {
  return value >= MONOTONY_RISK_THRESHOLD
    ? "Alta: pouca variação de carga na semana — um fator de risco à parte do volume."
    : "Boa variação de carga ao longo da semana.";
}

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = {
  INITIAL: "Avaliação inicial",
  FOLLOW_UP: "Reavaliação",
};

export const MEASUREMENT_CATEGORY_LABEL: Record<MeasurementCategory, string> = {
  ROM: "Amplitude de movimento",
  STRENGTH: "Força",
  MOVEMENT_QUALITY: "Qualidade de movimento",
};

export const EXERCISE_CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  WARM_UP: "Aquecimento",
  STRENGTHENING: "Fortalecimento",
  MOBILITY: "Mobilidade",
};
