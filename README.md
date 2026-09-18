# Carga

Plataforma de carga de treino para treinadores, fisios e fisiologistas — Fase 1 (MVP), em desenvolvimento.

## O que já funciona

- **Motor de métricas** (`src/lib/metrics.ts`): carga interna (RPE × duração), carga externa (TRIMP por zona de FC),
  monotonia, strain e ACWR por EWMA (7d agudo : 28d crônico) — a mesma base científica do eLoad, mais a camada
  híbrida de carga externa. 17 testes unitários.
- **Camada de dados** (`src/lib/data.ts`): hoje em memória, com um elenco de exemplo já semeado com 40 dias de
  histórico (um atleta em zona de risco, um em atenção, o resto ideal, e um atleta sem wearable que registra
  manualmente) para que o painel e o progresso mostrem números reais desde o primeiro `npm run dev`. Documentado
  1:1 com `prisma/schema.prisma`, o schema real do produto — trocar essa camada por Prisma + Postgres não muda
  as páginas ou rotas acima dela.
- **Fluxo do atleta**: onboarding → conectar Strava (simulado) ou registrar treino manualmente (sem relógio) →
  check-in de RPE (CR-10) + bem-estar → progresso pessoal (ACWR, carga semanal, bem-estar).
- **Painel do treinador**: elenco com status de ACWR por atleta, carga semanal, e faixas de risco (ideal / atenção
  / risco) agrupando o elenco inteiro.
- **API**: `POST /api/activities/manual` (registro manual de treino) e `POST /api/checkin` (RPE + bem-estar),
  ambos validados.

## Rodando localmente

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # 24 testes (motor de métricas + camada de dados)
npm run lint
```

## Notas do ambiente onde isto foi construído

- `next/font/google` foi trocado por uma pilha de fontes do sistema em `src/app/layout.tsx` porque o sandbox de
  build não tinha acesso de saída a `fonts.googleapis.com` — troque de volta (ou self-host com `next/font/local`)
  em qualquer ambiente com acesso normal à rede.
- `prisma generate` não roda aqui pelo mesmo motivo (sem acesso a `binaries.prisma.sh`) — o schema em
  `prisma/schema.prisma` está pronto; rode `npx prisma generate && npx prisma migrate dev` assim que houver
  `DATABASE_URL` de um Postgres real.

## Próximos passos

Ver o roadmap completo (Fases 1–4) no doc do projeto. Prioridades imediatas para fechar a Fase 1:

- [ ] Trocar `src/lib/data.ts` por Prisma + Postgres
- [ ] OAuth real do Strava (hoje o botão só simula a conexão)
- [ ] Autenticação de verdade (coach e atleta) e multi-tenant por org
- [ ] Mapa de dor (diagrama corporal) e registro de ciclo menstrual
- [ ] Exportação CSV/PDF
- [ ] Cobrança (Stripe/Pix)
