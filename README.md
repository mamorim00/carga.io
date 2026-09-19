# Carga

Plataforma de carga de treino para treinadores, fisios e fisiologistas — Fase 1 (MVP), em desenvolvimento.

## O que já funciona

- **Página inicial** (`/`): apresenta o produto antes do login — o que o Carga faz, para quem, e os dois caminhos de
  entrada (criar conta da equipe ou entrar). Só quem não está logado a vê; quem já tem sessão é redirecionado
  direto para o painel (treinador) ou progresso (atleta).
- **Login de verdade**: e-mail + senha com hash (scrypt, `src/lib/password.ts`) e sessão em cookie assinado
  (HMAC, `src/lib/session-token.ts`) — sem biblioteca de auth externa, sem sessão em servidor. Treinador cria conta
  em `/signup` (nome da equipe + dados próprios); não existe cadastro aberto de atleta — a única porta de entrada
  para um atleta é aceitar um convite.
- **Convite de atletas** (`/dashboard/invite`): o treinador convida por nome + e-mail + modalidade; isso já cria o
  registro do atleta (em status `INVITED`) com um link de ativação de uso único e validade de 7 dias. Não há envio
  de e-mail automático ainda — o link aparece na tela para o treinador copiar e mandar por onde for mais fácil
  falar com o atleta (mesmo estilo "simulado, mas honesto sobre ser simulado" do botão do Strava). O atleta abre o
  link (`/invite/[token]`), cria a própria senha, e cai direto no onboarding já logado. O treinador também vê a
  lista de convites pendentes e pode revogar um antes que seja aceito.
- **Autorização em duas camadas**: `src/proxy.ts` (o `middleware.ts` renomeado na Next 16) faz o redirecionamento
  otimista por cookie — `/dashboard/**` exige treinador, `/checkin` `/progress` `/onboarding` exigem atleta ativo,
  e `/login` `/signup` redirecionam embora quem já está logado. A checagem que realmente importa está em
  `src/lib/auth.ts` (`requireCoach()` / `requireAthlete()`), chamada em cada página protegida — a mesma
  Data Access Layer que o próprio guia de autenticação da Next.js recomenda, para a autorização nunca depender só
  do Proxy.
- **Motor de métricas** (`src/lib/metrics.ts`): carga interna (RPE × duração), carga externa (TRIMP por zona de FC),
  monotonia, strain e ACWR por EWMA (7d agudo : 28d crônico) — a mesma base científica do eLoad, mais a camada
  híbrida de carga externa — e um score composto de bem-estar (`wellnessComposite`, sono + humor + hidratação menos
  dor muscular e estresse, em 1–5). Todos surgem no `/progress` do atleta e no `/dashboard/[athleteId]` do
  treinador, não só no motor.
- **Camada de dados** (`src/lib/data.ts`): hoje em memória, com um elenco de exemplo já semeado com 40 dias de
  histórico (um atleta em zona de risco, um em atenção, o resto ideal, e um atleta sem wearable que registra
  manualmente) para que o painel e o progresso mostrem números reais desde o primeiro `npm run dev`. Cada dia
  treinado também vem com um check-in de bem-estar coerente com a história do atleta. Documentado 1:1 com
  `prisma/schema.prisma`, o schema real do produto — trocar essa camada por Prisma + Postgres não muda as páginas
  ou rotas acima dela. **Importante**: o estado vive em `globalThis`, não em `let`/`const` de módulo — a Next.js
  compila Route Handlers, Páginas/Server Components e Proxy como pacotes ("layers") separados, cada um com sua
  própria instância deste módulo; sem isso, uma atividade registrada via `POST /api/activities/manual` ficava
  invisível para a própria página `/checkin` logo em seguida (confirmado tanto em `next dev` quanto em
  `next start`). `globalThis` garante que todas as layers enxerguem os mesmos arrays dentro de **um processo**. Isso
  não resolve múltiplas instâncias/regiões em produção — é o mesmo limite de sempre (sem banco real, sem estado
  compartilhado entre processos) só que agora também documentado onde dói de verdade.
- **Fluxo do atleta**: aceitar convite (nome + modalidade(s) vêm do treinador; data de nascimento + sexo são
  informados pelo próprio atleta ao criar a senha) → onboarding → conectar Strava (simulado) ou registrar treino
  manualmente (sem relógio) → check-in de RPE (CR-10) + bem-estar (sono, dor muscular, humor, estresse, hidratação)
  → progresso pessoal (ACWR, monotonia, strain, bem-estar composto, carga semanal, atividades recentes, botão de
  "sincronizar agora" simulado quando há wearable) → mapa de dor (`/pain`) a qualquer momento, não só logo após um
  treino → registro de ciclo menstrual (`/cycle`, visível no progresso só para quem se declarou `FEMALE`, mas
  acessível a qualquer atleta logado — sem bloqueio rígido sobre um dado de saúde autodeclarado). A carga é sempre
  a combinação de duas partes — a atividade (duração, distância, FC, de onde veio) e o check-in (RPE + bem-estar)
  — nunca uma automação que dispensa o check-in.
- **Painel do treinador**: elenco com status de ACWR por atleta (só os `ACTIVE`; convites pendentes ficam em
  `/dashboard/invite`), carga semanal, faixas de risco (ideal / atenção / risco) e contagem de atletas sem
  check-in há 3+ dias; cada atleta abre em `/dashboard/[athleteId]` com ACWR, monotonia, strain, carga semanal,
  atividades recentes, bem-estar recente, mapa de dor recente e um selo de não-conformidade quando aplicável — só
  se pertencer à equipe do treinador logado. `/dashboard/pain` reúne os registros de dor de todo o elenco, mais
  recentes primeiro. Layout responsivo: barra lateral vira uma faixa horizontal rolável e a grade do elenco cai
  para 1–2 colunas abaixo de `md`/`lg`.
- **Exportação** (`/dashboard/[athleteId]`): "Exportar CSV" baixa o histórico de atividades/carga do atleta via
  `GET /api/athletes/[athleteId]/export`; "Relatório (PDF)" abre `/dashboard/[athleteId]/print`, uma página
  estilizada para impressão — vira PDF pelo próprio diálogo de impressão do navegador, sem precisar de uma
  biblioteca de geração de PDF.
- **Mapa de dor** (`src/components/BodyMap.tsx`): diagrama do corpo (frente) com 16 regiões clicáveis mais dois
  botões para "costas" (não visíveis de frente) — sem ilustração anatômica de verdade, só formas simples o
  bastante para cada região ser inequivocamente clicável. `POST /api/pain` pega o atleta pela sessão, não por um
  `athleteId` no corpo da requisição (ao contrário de `/api/checkin` e `/api/activities/manual`, uma lacuna
  pré-existente que não foi corrigida ali para não alterar o contrato dessas rotas sem necessidade).
- **Feed de atividades** (`src/lib/data.ts#getAthleteActivityFeed`, `src/components/ActivityFeed.tsx`): junta cada
  atividade com o RPE do check-in correspondente (quando já enviado), usado tanto no progresso do atleta quanto no
  detalhe do atleta no painel do treinador.
- **API**: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/invites` (criar
  convite), `POST /api/invites/[athleteId]/revoke`, `POST /api/invites/accept`, `POST /api/activities/manual`
  (registro manual de treino), `POST /api/checkin` (RPE + bem-estar), `POST /api/pain` (mapa de dor),
  `POST /api/cycle` (ciclo menstrual) e `GET /api/athletes/[athleteId]/export` (CSV) — todos validados.

## Contas de demonstração

O elenco semeado (Fundo BH) usa a mesma senha para todo mundo, só para este ambiente:

| Papel | E-mail | Senha |
| --- | --- | --- |
| Treinador | `rafael@fundobh.com.br` | `carga1234` |
| Qualquer atleta semeado (ex.: `marina.alves@atleta.com`) | ver `src/lib/data.ts` | `carga1234` |

Um treinador novo pode se cadastrar em `/signup` a qualquer momento — isso cria uma equipe própria, com elenco
vazio, separada da demo.

## Rodando localmente

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # 67 testes (motor de métricas, camada de dados, senha, sessão, apresentação)
npm run lint
```

## Notas do ambiente onde isto foi construído

- `next/font/google` foi trocado por uma pilha de fontes do sistema em `src/app/layout.tsx` porque o sandbox de
  build não tinha acesso de saída a `fonts.googleapis.com` — troque de volta (ou self-host com `next/font/local`)
  em qualquer ambiente com acesso normal à rede.
- Migração para Postgres real: **em andamento, pausada a meio caminho**. Já existe um `DATABASE_URL` real
  (Prisma Postgres, via integração do Vercel) num `.env` local — sem versionamento, nunca commitado — mas ainda não
  rodei `prisma generate`/`db push` contra ele nem troquei `src/lib/data.ts` pelo client do Prisma (isso muda toda
  função de `data.ts` para `async`, e cada chamador precisa de `await`). Ver `docs/mvp-tasks.md`, item 6, para o
  que falta exatamente. Ao contrário da nota anterior deste arquivo, `binaries.prisma.sh` respondeu (404, não
  bloqueio) neste ambiente — a limitação de rede pode já não se aplicar aqui, mas isso só se confirma tentando.
- `SESSION_SECRET` não está definida em lugar nenhum — sem ela, as sessões são assinadas com uma chave de
  desenvolvimento fixa e pública (ver `src/lib/session-token.ts`), o que é aceitável para rodar localmente mas
  **nunca** em produção. Defina `SESSION_SECRET` (ex.: `openssl rand -base64 32`) nas variáveis de ambiente do
  Vercel antes de expor isto a usuários reais — sem isso, qualquer um pode forjar uma sessão de treinador.

## Próximos passos

Lista completa e detalhada, com o que já está pronto e o que falta, em `docs/mvp-tasks.md`. Prioridades imediatas:

- [ ] Trocar `src/lib/data.ts` por Prisma + Postgres — em andamento (ver acima)
- [ ] OAuth real do Strava (hoje o botão só simula a conexão)
- [ ] Enviar o link de convite por e-mail de verdade, em vez de só mostrar na tela do treinador
- [ ] RBAC mais rico (assistente técnico, fisio, fisiologista, admin de org — o enum `Role` já existe no schema)
- [ ] Cobrança (Stripe/Pix)
