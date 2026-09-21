"use client";

import { BODY_PART_LABEL } from "@/lib/presentation";
import type { BodyPart } from "@/lib/types";

// A schematic, not an anatomy illustration — plain shapes are enough to make
// each region unambiguously tappable, which is the actual job here.
type Hotspot =
  | { key: BodyPart; shape: "circle"; cx: number; cy: number; r: number }
  | { key: BodyPart; shape: "rect"; x: number; y: number; w: number; h: number; rx?: number };

const HOTSPOTS: Hotspot[] = [
  { key: "HEAD", shape: "circle", cx: 100, cy: 25, r: 20 },
  { key: "NECK", shape: "circle", cx: 100, cy: 52, r: 9 },
  { key: "SHOULDER_L", shape: "circle", cx: 60, cy: 72, r: 15 },
  { key: "SHOULDER_R", shape: "circle", cx: 140, cy: 72, r: 15 },
  { key: "CHEST", shape: "rect", x: 72, y: 62, w: 56, h: 50, rx: 12 },
  { key: "ABDOMEN", shape: "rect", x: 76, y: 112, w: 48, h: 45, rx: 10 },
  { key: "ARM_L", shape: "rect", x: 40, y: 87, w: 22, h: 90, rx: 10 },
  { key: "ARM_R", shape: "rect", x: 138, y: 87, w: 22, h: 90, rx: 10 },
  { key: "HIP_L", shape: "circle", cx: 83, cy: 172, r: 17 },
  { key: "HIP_R", shape: "circle", cx: 117, cy: 172, r: 17 },
  { key: "THIGH_L", shape: "rect", x: 68, y: 189, w: 28, h: 70, rx: 10 },
  { key: "THIGH_R", shape: "rect", x: 104, y: 189, w: 28, h: 70, rx: 10 },
  { key: "KNEE_L", shape: "circle", cx: 82, cy: 265, r: 14 },
  { key: "KNEE_R", shape: "circle", cx: 118, cy: 265, r: 14 },
  { key: "LOWER_LEG_L", shape: "rect", x: 70, y: 279, w: 24, h: 70, rx: 10 },
  { key: "LOWER_LEG_R", shape: "rect", x: 106, y: 279, w: 24, h: 70, rx: 10 },
];

const BACK_ONLY: BodyPart[] = ["UPPER_BACK", "LOWER_BACK"];

export function BodyMap({
  selected,
  onSelect,
}: {
  selected: BodyPart | null;
  onSelect: (part: BodyPart) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 200 360" className="w-full max-w-[200px]" role="group" aria-label="Diagrama do corpo, vista de frente">
        {HOTSPOTS.map((spot) => {
          const isSelected = selected === spot.key;
          const label = BODY_PART_LABEL[spot.key];
          const shared = {
            role: "button" as const,
            tabIndex: 0,
            "aria-label": label,
            "aria-pressed": isSelected,
            onClick: () => onSelect(spot.key),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(spot.key);
              }
            },
            style: { cursor: "pointer" },
            fill: isSelected ? "var(--accent)" : "var(--surface)",
            stroke: isSelected ? "var(--accent)" : "var(--line)",
            strokeWidth: 1.5,
          };
          return spot.shape === "circle" ? (
            <circle key={spot.key} cx={spot.cx} cy={spot.cy} r={spot.r} {...shared}>
              <title>{label}</title>
            </circle>
          ) : (
            <rect key={spot.key} x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={spot.rx ?? 6} {...shared}>
              <title>{label}</title>
            </rect>
          );
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-1.5">
        <span className="self-center text-[11px] text-muted">Não aparece de frente:</span>
        {BACK_ONLY.map((part) => (
          <button
            key={part}
            type="button"
            aria-pressed={selected === part}
            onClick={() => onSelect(part)}
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={
              selected === part
                ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--paper)" }
                : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
            }
          >
            {BODY_PART_LABEL[part]}
          </button>
        ))}
      </div>

      <div className="text-[12.5px] font-medium text-ink">
        {selected ? `Selecionado: ${BODY_PART_LABEL[selected]}` : "Toque em uma região"}
      </div>
    </div>
  );
}
