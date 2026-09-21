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
- **Camada de dados** (`src/lib/data.ts`): Postgres real via `@prisma/client`, contra o schema em
  `prisma/schema.prisma` — sem camada em memória, sem `DATABASE_URL` fictício. O elenco de exemplo (um atleta em
  zona de risco, um em atenção, o resto ideal, e um atleta sem wearable que registra manualmente, todos com 40
  dias de histórico e check-ins de bem-estar coerentes) é semeado uma vez por banco, não uma vez por processo: a
  primeira leitura que não encontra o treinador demo semeia; qualquer outra corrida (mesmo processo, outro
  processo, outra região) encontra o treinador já lá e não repete. ACWR/monotonia/strain nunca ficam guardados
  como um total acumulado — são recalculados a cada leitura a partir das atividades e check-ins de RPE brutos
  (`getDailyLoadsSeries`), então não existe estado derivado que possa dessincronizar do que gerou ele. O
  `PrismaClient` em si vive em `globalThis`, não em `const` de módulo — o mesmo padrão que os docs da própria
  Next.js recomendam para não abrir um pool de conexões por "layer" de compilação (Route Handler, Página, Proxy);
  ao contrário do estado em memória de antes, isso hoje é só uma otimização de conexões, não uma exigência de
  correção, já que os dados em si moram no Postgres e já são visíveis de qualquer processo/região sem ajuda.
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
- **Avaliações** (`/dashboard/[athleteId]/assessments`): avaliação inicial e reavaliações estruturadas — cada uma
  com uma lista livre de medidas (`Measurement`: categoria ROM/força/qualidade de movimento, rótulo, valor
  numérico opcional, unidade), mais campos de texto para exames relatados, medicamentos e observações gerais.
  Registrado pelo treinador (não existe login separado de fisio ainda — ver `Role` no schema), não pelo atleta:
  é um exame profissional, diferente do mapa de dor que o próprio atleta autorreporta. Rótulo livre em vez de uma
  taxonomia fixa de articulações/músculos, para o profissional medir o que quiser e comparar reavaliações
  batendo o mesmo rótulo ao longo do tempo. Sem upload de arquivo de verdade ainda (exames/anexos são só texto) —
  precisaria de uma decisão de armazenamento de blob que este app não tem hoje.
- **Exercícios de prevenção** (`/exercises` para o atleta, `/dashboard/[athleteId]/exercises` para o treinador):
  biblioteca compartilhada de exercícios de aquecimento, fortalecimento preventivo e mobilidade (`Exercise`,
  12 exercícios semeados, sem vínculo com nenhum Org — é conteúdo genérico, não específico de um cliente); o
  treinador prescreve um exercício da biblioteca para um atleta (séries, repetições, frequência em texto livre,
  notas) e o atleta marca como feito no dia em `/exercises`, visível junto da carga no mesmo app, como pedido no
  feedback do mercado. Adesão (`completedLast7Days`) é recalculada a cada leitura a partir de
  `ExerciseCompletion`, mesmo princípio de "nunca guardar um total derivado" da carga (`getDailyLoadsSeries`).
  Sem vídeo de verdade nos exercícios semeados — **este app nunca inventa uma URL de vídeo**; o treinador cola
  seu próprio link de confiança ao cadastrar um exercício novo pela mesma tela. `source`/`externalId` no schema
  deixam a porta aberta para importar de uma API de exercícios de verdade (wger, ExerciseDB, …) depois, mas
  nenhuma foi integrada ainda — a maioria exige uma chave de API que este app não tem.
- **API**: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/invites` (criar
  convite), `POST /api/invites/[athleteId]/revoke`, `POST /api/invites/accept`, `POST /api/activities/manual`
  (registro manual de treino), `POST /api/checkin` (RPE + bem-estar), `POST /api/pain` (mapa de dor),
  `POST /api/cycle` (ciclo menstrual), `POST /api/assessments` (avaliação/reavaliação), `POST /api/exercises`
  (novo exercício na biblioteca), `POST /api/exercises/prescriptions` (prescrever), `POST
  /api/exercises/prescriptions/[id]/deactivate`, `POST /api/exercises/completions` (marcar feito/desfazer) e
  `GET /api/athletes/[athleteId]/export` (CSV) — todos validados.

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
npx prisma generate  # gera o client do Prisma (precisa rodar de novo sempre que o schema mudar)
npm run dev           # http://localhost:3000 — precisa de PRISMA_DATABASE_URL apontando pra um Postgres real
npm test              # 74 testes; os de src/lib/data.test.ts precisam do mesmo Postgres alcançável
npm run lint
```

`npm run build` (o que o Vercel roda) já faz `prisma db push --accept-data-loss` antes do `next build`, contra
`PRISMA_DATABASE_URL` — não existe passo manual de migração separado hoje. Não há histórico de migrations
(`prisma migrate dev` nunca rodou — precisa de uma conexão que este ambiente de sandbox não consegue fazer, ver
abaixo); é `db push` aplicando o schema diretamente, aceitável nesta fase, mas sem o histórico incremental que
`migrate` daria.

## Notas do ambiente onde isto foi construído

- `next/font/google` foi trocado por uma pilha de fontes do sistema em `src/app/layout.tsx` porque o sandbox de
  build não tinha acesso de saída a `fonts.googleapis.com` — troque de volta (ou self-host com `next/font/local`)
  em qualquer ambiente com acesso normal à rede.
- Migração para Postgres real: **feita, deploy confirmado, fluxo de login não testado por mim**. O sandbox onde
  isto foi escrito bloqueia conexão direta (TCP bruto) a bancos Postgres por política de rede — só HTTPS passa.
  `prisma generate` funciona aqui (baixa o engine via HTTPS de `binaries.prisma.sh`), mas `prisma db push`/
  qualquer query real contra `PRISMA_DATABASE_URL` não — `P1001: Can't reach database server`. Por isso todo
  `src/lib/data.ts` (e os ~20 arquivos que o chamam) foi escrito e compilado (`next build` tipa contra os tipos
  gerados do Prisma sem precisar de conexão real) sem nunca rodar contra o banco de verdade. O build do Vercel
  para o commit desta migração **terminou com sucesso** (status `Vercel: Deployment has completed`, mais
  GitGuardian e Vercel Preview Comments verdes) — como `prisma db push` roda antes do `next build` nesse
  ambiente, isso é evidência forte de que o schema foi aplicado e o client do Prisma funciona contra o banco
  real. O que eu **não** consegui fazer: abrir a própria URL de preview (`*.vercel.app`) para clicar no fluxo de
  login/painel — a política de rede deste sandbox também bloqueia domínios HTTPS fora de uma lista permitida, e
  esse domínio não está nela (erro `EGRESS_BLOCKED`/403, o mesmo tipo de bloqueio do Postgres, só que para
  domínios web em geral). Alguém com acesso normal à internet precisa abrir a preview e confirmar que
  `rafael@fundobh.com.br` / `carga1234` loga e que `/dashboard` mostra o elenco semeado com ACWR de verdade —
  isso ainda não foi verificado ponta a ponta por ninguém.
- `SESSION_SECRET` não está definida em lugar nenhum — sem ela, as sessões são assinadas com uma chave de
  desenvolvimento fixa e pública (ver `src/lib/session-token.ts`), o que é aceitável para rodar localmente mas
  **nunca** em produção. Defina `SESSION_SECRET` (ex.: `openssl rand -base64 32`) nas variáveis de ambiente do
  Vercel antes de expor isto a usuários reais — sem isso, qualquer um pode forjar uma sessão de treinador.

## Próximos passos

Lista completa e detalhada, com o que já está pronto e o que falta, em `docs/mvp-tasks.md`. Prioridades imediatas:

- [x] Trocar `src/lib/data.ts` por Prisma + Postgres — feito, build do Vercel passou; falta alguém com acesso
      normal à internet confirmar o login/painel na preview (ver acima)
- [ ] OAuth real do Strava (hoje o botão só simula a conexão)
- [ ] Enviar o link de convite por e-mail de verdade, em vez de só mostrar na tela do treinador
- [ ] RBAC mais rico (assistente técnico, fisio, fisiologista, admin de org — o enum `Role` já existe no schema)
- [ ] Cobrança (Stripe/Pix)

### Ideias vindas do mercado

Feedback de uma fisioterapeuta que atua na área. Duas já foram implementadas; o resto ainda não foi avaliado
quanto a esforço/prioridade nem incluído em `docs/mvp-tasks.md`, só registrado aqui para não se perder:

- [x] **Avaliação inicial e reavaliações estruturadas** — espaço para amplitude de movimento, força, qualidade
      de movimento, exames e medicamentos. Feito: `/dashboard/[athleteId]/assessments`, modelos `Assessment` +
      `Measurement` no schema — ver "O que já funciona" acima para os detalhes e o que ficou de fora (upload de
      arquivo de verdade).
- [ ] **Conexão com outros apps de treino** (TrainingPeaks, relógios/wearables em geral) além do Strava — hoje o
      schema já modela isso (`ActivitySource` inclui `GARMIN` e `APPLE_HEALTH`, não só `STRAVA`), mas nenhuma
      integração real existe ainda além do Strava simulado.
- [x] **Prescrição de exercícios de aquecimento/fortalecimento preventivo** dentro do mesmo app onde a carga é
      acompanhada — feito: `/exercises` (atleta) e `/dashboard/[athleteId]/exercises` (treinador), ver "O que já
      funciona" acima. Mais restrito que a "biblioteca de exercícios/program builder" citada como fora do escopo
      do MVP em `docs/mvp-tasks.md` — sem builder de programa/periodização, só prescrição simples + adesão.
- [ ] **Lembretes automáticos para o atleta responder** (check-in, reavaliação) — hoje o app só _mostra_ para o
  treinador quem está sem check-in há 3+ dias (`isNonCompliant`, no painel); não existe nenhum envio automático
  de mensagem para o atleta. Depende de alguma forma de contato (e-mail, push, WhatsApp) ainda não decidida.
- [ ] **Multidisciplinar com visibilidade por permissão** — treinador, preparador físico, fisioterapeuta etc.
      todos no mesmo app, cada um vendo só o que o profissional responsável autorizar, com o histórico do atleta
      acompanhando ele numa transferência de clube. É a ideia mais estrutural das cinco: o enum `Role` já existe
      no schema (`HEAD_COACH`, `ASSISTANT_COACH`, `PHYSIO`, `PHYSIOLOGIST`, `ORG_ADMIN`) mas não é usado por
      lugar nenhum do app hoje (login é 1 Coach : 1 Org, sem RBAC de verdade) — e "o histórico atravessa uma
      transferência de clube" implica dado do atleta sobrevivendo à saída de um Org, o que é uma mudança de
      modelo maior do que só adicionar papéis a um Org existente.
