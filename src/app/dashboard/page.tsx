import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { requireCoach } from "@/lib/auth";
import { getOrg, getRoster } from "@/lib/data";
import { ZONE_STYLE, isNonCompliant, timeAgo } from "@/lib/presentation";
import type { AcwrZone } from "@/lib/types";

export default async function DashboardPage() {
  const coach = await requireCoach();
  const org = getOrg(coach.orgId)!;
  const roster = getRoster(coach.id);

  const riskCount = roster.filter((a) => a.zone === "RISK").length;
  const syncingCount = roster.filter((a) => a.hasWearable).length;
  const nonCompliantCount = roster.filter((a) => isNonCompliant(a.lastSyncedAt)).length;

  const lanes: { label: string; zone: AcwrZone; athletes: typeof roster }[] = [
    { label: "IDEAL · 0,8–1,3", zone: "IDEAL", athletes: roster.filter((a) => a.zone === "IDEAL") },
    { label: "ATENÇÃO", zone: "ATTENTION", athletes: roster.filter((a) => a.zone === "ATTENTION") },
    { label: "RISCO", zone: "RISK", athletes: roster.filter((a) => a.zone === "RISK") },
  ];

  return (
    <main className="flex min-h-dvh flex-col bg-paper md:flex-row">
      <aside className="flex w-full flex-shrink-0 flex-col gap-4 bg-ink px-3.5 py-4 md:w-[216px] md:gap-8 md:py-6.5">
        <div className="flex items-center justify-between gap-2 px-2 md:justify-start">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-accent" />
            <span className="text-[12.5px] font-bold tracking-[0.12em] text-paper uppercase">Carga</span>
          </div>
          <LogoutButton className="text-[11px] font-semibold text-[#8b8878] md:hidden" />
        </div>
        <nav className="flex gap-1 overflow-x-auto text-[13px] md:flex-col md:gap-0.5 md:overflow-visible md:text-[13.5px]">
          <span className="rounded-md bg-[#2a293a] px-3 py-2.5 font-medium whitespace-nowrap text-paper">Painel</span>
          <Link href="/dashboard/invite" className="rounded-md px-3 py-2.5 whitespace-nowrap text-[#8b8878]">
            Convidar atleta
          </Link>
          <Link href="/dashboard/pain" className="rounded-md px-3 py-2.5 whitespace-nowrap text-[#8b8878]">
            Mapa de dor
          </Link>
          <span className="flex items-center gap-1.5 rounded-md px-3 py-2.5 whitespace-nowrap text-[#8b8878]">
            Alertas
            {riskCount > 0 && (
              <span className="rounded-[3px] bg-risk px-1.5 text-[10.5px] font-bold text-paper">{riskCount}</span>
            )}
          </span>
          <span className="rounded-md px-3 py-2.5 whitespace-nowrap text-[#8b8878]">Mensagens</span>
          <span className="rounded-md px-3 py-2.5 whitespace-nowrap text-[#8b8878]">Configurações</span>
        </nav>
        <div className="mt-auto hidden flex-col gap-3 border-t border-[#2e2d3d] pt-4 md:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-accent text-[11.5px] font-bold text-paper">
              {coach.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-paper">{coach.name}</div>
              <div className="text-[10.5px] text-[#6f6c60]">{org.name} · Treinador</div>
            </div>
          </div>
          <LogoutButton className="self-start text-[11px] font-semibold text-[#8b8878]" />
        </div>
      </aside>

      <div className="flex flex-grow flex-col overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8.5 md:py-6.5">
          <div>
            <div className="font-display text-2xl font-semibold text-ink">Painel do time</div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {org.name} · {roster.length} atleta{roster.length === 1 ? "" : "s"}
            </div>
          </div>
          <Link
            href="/dashboard/invite"
            className="self-start rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper sm:self-auto"
          >
            + Convidar atleta
          </Link>
        </div>

        <div className="mx-4 mb-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 md:mx-8.5 lg:grid-cols-4">
          <div className="bg-surface px-5 py-4">
            <div className="text-[11.5px] text-muted">Sincronizando</div>
            <div className="font-display mt-1 text-2xl font-semibold text-ink">
              {syncingCount} / {roster.length}
            </div>
          </div>
          <div className="bg-surface px-5 py-4">
            <div className="text-[11.5px] text-muted">Carga semanal média</div>
            <div className="font-display mt-1 text-2xl font-semibold text-ink">
              {roster.length > 0 ? Math.round(roster.reduce((s, a) => s + a.weeklyLoad, 0) / roster.length) : "—"} UA
            </div>
          </div>
          <div className="px-5 py-4" style={{ background: "var(--risk-soft)" }}>
            <div className="text-[11.5px]" style={{ color: "var(--risk)" }}>
              Alertas de ACWR
            </div>
            <div className="font-display mt-1 text-2xl font-semibold" style={{ color: "var(--risk)" }}>
              {riskCount}
            </div>
          </div>
          <div className="px-5 py-4" style={{ background: "var(--warn-soft)" }}>
            <div className="text-[11.5px]" style={{ color: "var(--warn)" }}>
              Sem check-in há 3+ dias
            </div>
            <div className="font-display mt-1 text-2xl font-semibold" style={{ color: "var(--warn)" }}>
              {nonCompliantCount}
            </div>
          </div>
        </div>

        <div className="flex flex-grow flex-col gap-5 overflow-hidden px-4 pb-6 md:px-8.5 lg:flex-row">
          {roster.length === 0 ? (
            <div className="flex flex-grow flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface p-10 text-center">
              <div className="text-[14px] font-semibold text-ink">Sua equipe ainda não tem atletas</div>
              <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">
                Convide o primeiro atleta para começar a ver carga, ACWR e bem-estar no painel.
              </p>
              <Link href="/dashboard/invite" className="mt-1 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper">
                Convidar atleta
              </Link>
            </div>
          ) : (
            <div className="grid flex-grow auto-rows-min grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((a) => {
                const style = a.zone ? ZONE_STYLE[a.zone] : { dot: "#9aa69f", border: "var(--line)", text: "#9aa69f" };
                const nonCompliant = isNonCompliant(a.lastSyncedAt);
                return (
                  <Link
                    key={a.athleteId}
                    href={`/dashboard/${a.athleteId}`}
                    className="flex flex-col gap-3 rounded-lg border bg-surface p-4 transition-colors hover:border-ink"
                    style={{ borderColor: style.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-ink">{a.name}</div>
                      <span className="h-1.75 w-1.75 flex-shrink-0 rounded-full" style={{ background: style.dot }} />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      {timeAgo(a.lastSyncedAt)}
                      {nonCompliant && (
                        <span
                          className="rounded-[3px] px-1 text-[9.5px] font-bold"
                          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                        >
                          sem check-in
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-[#f1eee3] pt-2.5">
                      <span className="font-display text-[15px] font-semibold" style={{ color: style.text }}>
                        {a.acwr ? a.acwr.toFixed(2) : "—"}
                      </span>
                      <span className="text-[11px] text-muted">{a.weeklyLoad} UA/sem</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex w-full flex-shrink-0 flex-col gap-4 overflow-hidden rounded-lg border border-line bg-surface p-5 lg:w-[270px]">
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
                    <Link
                      key={a.athleteId}
                      href={`/dashboard/${a.athleteId}`}
                      title={a.name}
                      className="flex h-5.5 w-5.5 items-center justify-center rounded-[4px] text-[9px] font-bold text-paper"
                      style={{ background: ZONE_STYLE[lane.zone].dot }}
                    >
                      {a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </Link>
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
