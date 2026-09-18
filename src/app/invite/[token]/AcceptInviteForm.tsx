"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao ativar a conta");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-xl bg-paper p-7 text-ink">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Crie uma senha
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <span className="text-[11px] text-muted">Pelo menos 8 caracteres.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Confirme a senha
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
      </label>
      {error && <p className="text-sm text-risk">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-accent px-4 py-3.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Ativando…" : "Ativar minha conta"}
      </button>
    </form>
  );
}
