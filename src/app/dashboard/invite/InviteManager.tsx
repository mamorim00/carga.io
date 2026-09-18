"use client";

import { useState } from "react";
import type { Sport } from "@/lib/types";
import { SPORT_LABEL } from "@/lib/presentation";

interface PendingInvite {
  athleteId: string;
  name: string;
  email: string;
  sport: Sport;
  inviteUrl: string;
}

const SPORTS: Sport[] = ["RUNNING", "CYCLING", "TRIATHLON", "OTHER"];

export function InviteManager({ initialPending }: { initialPending: PendingInvite[] }) {
  const [pending, setPending] = useState(initialPending);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState<Sport>("RUNNING");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, sport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar convite");
      setPending((prev) => [
        { athleteId: data.athlete.id, name: data.athlete.name, email: data.athlete.email, sport: data.athlete.sport, inviteUrl: data.inviteUrl },
        ...prev,
      ]);
      setName("");
      setEmail("");
      setSport("RUNNING");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(athleteId: string) {
    setPending((prev) => prev.filter((p) => p.athleteId !== athleteId)); // optimistic
    const res = await fetch(`/api/invites/${athleteId}/revoke`, { method: "POST" });
    if (!res.ok) {
      // Roll back: re-fetch isn't wired up here, so just restore from the
      // response's implied failure — reload is the simplest honest fix.
      window.location.reload();
    }
  }

  async function copy(athleteId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(athleteId);
      setTimeout(() => setCopiedId((id) => (id === athleteId ? null : id)), 2000);
    } catch {
      // Clipboard permissions vary by browser/context — the link is still
      // visible and selectable, so this is a nice-to-have, not a failure.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-5">
        <div className="text-[13.5px] font-semibold text-ink">Convidar atleta</div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink">
            Nome
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Modalidade
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {SPORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-risk">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Gerar convite"}
        </button>
        <p className="text-[11.5px] leading-relaxed text-muted">
          Ainda não enviamos e-mail automaticamente — copie o link abaixo e envie você mesmo (WhatsApp, e-mail,
          onde for mais fácil falar com o atleta).
        </p>
      </form>

      <div>
        <div className="mb-2 text-[13.5px] font-semibold text-ink">
          Convites pendentes {pending.length > 0 && `(${pending.length})`}
        </div>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-6 text-center text-[12.5px] text-muted">
            Nenhum convite pendente.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((p) => (
              <div key={p.athleteId} className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[11.5px] text-muted">
                      {p.email} · {SPORT_LABEL[p.sport]}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(p.athleteId)}
                    className="text-[11.5px] font-semibold text-risk"
                  >
                    Revogar
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
                  <code className="flex-grow truncate text-[11px] text-muted">{p.inviteUrl}</code>
                  <button
                    type="button"
                    onClick={() => copy(p.athleteId, p.inviteUrl)}
                    className="flex-shrink-0 text-[11px] font-semibold text-accent"
                  >
                    {copiedId === p.athleteId ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
