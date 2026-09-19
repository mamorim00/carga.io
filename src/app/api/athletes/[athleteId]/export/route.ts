import { NextResponse } from "next/server";
import { getSessionCoach } from "@/lib/auth";
import { getAthlete, getAthleteExportRows } from "@/lib/data";
import { SOURCE_LABEL, formatActivityDate } from "@/lib/presentation";

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  // Quote only when needed — none of this app's own fields contain commas
  // or quotes today, but an athlete's name reaching here later might.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "Data",
  "Origem",
  "Duração (min)",
  "Distância (km)",
  "FC média",
  "RPE",
  "Carga interna",
  "Carga externa",
  "Carga combinada",
];

export async function GET(_request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const coach = await getSessionCoach();
  if (!coach) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { athleteId } = await params;
  const athlete = await getAthlete(athleteId);
  if (!athlete || athlete.coachId !== coach.id) {
    return NextResponse.json({ error: "atleta não encontrado" }, { status: 404 });
  }

  const rows = await getAthleteExportRows(athleteId);
  const lines = [
    HEADER.join(","),
    ...rows.map((r) =>
      [
        csvCell(formatActivityDate(r.date)),
        csvCell(SOURCE_LABEL[r.source]),
        csvCell(r.durationMin),
        csvCell(r.distanceKm),
        csvCell(r.avgHr),
        csvCell(r.rpe),
        csvCell(r.internalLoad != null ? Math.round(r.internalLoad) : null),
        csvCell(r.externalLoad != null ? Math.round(r.externalLoad) : null),
        csvCell(r.combinedLoad != null ? Math.round(r.combinedLoad) : null),
      ].join(","),
    ),
  ];
  // ﻿: UTF-8 BOM so Excel (still common among coaches/physios in
  // Brazil) doesn't mangle the accented headers/labels above.
  const csv = "﻿" + lines.join("\r\n");

  const safeName = athlete.name.replace(/[^\w-]+/g, "_");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="carga-${safeName}.csv"`,
    },
  });
}
