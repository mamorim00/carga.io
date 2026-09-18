import type { Metadata } from "next";
import "./globals.css";

// NOTE: next/font/google needs outbound access to fonts.googleapis.com at
// build time, which this sandbox's egress policy blocks (see
// /root/.ccr/README.md — a 403 policy denial, not a transient failure, so
// it isn't worth retrying here). Falling back to a system stack that
// matches the prototype's pairing (serif display / sans body) so the build
// works in every environment; swap in next/font/google (Fraunces + IBM
// Plex Sans) or a self-hosted next/font/local build wherever the target
// environment can actually reach Google Fonts.

export const metadata: Metadata = {
  title: "Carga",
  description: "Plataforma de carga de treino para treinadores, fisios e fisiologistas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full font-sans" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        {children}
      </body>
    </html>
  );
}
