# Features

#### 0.0.1 Feats and Bugs

- [x] Quando eu estou pesquisando dentro da Library do Lyceum, eu quero que o Grid de Pastas fique comprimido por padrão, para não atrapalhar a visualização da pesquisa. (Um botão para colapsar o Grid de pastas e salvar essa opção do usuário na memória também é interessante).

- [x] Quando eu lanço uma nova versão mobile, o desktop não consegue encontrar as novas versões, talvez pq a do mobile está na frente lá no github releases. Resolva esse problema.

- [x] Adicione uma aba de hotkeys nas Configurações. Por padrão, eu quero que (ESQ) foque no sidebar e no ícone da rota em que o usuário está (Abra ele caso esteja com auto-hide). Nesse caso, se ele mover as setas (UP) ou (DOWN), ele vai diretamente para a rota de cima e de baixo.
Se ele digitar os números do teclado (1, 2, 3, 4, 5, 6, 7), ele é redirecionado para as respectivas rotas padrão. (Eu quero que quando um usuário ativar ou desativar uma rota na parte de rotas beta, esse sistema de hotkeys também atualize por padrão para deixar a ordem natural), caso o usuário ainda não tenha alterado, se ele tiver alterado manualmente, não sobrescreva.

- [x] Clicar no botão de sair da conta não deveria sair da conta imediatamente. Ele deveria mostrar um dialog perguntando se o usuário deseja realmente sair da conta.

- [x] Ao clicar na rota de Conta, ele abre a configuração na aba de conta, como deveria, mas se de lá eu tento ir para a sub-aba Geral, ou Configurações, ele fica travado e não sai. Resolva essa inconsistência, pois o usuário pode querer de lá ir para outra configuração.

- [x] Toda vez que o Lyceum abre, ele faz backup de várias coisas. Eu não quero que ele faça esses backups toda vez que ele abre. Eu quero que os backups sejam mais periódicos e selecionados. Com uma aba nas configurações para quem quiser fazer backups manuais. E os backups periódicos terão somente coisas necessárias e acontecerão talvez uma vez por semana ou algo assim, porque realmente está demais.

- [x] As versões mobile estão impedindo a atualização do Desktop. Encontre uma forma de resolver isso.

#### 0.0.2 Library Feats and Bugs

- [x] Desmesclar e Manter arquivos Não funciona pois aparece (Permissão negada). O mesmo para Remover coleção.

- [x] A cor dos botões de desmesclar e remover coleção está inconsistente com as cores do restante do projeto. Eu não quero esse amarelo estranho, eu quero que você use a mesma paleta dos botões de Remover, inclusive se puder reaproveitar o mesmo modal, pode.

- [x] Quando tem apenas dois ou 3 livros no topo do BookDetail Panel, eu quero que você deixe os botões para trocar de um para o outro centralizados e mais parecidos com a paleta e estilo do Lyceum, pois está um pouco desarmônico.

- [x] Quando eu estou em um livro mesclado, quando eu tento alterar o nome do livro, ele altera no sistema, mas não altera o nome no arquivo. Na verdade, qualquer arquivo que eu tento renomear só renomeia dentro do Lyceum, mas não no arquivo em si.

- [x] Nos livros mesclados e nas coleções, eu quero ter a opção de remover apenas um livro da coleção no BookDetail, ou remover os selecionados quando eu clico com botão direito em vários.

- [x] Quando eu clico para arrastar um livro, ou vários selecionados, eu quero que ele mostre aqueles ícones bonitos de movimento de arquivos. E, quando o usuário pegar esses livros selecionados e mover para fora da tela do lyceum, eu quero que ele possa por exemplo colar eles no whatsapp, ou na área de trabalho e etc. Eu quero que o mesmo ocorra com o Ctrl + C (Funcionando fora e dentro do aplicatico) e Ctrl + x funcionadno dentro. Imagina o usuário podendo só copiar vários arquivos de uma pasta com Ctrl + c, ou recortar com Ctrl + x e colar em outra pasta. Ou ir com Ctrl + C e jogar os livros na área de trabalho ou no whatsapp.

- [x] Quando eu clicar pela segunda vez na Abrir Prévia Lateral, eu quero que ele feche ao invés de atualizar.

- [x] Eu quero que o FolderGrid atual pare de ocupar mais de uma linha e vire um carrossel

#### 0.1.0 Deixar o Lyceum (Com modo de desempenho desativado) mais fluido, assim como os softwares da Apple

- [x] O Mostrar ocultar Painel de Capítulos no PDF.js não faz motion quando o modo desempenho está desligado. Resolva isso e procure outros pontos de microinterações cujo feedback com movimento para o usuário não impactaria muito no processamento mas seria bonito, assim como a Apple faz nos sistemas dela para parecer muito fluido. Eu sinto falta disso no lyceum.

#### 1.1.1 Mobile

- [x] O leitor de PDF atual do Mobile não suporta zoom nativo do mobile, aquele que você afasta os dedos em formato de pinça.

- [x] Quando eu abro o aplicativo, ao invés de aparecer um skeleton rodando e esperando os componentes carregarem, ele aparece para fazer login e depois aparece a tela quando ele consegue buscar os dados. Isso causa uma certa estranheza para o usuário.

- [x] Quando eu abro um livro por fora do aplicativo, tipo no explorador de arquivos do celular ou no whatsapp, ao invés de abrir o arquivo e mostrar para o usuário (Como deveria ser o fluxo normal), ele importa o arquivo (Isso poderia até acontecer, mas em segundo plano). E nem abre o arquivo. Além disso, o Toast de IMPORTACOES não tem um timeout para sair da tela, então ele fica lá até eu clicar para tirar ele.

- [x] Nenhum arquivo está abrindo no mobile. Quando eu tento abrir eles, aparece só Nao foi possivel abrir. Cannot destructure property 'AbortException' of 'globalThis.pdfjsLib' as it is undefined. Resolva isso.

- [x] Na aba Hoje do mobile, ao invés de ter esses cards inúteis de Leaderboard ou N Amigos, seria mais inteligente ter mais gráficos, assim como tem muitos na versão desktop, e também colocar o Heatmap que funciona tão bem no desktop.

- [x] Todos os componentes que não são botões do mobile, como Select ou Input, estão bem sucateados e poderiam ser muito melhores do que são atualmente. Tanto na aba de Registrar Leituras quanto na aba de Leaderboard, eu sinto falta de componentes Selects (Aqueles que abrem e mostram várias opções) mais bonitos. Na aba de registrar leituras, está tão estranho o design que até os ícones estão inconsistentes, o ícone de livro aberto e a lupa de pesquisa por exemplo estão em cima da label. E aquela seta para baixo está em baixo da label ao invés de estar do lado. Isso tem que ser resolvido criando componentes mais bonitos e condizentes com o design do aplicativo.

- [x] O sistema de notas nos pdfs está sucateado também. Aparece um ícone de criação de nota estranho no canto direito da tela que não deveria existir. Quando eu seleciono um texto ele mostra um pop up chato pedindo para adicionar uma nova nota. Eu não quero nada disso. Eu não quero que apareça nada quando um usuário selecionar um texto na tela. A única opção que eu quero preservar é aquela opção no topo de marcar a página com um marca página (Ela é útil). Toda essa parte de caderno de leitura pode sumir. Ela não é útil.


#### 1.1.1 PDF Viewer

- [x] Quando eu estou com o Desenho ativado na aba de leitura de PDF. Quando eu faço um desenho em um canto da tela e faço outro desenho no outro canto da tela, ele considera os dois como o mesmo objeto e não me permite desenhar nada na página inteira, apenas mover isso de lugar.

- [x] Quando eu faço um desenho em uma página e tento dar zoom entre duas páginas, ele altera o scroll da tela para fittar uma página certa (isso é uma inconsistência e atrapalha o fluxo de leitura).

- [ ] O botão de + Concept que aparece no viewer desktop atrapalha a leitura. Ele deveria aparecer apenas quando o usuário clicasse com botão direito no documento. Se ele clicar com botão direito e estiverselecionando algum texto, ele vai usar esse texto que ele selecionou, se não, ele também vai funcionar, vai estar naquela página, mas não terá texto. E ao invés de colocar um botão feio como está agora com texto, faça apenas um ícone bonito. Pensando bem, esse esse botão até pode aparecer, mas em conjunto com um botão de copiar, abaixo da última linha de seleção só quando o usuário soltar a tecla que ele está pressionando, assim não atrapalha a seleção enquanto ele ainda está fazendo ela.

- [ ] A seleção de texto atual ainda não suporta zooms, se eu mudo o zoom ela quebra. Eu quero adicionar essa funcionalidade sem simplesmente excluir esse código que eu implementei, mas construir em cima dele, pois eu pretendo alterar muitas vezes essa parte de seleção, então eu preciso da minha própria seleção ao invés da seleção nativa do PDF.js (Mas pode usar a seleção do PDF.js como inspiração para resolver esse problema e similares).
