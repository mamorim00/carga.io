import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between bg-ink px-8 pt-16 pb-10 text-paper">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          <span className="text-xs font-bold tracking-[0.12em] text-[#b8b4a8] uppercase">Carga</span>
        </div>
        <h1 className="font-display text-[34px] leading-tight font-semibold text-paper">
          A parte objetiva da carga, sem o atleta digitar nada.
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-[#8b8878]">
          Sincronizamos a atividade do dispositivo automaticamente. Depois, perguntamos só o que o corpo sabe e o
          relógio não mede.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-paper p-7 text-ink">
        <span className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Comece agora</span>

        <Link
          href="/checkin"
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3.5 text-sm font-semibold text-paper"
        >
          Conectar com Strava
        </Link>
        <p className="text-center text-xs leading-relaxed text-muted">
          Garmin Connect, Apple Health, Whoop e Oura chegam nas próximas versões.
        </p>

        <Link
          href="/checkin?manual=1"
          className="flex items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-3.5 text-sm font-semibold text-ink"
        >
          Registrar treino manualmente (sem relógio)
        </Link>

        <div className="my-1 flex items-center gap-2.5">
          <div className="h-px flex-grow bg-line" />
          <span className="text-[11px] text-muted">ou</span>
          <div className="h-px flex-grow bg-line" />
        </div>

        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-md border border-ink px-4 py-3.5 text-sm font-semibold text-ink"
        >
          Entrar como treinador
        </Link>
      </div>
    </main>
  );
}
