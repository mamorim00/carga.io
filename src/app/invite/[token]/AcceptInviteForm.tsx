"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SEX_LABEL } from "@/lib/presentation";
import type { Sex } from "@/lib/types";

const SEX_OPTIONS: Sex[] = ["FEMALE", "MALE", "UNSPECIFIED"];

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<Sex>("UNSPECIFIED");
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
        body: JSON.stringify({ token, password, birthDate, sex }),
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
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Data de nascimento
        <input
          type="date"
          required
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <span className="text-[11px] text-muted">Usada só para calibrar RPE/ACWR por faixa etária.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Sexo
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value as Sex)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        >
          {SEX_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {SEX_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted">Usado para calibrar normas e habilitar o registro de ciclo.</span>
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
