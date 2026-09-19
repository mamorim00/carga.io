import { getAthleteByInviteToken, getCoach } from "@/lib/data";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const athlete = await getAthleteByInviteToken(token);
  const coach = athlete ? await getCoach(athlete.coachId) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between bg-ink px-8 pt-16 pb-10 text-paper">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          <span className="text-xs font-bold tracking-[0.12em] text-[#b8b4a8] uppercase">Carga</span>
        </div>
        {athlete ? (
          <>
            <h1 className="font-display text-[34px] leading-tight font-semibold text-paper">
              Olá, {athlete.name.split(" ")[0]}.
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-[#8b8878]">
              {coach?.name ?? "Seu treinador"} te convidou para acompanhar sua carga de treino
              pelo Carga. Crie uma senha para {athlete.email} e ativar sua conta.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[34px] leading-tight font-semibold text-paper">Convite inválido</h1>
            <p className="max-w-xs text-sm leading-relaxed text-[#8b8878]">
              Este link não é válido ou já expirou. Peça ao seu treinador para enviar um novo convite.
            </p>
          </>
        )}
      </div>
      {athlete && <AcceptInviteForm token={token} />}
    </main>
  );
}
