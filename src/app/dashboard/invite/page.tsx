import Link from "next/link";
import { headers } from "next/headers";
import { requireCoach } from "@/lib/auth";
import { getPendingInvites } from "@/lib/data";
import { InviteManager } from "./InviteManager";

export default async function InvitePage() {
  const coach = await requireCoach();
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = `${proto}://${hdrs.get("host")}`;

  const invites = await getPendingInvites(coach.id);
  const pending = invites.map((a) => ({
    athleteId: a.id,
    name: a.name,
    email: a.email,
    sports: a.sports,
    inviteUrl: `${origin}/invite/${a.inviteToken}`,
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 bg-paper px-6 pt-6 pb-10">
      <Link href="/dashboard" className="text-[12.5px] text-muted">
        ← Painel do time
      </Link>
      <div>
        <div className="font-display text-[23px] font-semibold text-ink">Convidar atletas</div>
        <div className="mt-0.5 text-[12.5px] text-muted">Eles entram na sua equipe assim que ativam a conta.</div>
      </div>
      <InviteManager initialPending={pending} />
    </main>
  );
}
