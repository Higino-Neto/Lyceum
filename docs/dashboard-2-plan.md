# Dashboard 2.0: absorver o /register e repaginar com abas e estatísticas

## Contexto

A tela `/add_reading` (aba "Registrar") ficou redundante:
- A seção "My books / Manage links, duplicates and statistics" repete o que a Biblioteca já faz melhor hoje.
- O `ReadingTable` dela é o mesmo do dashboard.
- A única parte com valor próprio é o form multi-linha "registrar leitura".

O dashboard foi feito quando o Lyceum tinha poucas funcionalidades e não mostra nada do que veio depois: biblioteca local rica, status de leitura, leitor Lyceum, vocabulário/SRS, anotações e conceitos.

Objetivo da release: remover o `/register`, levar o form para o dashboard (em cima da tabela) e reorganizar o dashboard em **abas temáticas**, com muitas estatísticas novas. As escolhas do usuário foram: abas, form multi-linha inline e brainstorm amplo (o usuário filtra depois).

---

## Parte A: Remover o /register e mover o form (base da release)

1. **Extrair o form** de `src/pages/AddReadingPage.tsx` para `src/pages/DashboardPage/components/RegisterReading/`:
   - `BookSearch.tsx`: o componente que já existe, movido sem mudar a lógica.
   - `RegisterReadingForm.tsx`: linhas, duplicar, remover, `Select` de categoria, data e submit via `saveReadingEntries` (`src/utils/saveReadingEntries.ts`).
   - Ao salvar: em vez de `navigate("/")`, resetar para uma linha vazia e invalidar `["readings"]`, `["ranking"]` e `["readingStats"]`. Hoje `readingStats` não é invalidado, então o card fica desatualizado.
   - Rascunho: `useRouteState` é indexado pelo pathname. No dashboard ele passa a salvar em `root`, e isso basta. O rascunho antigo de `add_reading` fica órfão (inofensivo).
   - Aproveitar para tirar os `console.log` de `updateEntry` e `handleSubmit`.
2. **Dashboard, aba Visão geral**: o card do form fica acima do `ReadingTable`. O botão "Registrar" que navegava para `/add_reading` (`DashboardPage.tsx:187`) sai. "Leituras do dia" (copiar) continua no cabeçalho da tabela.
3. **Remover a rota e a navegação**:
   - Em `src/App.tsx`, trocar a rota `/add_reading` por `<Navigate to="/" replace />`. Assim abas restauradas e links antigos continuam funcionando.
   - Remover `register` de `src/navigation/routes.ts` (`NavigationRouteId` e `NAVIGATION_ROUTES`).
   - Remover o item em `src/components/Sidebar.tsx:104`.
   - **Atalhos**: os padrões são posicionais (`getDefaultHotkeyBindings`), então Biblioteca passa de 2 para 1 etc. Conferir onde os bindings customizados ficam salvos e descartar a chave `register` órfã. Mencionar a mudança nas notas da release.
4. **Apagar** `AddReadingPage.tsx` e as chaves i18n `reading:add.myBooks.*` e `navigation:routes.register`, nos dois idiomas. `BooksSection` e `StatisticsPanel` **ficam**, porque a Biblioteca ainda usa os dois (`src/pages/Library/Library.tsx`).
5. **Sobreposição com o `quickReading`** (`ReadingStatsCard.tsx`, a lista rápida por livro): integrar ao card de registro como chips "lendo agora" que preenchem uma linha com 1 clique. Assim não ficam dois jeitos diferentes de registrar.

## Parte B: Estrutura em abas

- `DashboardPage.tsx` vira uma casca com abas: **Visão geral · Leitura · Idiomas · Biblioteca · Amigos**.
  - Aba ativa na query string (`?tab=`) + `useRouteState`, para lembrar a última aba.
  - Abas carregadas sob demanda (`React.lazy`), para manter a Visão geral rápida.
- Cada aba em `src/pages/DashboardPage/tabs/<Aba>Tab.tsx`. Componentes de gráfico em `components/`, reaproveitando `ReadingCharts/*`, `ChartTooltip`, `utils/chartData.ts`, `parseLocalDate` e `getWeekInfo`.
- Gráficos: **recharts** (já é dependência); para grafos, **sigma** (já usado nas anotações). Antes de escrever gráficos, carregar a skill `dataviz` para manter paleta e tokens consistentes.
- Filtro global de período (7d / 30d / 90d / ano / tudo) no topo das abas de estatística, compartilhado via contexto.
- **Web/Android**: `window.api` não existe lá. Abas que dependem de dados locais (Idiomas, Biblioteca) mostram um estado vazio explicativo em vez de quebrar.

## Parte C: Camada de dados

**Fontes existentes**
- Supabase `readings`: `reading_date`, `pages`, `reading_time`, `category_id`, `book_id`, `created_at`.
- Supabase `reading_stats` e RPC `get_current_streak`.
- Ranking dos amigos (`useRanking`).
- SQLite local, documentos: `documents` (`numPages`, `currentPage`, `lastOpenedAt`, `createdAt`, `rating`, `isFavorite`, `author`, `subject`, `language`, `series`, formato, `fileSize`).
- SQLite local, status: `reading_status_items` e `reading_status_progress_events`.
- SQLite local, idiomas: `ll_knowledge`, `ll_review_items`, `ll_review_log`, `ll_annotations`, `ll_reading_state` (`secondsRead`, `sessions`, `progress`).
- SQLite local, conceitos e mapas: `key_concepts`, `concept_relations`, `reading_maps`.

**Peças novas**
- **Hook `useReadingAnalytics(period)`**: derivações puras sobre `useGetReadings()`, em `src/features/stats/readingAnalytics.ts`. São funções testáveis em vitest: ritmo, recordes, sequências, projeções e comparativos.
- **IPC `stats:get-local-summary`** (e `stats:get-language-summary`): agregações em SQL no main process, para performance em bibliotecas grandes. Ficam num novo `electron/handlers/stats.handler.ts` + `electron/services/stats-service.ts`, expostos no `preload.ts`, com testes no padrão `*.test.ts` existente.
- **Histórico de vocabulário**: `ll_knowledge` só guarda o estado atual. Para a curva "palavras conhecidas ao longo do tempo", criar a tabela **aditiva** `ll_knowledge_daily(userId, language, date, known, learning)`, com snapshot 1x/dia. Ela nunca altera nem apaga vocabulário (prioridade: não perder vocabulário). O passado é reconstruído aproximadamente por `ll_review_items.createdAt` e `ll_review_log`.
- **Metas**: hoje existe só `daily_reading_goal_pages` no localStorage. Criar um modelo de metas (diária, semanal, mensal, anual; páginas, minutos ou livros) nas configurações do app, e migrar o valor antigo.
- **Limitação**: a hora do dia vem só de `created_at`, que é a hora do registro, não da leitura. Sessões do leitor são registradas logo ao terminar, então são precisas. Registros manuais, não. Para "horário em que mais lê", usar `ll_reading_state` e as sessões do leitor e deixar claro na UI.

---

## Parte D: Brainstorm de funcionalidades (o usuário filtra)

Legenda: ✅ dados já existem · 🆕 precisa de dado novo · ⭐ minha recomendação para esta release

### Visão geral (o "hoje")
- ⭐✅ Card "Hoje": páginas/meta com anel de progresso, minutos, streak, "faltam X páginas para a meta".
- ⭐✅ Form de registro + tabela (Parte A).
- ⭐✅ "Continuar lendo": os 3–5 livros abertos mais recentemente, com progresso e botão abrir. Vem de `documents.lastOpenedAt` + `currentPage/numPages`.
- ✅ Mensagem contextual: "Você está a 2 dias do seu recorde de streak", "Melhor semana desde março".
- ✅ Revisões SRS pendentes hoje, com atalho para revisar (liga com a aba Idiomas).
- ✅ Heatmap compacto de 12 semanas (o `ReadingHeatmap` atual, reduzido).

### Leitura: ritmo e hábitos
- ⭐✅ Comparativos: semana, mês e ano vs. o período anterior (pág., min., dias ativos), com delta %.
- ⭐✅ Velocidade: páginas/hora por livro e por categoria, com tendência ao longo do tempo.
- ⭐✅ Recordes pessoais: maior dia, maior semana, maior streak, sessão mais longa, livro mais rápido.
- ⭐✅ Projeção de término por livro: no ritmo dos últimos 14 dias, "termina em ~9 dias (26 nov)".
- ✅ Dia da semana (o `WeekdayChart` atual) + distribuição de duração das sessões (histograma).
- ✅ Consistência: % de dias ativos no mês e média móvel de 7 e 30 dias (linha suave sobre as barras).
- ✅ Heatmap de calendário do ano inteiro, estilo GitHub, com tooltip por dia.
- ✅ Categorias ao longo do tempo (área empilhada), e não só a pizza atual.
- ✅ "Dias de leitura profunda": dias com mais de 60 min seguidos.
- 🆕 Horário do dia (heatmap hora × dia da semana), só com sessões do leitor.
- 🆕 Sessões do leitor: tempo real por capítulo e páginas por sessão. Vem de `ll_reading_state` e do timer do `ReadingPage`; precisa gravar o início e o fim das sessões.

### Idiomas
- ⭐✅ Palavras por estado por idioma (desconhecida / aprendendo / conhecida), em barras empilhadas.
- ⭐✅ Revisões: pendentes, feitas hoje, acerto % (de `ll_review_log.correct`), retenção por intervalo.
- ⭐🆕 Curva de vocabulário conhecido ao longo do tempo (`ll_knowledge_daily`).
- ✅ Previsão de carga SRS: revisões vencendo nos próximos 14 dias (barras), para evitar acúmulo.
- ✅ Palavras mais consultadas (`lookupCount`) que ainda não estão como conhecidas: "suas palavras teimosas".
- ✅ Cobertura por livro: % das palavras do livro que você já conhece. Vem de `book_word_index` × `ll_knowledge`. Responde "este livro está no seu nível?" e é ótimo para escolher o próximo livro em francês.
- ✅ Palavras novas aprendidas por livro: "Le Petit Prince te ensinou 214 palavras".
- 🆕 Estimativa de nível (A1–C2) por número de lemas conhecidos, com o marco do próximo nível.

### Biblioteca
- ⭐✅ Funil: na fila → lendo → lidos → abandonados (`reading_status_items`).
- ⭐✅ Livros "esquecidos": em andamento, sem abrir há mais de 30 dias, com botão retomar ou arquivar.
- ✅ Distribuição por autor, assunto, idioma, formato (PDF/EPUB/MOBI/CBZ) e série (treemap ou barras).
- ✅ Crescimento da biblioteca ao longo do tempo (`documents.createdAt`): livros adicionados vs. lidos.
- ✅ Tamanho da biblioteca: total de páginas, GB, "páginas lidas vs. páginas possuídas" (o backlog em dias de leitura no seu ritmo).
- ✅ Séries incompletas: "você leu 3 de 7 livros de X".
- ✅ Notas e favoritos: distribuição de ratings e top livros avaliados.
- ✅ Anotações: as mais recentes, livros mais anotados, mapa de conceitos (sigma) agregado entre livros.
- ✅ Progresso dos Reading Maps (trilhas de leitura) já existentes.

### Metas, conquistas e retrospectiva
- ⭐🆕 Metas configuráveis: diária, semanal, mensal, anual (páginas, minutos ou livros), com barra de progresso e ritmo necessário ("precisa de 23 pág./dia para bater a meta anual").
- ⭐✅ Retrospectiva do ano estilo Wrapped: total, livro do ano, mês mais forte, palavras aprendidas, autor favorito, horário típico. Pode ser exportada como imagem para compartilhar com amigos.
- ✅ Conquistas/badges: "100 dias seguidos", "1º livro em francês", "1000 palavras conhecidas", "maratona: 200 pág. em um dia".
- ✅ Streak "congelável": 1 dia de folga por semana sem quebrar (opcional, configurável).
- ✅ Retrospectiva mensal curta (card no início do mês).

### Amigos
- ⭐✅ Mover o `RankingTable` e os gráficos comparativos com amigos para cá (a Visão geral fica mais limpa).
- ✅ Duelo semanal com um amigo: quem lê mais páginas na semana.
- ✅ Feed leve: "fulano terminou X", "fulano bateu a meta". Os dados de leitura deles já são visíveis no ranking.

### Toques de UX
- ✅ Atalho de teclado para focar o form de registro (ex.: `N`).
- ✅ Tooltips explicando como cada número é calculado.
- ✅ Exportar estatísticas como CSV.
- ✅ Estados vazios bonitos e úteis para quem acabou de instalar.

---

## Proposta de fatiamento da release

1. **Fase 1** (pode sair sozinha como 1.10): Parte A + casca de abas, com o conteúdo atual redistribuído (Visão geral com hoje + form + tabela; Leitura com os gráficos atuais; Amigos com o ranking).
2. **Fase 2**: itens ⭐ de Leitura + Metas (modelo de metas + card Hoje).
3. **Fase 3**: aba Idiomas (IPC + `ll_knowledge_daily`) e aba Biblioteca (IPC `stats:get-local-summary`).
4. **Fase 4**: Retrospectiva, conquistas e os demais itens que o usuário escolher no brainstorm.

## Arquivos críticos
- `src/pages/AddReadingPage.tsx` (fonte do form; apagar)
- `src/pages/DashboardPage/DashboardPage.tsx` (vira casca de abas)
- `src/pages/DashboardPage/components/ReadingStatsCard.tsx` (`quickReading` e meta diária)
- `src/App.tsx`, `src/navigation/routes.ts`, `src/components/Sidebar.tsx`
- `src/hooks/useGetReadings.tsx`, `src/hooks/useReadingStats.tsx`, `src/hooks/useRouteState.ts`
- `electron/infrastructure/sqlite-schema.ts`, `electron/preload.ts` + novo `stats.handler.ts` / `stats-service.ts`
- Arquivos i18n de `dashboard`, `reading` e `navigation`

## Verificação
- `npm run test:run`: testes novos para `readingAnalytics.ts` (recordes, streak, projeções, comparativos com datas locais), `stats-service` (SQL contra um banco em memória, no padrão dos testes de repository existentes) e o snapshot de `ll_knowledge_daily` (garantir que nunca altera `ll_knowledge`).
- `npx tsc --noEmit` e lint.
- Rodar o app (skill `run`):
  - registrar 2 linhas pelo dashboard e verificar a tabela, o card Hoje e o ranking atualizando sem recarregar;
  - abrir `/add_reading` antigo e confirmar o redirecionamento para `/`;
  - confirmar que a sidebar não mostra mais "Registrar" e que os atalhos funcionam;
  - percorrer as abas em tema claro e escuro;
  - checar as abas Idiomas e Biblioteca com o build web, onde não há `window.api`, para ver o estado vazio.
