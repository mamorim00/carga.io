import { getCoach, getOrg, getRoster } from "@/lib/data";
import type { AcwrZone } from "@/lib/types";

const ZONE_STYLE: Record<AcwrZone, { dot: string; border: string; text: string }> = {
  IDEAL: { dot: "var(--ok)", border: "var(--line)", text: "var(--ok)" },
  ATTENTION: { dot: "var(--warn)", border: "#ebd2a6", text: "var(--warn)" },
  RISK: { dot: "var(--risk)", border: "#e3b7b3", text: "var(--risk)" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca sincronizou";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "há poucos min";
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `sem sinc. há ${days} dias`;
}

export default async function DashboardPage() {
  const org = getOrg();
  const coach = getCoach();
  const roster = getRoster();

  const riskCount = roster.filter((a) => a.zone === "RISK").length;
  const syncingCount = roster.filter((a) => a.hasWearable).length;

  const lanes: { label: string; zone: AcwrZone; athletes: typeof roster }[] = [
    { label: "IDEAL · 0,8–1,3", zone: "IDEAL", athletes: roster.filter((a) => a.zone === "IDEAL") },
    { label: "ATENÇÃO", zone: "ATTENTION", athletes: roster.filter((a) => a.zone === "ATTENTION") },
    { label: "RISCO", zone: "RISK", athletes: roster.filter((a) => a.zone === "RISK") },
  ];

  return (
    <main className="flex min-h-dvh bg-paper">
      <aside className="flex w-[216px] flex-shrink-0 flex-col gap-8 bg-ink px-3.5 py-6.5">
        <div className="flex items-center gap-2 px-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          <span className="text-[12.5px] font-bold tracking-[0.12em] text-paper uppercase">Carga</span>
        </div>
        <nav className="flex flex-col gap-0.5 text-[13.5px]">
          <span className="rounded-md bg-[#2a293a] px-3 py-2.5 font-medium text-paper">Painel</span>
          <span className="rounded-md px-3 py-2.5 text-[#8b8878]">Atletas</span>
          <span className="flex items-center justify-between rounded-md px-3 py-2.5 text-[#8b8878]">
            Alertas
            {riskCount > 0 && (
              <span className="rounded-[3px] bg-risk px-1.5 text-[10.5px] font-bold text-paper">{riskCount}</span>
            )}
          </span>
          <span className="rounded-md px-3 py-2.5 text-[#8b8878]">Mensagens</span>
          <span className="rounded-md px-3 py-2.5 text-[#8b8878]">Configurações</span>
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-[#2e2d3d] pt-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-accent text-[11.5px] font-bold text-paper">
            {coach.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="text-[12.5px] font-semibold text-paper">{coach.name}</div>
            <div className="text-[10.5px] text-[#6f6c60]">{org.name} · Treinador</div>
          </div>
        </div>
      </aside>

      <div className="flex flex-grow flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8.5 py-6.5">
          <div>
            <div className="font-display text-2xl font-semibold text-ink">Painel do time</div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {org.name} · {roster.length} atletas
            </div>
          </div>
        </div>

        <div className="mx-8.5 mb-5 flex gap-px overflow-hidden rounded-lg border border-line bg-line">
          <div className="flex-1 bg-surface px-5 py-4">
            <div className="text-[11.5px] text-muted">Sincronizando</div>
            <div className="font-display mt-1 text-2xl font-semibold text-ink">
              {syncingCount} / {roster.length}
            </div>
          </div>
          <div className="flex-1 bg-surface px-5 py-4">
            <div className="text-[11.5px] text-muted">Carga semanal média</div>
            <div className="font-display mt-1 text-2xl font-semibold text-ink">
              {Math.round(roster.reduce((s, a) => s + a.weeklyLoad, 0) / roster.length)} UA
            </div>
          </div>
          <div className="flex-1 px-5 py-4" style={{ background: "var(--risk-soft)" }}>
            <div className="text-[11.5px]" style={{ color: "var(--risk)" }}>
              Alertas de ACWR
            </div>
            <div className="font-display mt-1 text-2xl font-semibold" style={{ color: "var(--risk)" }}>
              {riskCount}
            </div>
          </div>
        </div>

        <div className="flex flex-grow gap-5 overflow-hidden px-8.5 pb-6">
          <div className="grid flex-grow auto-rows-min grid-cols-3 gap-3 overflow-hidden">
            {roster.map((a) => {
              const style = a.zone ? ZONE_STYLE[a.zone] : { dot: "#9aa69f", border: "var(--line)", text: "#9aa69f" };
              return (
                <div
                  key={a.athleteId}
                  className="flex flex-col gap-3 rounded-lg border bg-surface p-4"
                  style={{ borderColor: style.border }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-ink">{a.name}</div>
                    <span className="h-1.75 w-1.75 flex-shrink-0 rounded-full" style={{ background: style.dot }} />
                  </div>
                  <div className="text-[11px] text-muted">{timeAgo(a.lastSyncedAt)}</div>
                  <div className="flex items-center justify-between border-t border-[#f1eee3] pt-2.5">
                    <span className="font-display text-[15px] font-semibold" style={{ color: style.text }}>
                      {a.acwr ? a.acwr.toFixed(2) : "—"}
                    </span>
                    <span className="text-[11px] text-muted">{a.weeklyLoad} UA/sem</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex w-[270px] flex-shrink-0 flex-col gap-4 overflow-hidden rounded-lg border border-line bg-surface p-5">
            <div>
              <div className="text-[13.5px] font-semibold text-ink">Faixas de risco</div>
              <div className="mt-0.5 text-[11.5px] text-muted">ACWR do elenco, agora</div>
            </div>
            {lanes.map((lane) => (
              <div key={lane.zone}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold" style={{ color: ZONE_STYLE[lane.zone].text }}>
                    {lane.label}
                  </span>
                  <span className="text-[11px] text-muted">{lane.athletes.length} atletas</span>
                </div>
                <div
                  className="flex min-h-[34px] flex-wrap gap-1.5 rounded-md p-2.5"
                  style={{
                    background:
                      lane.zone === "IDEAL" ? "var(--ok-soft)" : lane.zone === "ATTENTION" ? "var(--warn-soft)" : "var(--risk-soft)",
                  }}
                >
                  {lane.athletes.map((a) => (
                    <div
                      key={a.athleteId}
                      title={a.name}
                      className="flex h-5.5 w-5.5 items-center justify-center rounded-[4px] text-[9px] font-bold text-paper"
                      style={{ background: ZONE_STYLE[lane.zone].dot }}
                    >
                      {a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {riskCount > 0 && (
              <div className="rounded-md border p-3.5 text-[12px] leading-relaxed" style={{ background: "var(--risk-soft)", borderColor: "#f0d3d1", color: "#7a2a33" }}>
                <strong>{riskCount} atleta{riskCount > 1 ? "s" : ""}</strong> ultrapassou ACWR 1,5 esta semana. Revise
                a progressão antes do próximo treino.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
