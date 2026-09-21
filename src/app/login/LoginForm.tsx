"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao entrar");
      router.push(data.role === "COACH" ? "/dashboard" : "/progress");
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
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Senha
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
        />
      </label>
      {error && <p className="text-sm text-risk">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-md bg-accent px-4 py-3.5 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {submitting ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted">
        Treinador novo por aqui?{" "}
        <Link href="/signup" className="font-semibold text-ink underline">
          Criar conta da equipe
        </Link>
      </p>
    </form>
  );
}
