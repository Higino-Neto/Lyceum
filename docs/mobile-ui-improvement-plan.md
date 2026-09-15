# Plano de melhoria da experiência mobile

## Escopo e diagnóstico

Este plano cobre o aplicativo Capacitor em `src/mobile`, com base na leitura do código e dos recursos nativos em 13/09/2026. É uma auditoria de implementação; ainda falta observar o uso em aparelhos Android e iOS, com teclado, leitor de tela, bibliotecas grandes e conexão instável. O fluxo desktop não está incluído.

O app já oferece biblioteca local, leitores PDF/EPUB/TXT, registros sincronizados, painel, ranking e backup. A próxima melhoria deve reduzir o esforço das tarefas frequentes e dar uma linguagem visual e de interação consistente a essas áreas. A prioridade é registrar uma leitura em poucos passos, sem ambiguidade sobre livro, páginas, duração, data ou categoria.

## Problemas encontrados, por prioridade

| Prioridade | Área | Evidência no código | Efeito para quem usa |
| --- | --- | --- | --- |
| P0 | Identidade nativa | `android/app/src/main/res/mipmap-*/ic_launcher*.png` e `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` ainda contêm a arte do Capacitor; o logo Lyceum está em `public/logo.svg` e `src/components/Logo.tsx`. `scripts/prepare-native-mobile-assets.mjs` não gera ícones. | O ícone instalado não identifica o Lyceum. |
| P0 | Registro: escolha do livro | `MobileReadingEntryScreen.tsx:311-336` empilha um `<select>` de toda a biblioteca e um campo manual; digitar no campo desfaz a seleção. Leituras remotas anteriores não entram na lista de escolha. | Encontrar um livro fica lento, sobretudo com biblioteca grande; há dois controles para uma mesma decisão. |
| P0 | Registro: formulário | `MobileReadingEntryScreen.tsx:339-405` usa placeholders em vez de rótulos permanentes, dois campos numéricos estreitos lado a lado e data + Hoje + Ontem em três colunas. A categoria não tem contexto visual. | Ao preencher, a pessoa perde a referência do campo; teclado e largura pequena apertam os controles. |
| P0 | Registro: consistência | `MobileReadingEntryScreen.tsx:56-66` escolhe silenciosamente a primeira categoria quando a categoria local não coincide com a remota. A criação valida valores só ao enviar (`:238-265`); a edição (`:88-104`) não compartilha essa validação. | É fácil registrar na categoria errada ou descobrir um erro apenas após tocar em Salvar. |
| P1 | Registro a partir do leitor | O atalho “Registrar leitura deste livro” em `MobileApp.tsx:895-905` só aparece quando `isEbookReader` é falso; `useMobileReaderState.ts:10` marca PDF e EPUB como leitores de ebook. | Nos formatos principais, a pessoa precisa sair do leitor e escolher o livro novamente na aba Registrar. |
| P1 | Registro: histórico e feedback | O histórico mostra no máximo 20 itens sem filtro, em linhas com título truncado, data ISO e botões de editar/remover de 36 px (`MobileReadingEntryScreen.tsx:409-455`). Sucesso e erro dependem sobretudo de toast. | Corrigir um registro antigo exige varrer a lista; a ação concluída tem pouca confirmação persistente. |
| P1 | Biblioteca | `MobileLibraryScreen.tsx:319-418` põe um bloco extenso de filtros, coleções e ações em `<details>` antes do cabeçalho; abaixo há breadcrumb, busca, chips, quatro botões de visualização/ação e FAB. Detalhes do livro reúnem muitos campos e ações em uma única folha (`:163-234`). | A primeira tela tem alta densidade e ações concorrentes; tarefas comuns se perdem entre opções avançadas. |
| P1 | Navegação e layout | `MobileApp.tsx:690-720,1128-1153` usa cinco abas com rótulos de 10 px; a aba Registrar é um formulário permanente e o cabeçalho some só na Biblioteca/leitor. O contêiner limita a 480 px e a barra inferior usa altura fixa. | Hierarquia e espaçamento mudam entre abas; há risco de conteúdo coberto pelo teclado ou pela barra inferior. |
| P1 | Painel | `MobileDashboardScreen.tsx:208-311` mostra quatro cartões, uma faixa semanal e dois gráficos antes dos atalhos sociais. A faixa depende de `title` para o detalhe e os gráficos usam texto de 11 px. | A informação compete pela atenção e parte dos detalhes não é acessível por toque ou leitor de tela. |
| P2 | Ranking e amigos | `MobileLeaderboardScreen.tsx` combina período, categoria, gerenciamento de amigos e ranking. Os convites usam botões de ícone de 36 px; a busca e o envio de convite ficam lado a lado. | A ação social exige interpretação de ícones pequenos e disputa espaço com a consulta ao ranking. |
| P2 | Perfil e leitor | O Perfil mistura conta, backup e atualização em uma lista longa em `MobileApp.tsx:940-1120`. `ReaderTools.tsx:109-145` coloca um botão flutuante de notas e várias funções numa tela única. | Funções importantes ficam escondidas e a densidade aumenta durante a leitura. |
| P2 | Base visual e acessibilidade | Não há biblioteca de componentes mobile para campos, botões, chips e folhas; classes Tailwind se repetem em cada tela. `src/index.css:153-159` substitui o foco padrão por uma regra global de `:focus-visible`, e vários controles mobile têm 36–40 px. | Tamanho de alvo, rótulos, foco, contraste e estados variam de tela para tela. |

## Direção do novo registro

1. **Entrada direta e contextual.** Abrir em um painel dedicado a “Registrar leitura”, com o livro atual pré-selecionado quando a ação vier do leitor. Mostrar “Continuar com [livro]” e livros recentes antes da busca. A escolha do livro deve pesquisar tanto a biblioteca local quanto títulos já usados em registros sincronizados. “Outro livro” abre um campo de título explícito; não manter `<select>` e texto editável simultâneos.
2. **Formulário progressivo de uma coluna.** Primeiro livro, depois “Páginas lidas” e “Tempo de leitura” com rótulos e unidades sempre visíveis. Data inicia em Hoje, com chips Hoje/Ontem e opção “Escolher data”; o calendário aparece só quando necessário. Categoria fica visível após a escolha do livro, com valor sugerido e possibilidade clara de alterar.
3. **Preenchimento rápido.** Usar teclado numérico, foco na próxima entrada e área de toque de pelo menos 44 × 44 px. Se houver número de página no leitor, considerar uma sugestão de quantidade, mas nunca inferir automaticamente páginas lidas a partir do progresso sem confirmação. Preservar rascunho ao trocar de aba ou fechar a folha acidentalmente.
4. **Validação e gravação.** Validar título, inteiros positivos, data válida e categoria antes do envio, com erro junto ao campo. Desabilitar dupla submissão; indicar claramente “Salvando…”. Quando a conexão cair, explicar que o registro requer conta/conexão e conservar o rascunho. Reutilizar as mesmas regras no editor. Verificar o contrato das RPCs antes de mudar a relação entre livro local, livro remoto e registro.
5. **Resultado e histórico.** Após salvar, mostrar confirmação no próprio fluxo com resumo “Livro · páginas · minutos · data” e ações “Registrar outra”/“Ver histórico”. Separar o histórico do formulário em uma vista ou seção recolhida, agrupada por data, com busca/filtro por livro e menu de ações por item. Exibir data localizada. Edição deve reabrir o mesmo formulário; remoção continua com confirmação clara.

Fluxo alvo: **tocar em Registrar → escolher livro recente ou buscar → informar páginas e minutos → conferir data/categoria → salvar**. Para quem entra pelo leitor, a etapa de escolha já vem resolvida, mas pode ser alterada.

## Plano de execução

### Etapa 1 — Identidade e fundamentos (P0)

- Gerar um ícone mestre a partir da marca Lyceum, com fundo e margem adequados ao recorte adaptativo do Android; exportar foreground/background, densidades e ícone redondo. Gerar também o AppIcon iOS opaco de 1024 px e splash coerente. Conferir todos os variantes num aparelho, inclusive ícones temáticos quando suportados.
- Integrar a geração/verificação dos recursos nativos ao processo de release, antes de `assembleRelease`, para evitar retorno do ícone padrão. Publicar em novo APK: `docs/mobile-release.md` confirma que OTA atualiza somente HTML/CSS/JS/assets web.
- Criar componentes mobile mínimos (campo rotulado, seletor pesquisável, botão, chip, folha/modal, mensagem de erro e estado vazio) e tokens para altura de alvo, raio, espaçamento e tipografia. Reutilizar em registro e, depois, nas demais telas.

**Aceite:** launcher Android e iOS exibem a marca em todos os tamanhos; nenhum asset nativo do Capacitor permanece; release falha se os assets esperados faltarem; navegação e campos mantêm foco visível e alvos de pelo menos 44 px.

### Etapa 2 — Registro de leitura (P0)

- Unificar criação e edição em um formulário compartilhado com validação, estados de carregamento/erro e sem perda de rascunho.
- Implementar escolha pesquisável de livro com recentes locais/remotos e caminho manual explícito. Adicionar atalho contextual aos leitores PDF e EPUB. Manter a associação correta ao livro remoto ao registrar e não mudar a identidade do livro ao apenas editar páginas/tempo.
- Reorganizar data, categoria, páginas e minutos no fluxo descrito acima. Incorporar confirmação local ao salvar e uma vista de histórico navegável com edição/remoção.
- Revisar comportamento sem sessão e sem internet, com mensagens contextuais e retorno ao rascunho após login/retomada.

**Aceite:** registro de livro recente em poucos toques; livro manual e livro aberto no leitor funcionam; nenhum campo depende só de placeholder; falhas mostram o campo afetado e preservam a entrada; edição, remoção e atualização do painel/ranking continuam corretas; uso com teclado aberto não cobre o botão principal.

### Etapa 3 — Biblioteca e navegação (P1)

- Trazer “Continuar lendo”, busca e importação para a parte mais visível da Biblioteca. Mover filtros avançados e criação de coleções para uma folha dedicada, com indicadores de filtros ativos e ação de limpar.
- Dividir “Detalhes do livro” em resumo e grupos editáveis (metadados, organização, compartilhamento), mantendo ações destrutivas separadas.
- Harmonizar cabeçalhos e barra inferior entre abas. Rever se Registrar deve permanecer como aba ou virar ação central contextual após testar os dois protótipos; manter sempre um acesso em um toque no painel e no leitor.

**Aceite:** continuar um livro e importar um arquivo são ações fáceis de localizar; a lista não começa abaixo de um painel longo; filtros ativos são evidentes; voltar de uma folha preserva a posição e o contexto.

### Etapa 4 — Painel, social, perfil e leitor (P1/P2)

- Priorizar resumo de hoje, último livro e próximo passo no Painel; deixar tendências e gráficos em seções secundárias. Dar alternativa textual e toque acessível aos dados exibidos apenas em gráfico ou `title`.
- Separar ranking de gestão de amigos e ampliar os botões de convite. Mostrar claramente o período e a categoria aplicados.
- Organizar Perfil por Conta, Dados/backup e Sobre/atualizações. Simplificar o caderno do leitor com abas e controles legíveis, sem cobrir o conteúdo durante a leitura.
- Padronizar feedback de carregamento, vazio, erro e conclusão, linguagem PT-BR, contraste, navegação por teclado/leitor de tela e adaptação a texto ampliado.

**Aceite:** tarefas principais de cada aba aparecem antes das opções avançadas; nenhuma informação essencial depende de hover; leitores de tela anunciam rótulos, estados e resultados; telas continuam usáveis com texto ampliado.

## Verificação e medidas

- Criar testes de integração para o fluxo de registro (manual, livro local, recente remoto, edição, erros, falha de rede e preservação do rascunho), além de validação dos assets nativos no build. Os testes mobile atuais em `src/test/mobileComponents.test.tsx` cobrem Biblioteca, confirmação, caderno e backup, mas não exercitam a tela de registro.
- Fazer revisão manual em Android e iOS com largura pequena, teclado aberto, orientação alterada, texto grande, TalkBack/VoiceOver e bibliotecas com muitos livros. Comparar estados logado, desconectado e offline.
- Medir tempo e número de toques para registrar um livro recente, taxa de erro/correção do formulário e taxa de conclusão do registro. Meta inicial de produto: livro recente registrado em até 30 segundos sem procura linear em uma lista longa; ajustar após observação com usuários.

## Ordem de entrega sugerida

1. Ícone nativo e verificação de release.
2. Novo registro, editor compartilhado e histórico.
3. Base visual reutilizável aplicada à Biblioteca e à navegação.
4. Painel, ranking, perfil e caderno do leitor.

Cada etapa pode ser entregue separadamente. A primeira exige APK novo; mudanças de UI web posteriores podem seguir o canal OTA existente, desde que não dependam de mudanças nativas.
