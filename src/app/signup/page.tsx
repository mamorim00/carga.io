import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between bg-ink px-8 pt-16 pb-10 text-paper">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          <span className="text-xs font-bold tracking-[0.12em] text-[#b8b4a8] uppercase">Carga</span>
        </div>
        <h1 className="font-display text-[34px] leading-tight font-semibold text-paper">Criar conta da equipe</h1>
        <p className="max-w-xs text-sm leading-relaxed text-[#8b8878]">
          Cria o seu painel de treinador. Os atletas entram depois, por convite — cada um recebe um link para
          ativar a própria conta.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
