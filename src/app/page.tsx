import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const FEATURES = [
  {
    title: "Carga com base científica",
    body: "Carga interna (RPE × duração), carga externa (TRIMP por zona de FC) e ACWR por EWMA (7 dias agudo : 28 dias crônico) — a mesma base do eLoad, com a camada híbrida de carga externa.",
  },
  {
    title: "Atividade e bem-estar, juntos",
    body: "Cada treino chega com duração, distância e frequência cardíaca — do relógio ou registrado à mão. O check-in de esforço (RPE) e bem-estar completa o que só o corpo sabe.",
  },
  {
    title: "Atletas entram por convite",
    body: "Você cria a conta da equipe e convida cada atleta por e-mail. Eles ativam a própria conta, com a própria senha, e conectam o relógio ou registram manualmente.",
  },
  {
    title: "Risco visível antes do problema",
    body: "Painel do treinador com o elenco inteiro por faixa de ACWR — ideal, atenção, risco — para agir antes de uma lesão por excesso de carga.",
  },
];

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect(session.role === "COACH" ? "/dashboard" : "/progress");

  return (
    <main className="flex min-h-dvh flex-col bg-ink text-paper">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          <span className="text-xs font-bold tracking-[0.12em] text-[#b8b4a8] uppercase">Carga</span>
        </div>
        <nav className="flex items-center gap-5 text-[13px] font-medium">
          <Link href="/login" className="text-[#c9c6ba]">
            Entrar
          </Link>
          <Link href="/signup" className="rounded-md bg-accent px-4 py-2 text-paper">
            Criar conta da equipe
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-14 pb-20">
        <h1 className="max-w-2xl font-display text-[40px] leading-tight font-semibold text-paper sm:text-[52px]">
          Veja a carga de cada atleta antes que vire lesão.
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-[#a5a293]">
          Carga combina a atividade objetiva do treino com o que o atleta sente — e transforma isso em ACWR, zonas
          de risco e um painel que qualquer treinador, fisio ou fisiologista consegue ler em segundos.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/signup"
            className="rounded-md bg-accent px-5 py-3.5 text-sm font-semibold text-paper"
          >
            Criar conta da equipe
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-[#3a3950] px-5 py-3.5 text-sm font-semibold text-paper"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="bg-paper py-16 text-ink">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-line bg-surface p-6">
              <div className="text-[15px] font-semibold text-ink">{f.title}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-[12px] text-[#7a7869]">
        <span>Carga — para treinadores, fisios e fisiologistas.</span>
        <Link href="/login" className="text-[#a5a293]">
          Entrar →
        </Link>
      </footer>
    </main>
  );
}
