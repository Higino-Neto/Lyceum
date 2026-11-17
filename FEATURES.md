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

#### 2.0.0

- [x] O ring das pastas no foldergrid na library não está sendo mostrado na parte de cima. Como se o componente de cima cortasse ele ao invés de mostrar o topo. Resolva essa questão do espaçamento para que fique perfeitamente visível.

- [x] A label que mostra o número de volumes em cada Synced ou Not Synced ou USB Devices está com background escuro e o foreground escuro ao mesmo tempo, o que dá uma impressão estranha e fica feio. Resolva isso para todos os semelhantes dele.

- [x] O Folder Panel lateral esquerdo não está sendo mostrado no startup do aplicativo. Resolva isso.

- [x] O botão compare do editbookmetadata não funciona.

- [x] Existem vários compoenentes <select> na aplicação. Eu quero que você migre todos eles para o componente de UI <Select> que eu fiz, para deixar a UI mais consistente.

- [x] O Lyceum no linux não aparece como aplicativo recomendado no file explorer para abrir de fora do app. No windows ele já aparece. Resolva isso.

- [x] Quando eu clico no botão Open library folder de dentro da library, a pasta abre e o app para de responder até crashar.

- [x] A opção de organizar os livros da library por "list" está muito primitiva, refaça ela para ficar uma alternativa viável para quem gosta desse tipo de visão.

- [x] O folderTree não está persistindo as pastas que estão com as suas subpastas expandidas. Então quando eu clico fora, elas fecham. Isso é ruim. (O mesmo para as source folders). (Eu tentei modificar, mas agora ele fica com a seta apontando para baixo, mas não de fato atualiza o componente para mostrar as subfolders)

- [x] No linux, eu não consigo pegar um arquivo de dentro da library e arrastar ele para o file explorer ou para o whatsapp como eu posso no windows. Resolva isso.

- [x] O Modal de folhear o livro dentro de /readings não está na paleta de cores do lyceum e nem no i18n. Nem nada relacionado a ele. Eu quero que você atualize esse componente para que ele seja integrado de fato à aplicação.

- [x] Na aba de conversão, eu quero que você troque completamente o search file dele pelo search file do atlas, que é muito melhor em vários aspectos. Na verdade, eu quero pegar aquele modal "Add from library" do atlas e modularizar ele para que eu possa chamar ele em features futuras.

- [x] A aba de prévia de leitura tem 2 botões para fechar. Mas quando eu fecho todas as abas, ele não fecha o painel. Resolva isso (Tomando cuidado para não quebrar nenhuma funcionalidade da aba real de /readings).

- [x] Adicionar uma aba nas configurações para plugins. Dentro dela é que ficará as abas que estão em beta e outras coisas que eu quero ter a possibilidade de habilitar ou desabilitar quando eu quiser. Tipo conseguir desabilitar o FolderGrid e o Continue Reading

#### 3.0.0

- [x] Nessa nova feature do lyceum reader, eu quero que você use os design tokens que eu adotei na aplicação e olhe para como as outras features são visualmente para manter a consistência visual, que está faltando nessa nova janela.

- [x] Ao invés de um botão narrower panel, coloque aquela borda que dá para redimensionar, assim como vários outros componentes do aplicativo. Reaproveite essa lógica.

- [x] Não precisa ter um botão separado para adicionar palavras no vocabulário. Se a palavra for marcada como Learning, ela já tem que ir direto para lá e essa deve ser a forma do usuário conseguir colocar palavras para revisar.

- [x] Esses toasts do tipo: “énorme” → Learning, added to your vocabulary não devem aparecer mais. Pq o usuário vai clicar em várias dessas palavras e esse feedback não é necessário.

- [x] Botão direito em uma palavra abre um painel com várias funcionalidades inúteis. As únicas úteis ali são as de trocar o status da palavra, de adicionar nova nota, de abrir o painel lateral e de copiar a palavra.

- [x] Não é necessário um ícone no topo para mostrar que All changes saved. Isso deveria estar em um lugar que chame menos atenção.

- [x] As descrições do tipo (All forms, This form) são descrições ruins. Eu bato o olho e não sei o que significam. 

- [x] Essa parte da aba que fala:
READING
Chapter
1 / 4
Chapters finished
0
Reading time
30m
Sessions
4
Reading progress is tracked separately from vocabulary knowledge.

Pode ser apagada. Esse não é o escopo correto para essas funcionalidades.

- [x] Eu quero que Ctrl + click em uma palavra marque ela como Known automaticamente, sem precisar do fluxo de entrar na aba e trocar.

- [x] A tabela de words está travando, provavelmente porque ela não tem paginação como deveria (ou lazy loading).

- [x] No linux, quando eu clico no botão para abrir a pasta partindo da library, o aplicativo para de responder e crasha.

- [x] O folder tree atual é muito amadar, eu não consigo fazer alterações em lote com várias pastas, quando eu clico para deletar uma pasta, o dialog fica mais tempo na tela do que deveria, se eu tento apagar uma pasta que tem pastas dentro, ou não funciona direito, ou quando funciona o folder tree demora para atualizar, então o usuário não tem o feedback rápido que deveria.

- [x] Quando eu clico com botão direito na library para selecioanr um livro, eu não consigo ir com Ctrl ou Shift para selecionar vários de uma vez, o que é ruim para usuários que querem processar informações em lote.

- [x] O Folder tree na parte de source folders deveria ter opções menos invasivas, pq atualmente eu consigo apagar uma source folder, deletando ela do computador, mas não consigo desvincular ela. E mesmo que tivesse os dois botões, ainda não ficaria claro para o usuário qual seria o certo para tirar a pasta de dentro da library do lyceum e para realmente apagar a pasta do computador.

- [x] O source folder poderia perguntar para o usuário se ele deseja habilitar a busca inteligente. Que consistiria em recomendar pastas para serem novas pastas fonte, e o parâmetro para a escolha seria ter vários livros dentro da pasta. (Mas claro, só se o usuário permitir essa busca no computador dele). Porque algo que eu gostaria muito seria que o lyceum conseguisse ser inteligente o suficiente para saber aonde estão os livros no computador do usuário, porque muitas vezes eu acabo perdendo esses arquivos em pastas obscuras.

- [x] Os dicionários novos que você colocou do freeDict não estão funcionando no leitor de .lyceum pelo menos, porque quando eu tento usar, ele sempre pega a tradução da web.

- [x] O modo claro atual do lyceum é muito ruim. Eu sinto que parte disso é por causa da falta de contraste. No modo claro parece que tudo está muito claro na tela, inclusive a fonte e os componentes, o que deixa muito difícil de ver o que é o quê. Devem ter outras questões de design que deixam modos claros mais bonitos que você pode ficar à vontade para implementar. (E existem certos botões, tipo o start reading, que o fundo do botão e a fonte nunca combinam uns com os outros.

- [x] Ao clicar com o botão direito na aba Add PDF from library eu deveria ser capaz de selecionar vários livros de uma vez, com a mesma função que deve ser implementada na library de conseguir usar o Ctrl e o shift para pegar vários de uma vez.
Nessa aba também deve haver uma forma de selecionar e navegar pelas pastas, talvez pegar uma pasta inteira, além de outros filtros, como o status de leitura, para o usuário conseguir por exemplo selecionar rapidamente coisas como (Not a book) para facilitar a pesquisa.

- [x] O output preview do Convertion page está funcionando bem no caso EPUB -> PDF, contudo, a user Experience está muito ruim. O espaço é pequeno, é difícil clicar nos botões, a forma como as informações estão organizadas é contra-intuitiva e é difícil usar sem um manual. Esse sistema de dividir por capítulos com uma paginação em cima e outra em baixo, com um sendo um subcomponente da outra é confuso e difícil de usar. Um sistema mais simples, baseado no número de páginas final do PDF seria mais intuitivo. Com opção de escolher a página que o usuário quer ver, no viewer fullscreen ainda ter a opção de ir uma página adiante ou uma página antes. 

- [x] Na tela de conversão de EPUB -> PDF, é possível selecionar todas as margens, alturas de linha e espaçamentos, eu acho isso bom, mas em uma aba de configurações avançadas. Na parte inicial deveriam ter pressets desses espaçamentos baseados nas normas padrão de livros digitais, para facilitar a vida do usuário mais leigo.

- [x] Os logs de conversão não estão sendo traduzidos (E várias outras partes da aplicação estão esm tradução, só estando em português).

- [x] O sistema de pesquisa em todo o aplicativo ainda é meio amador. Coloque um sistema de pesquisa profissinal e inteligente.

- [x] O folder grid é uma boa ideia, mas atualmente ele ocupa muito espaço na tela e consegue ficar em várias linhas. O ideal seria se ele fosse mais compacto sem ocupar toda essa importância visual.

- [x] Crie um novo comando de npm run para eu conseguir rodar a aplicação do último build feito ou sem auto reload quando altera o código (quero ter as duas opções), porque às vezes eu quero testar as funcionalidades enquanto um agente muda algo no código.

- [x] Crie um dialog de what's new! que fala sobre o que foi feito nessa ou naquela atualização, com opção de ver versões antigas para os usuários sempre ficarem cientes do que está sendo feito no aplicativo.

- [x] Delete completamente as funcionalidades de Habit e Atlas (Eram funcionalidades beta que eu queria ver se funcionariam bem, mas eu não gostei).

- [x] Atualmente, ao fechar um arquivo PDF que eu fiz alterações, ele não me pergunta se eu quero salvar essas alterações sobrescrevendo o arquivo original ou criando um novo. Isso deveria acontecer. O mesmo para aquele botão de download que tem no pdf, ele deveria me dar mais opções, como sobrescrever o arquivo original ou coisas úteis assim.

- [x] Eu tentei instalar uma nova versão do lyceum no linux que o sistema baixou e a tela apareceu que não estava respondendo e depois o erro: Command pkexec exited with code 1. Quando eu tentei clicar para baixar de novo, apareceu Nenhuma atualizacao baixada para instalar. Quando eu tentei fechar o app, apareceu uma tela estranha de Authentication do linux bloqueando uma ação de super usuário e perguntando se eu queria rodar um comando de instalação no terminal (isso é ele instalando a nova versão, mas não tem como o usuário saber que é isso e não algum ataque de segurança ou algo assim). Deveria aparecer uma tela mais informativa falando sobre a atualização ao invés desse alerta.

- [x] Quando eu mesclo vários livros e dou nota, os cards de PDF, EPUB, e a nota ficam saindo das bordas do card do livro. Isso é um problema de responsividade da UI.

- [x] Eu não quero que o Lyceum fique colocando esses rings verdes aleatórios em tudo do app. Eu quero isso apareça apenas em locais em que eles são extremamente importantes, mas parece que eles estão sendo colocados em tudo sem distinção, além de que eles são muito feios e geralmente saem da tela, cortando.

- [x] No new folders with books were found. Esse erro aparece na config de busca inteligente, mesmo quando existem outras pastas com livros para serem adicionadas (eu estou no linux). Acabei de perceber que isso acontece quando a pasta tem poucos livros. Quando a pasta tem muitos livros funciona normalmente, mas eu quero que seja geral mesmo, já que ele está pesquisando por todos, é melhor mostrar todos ao invés de mostrar só os que tem muito mesmo.

- [x] Verifique como o sistema de thumbnails está sendo feito atualmente, pois eu temo que esse sistema pode não estar sendo idempotente com o tempo, tipo, ele pode estar duplicando imagens ao invés de sobrescrever ou algo assim, ou criando imagens com tamanhos muito grandes em relação ao que é mostrado na UI média, mas são só hipóteses.

- [x] A aba de registrar não faz mais sentido na aplicação:
My books
Manage links, duplicates and statistics for your records.

Essa parte não precisa mais existir porque hoje a biblioteca já evoluiu muito e isso não é mais necessário.

O book table que tem no /register é o mesmo que tem no dashboard, então a única coisa do /register que realmente é útil é esse componente de register new reading, que pode ser movido para o dashboard para ficar em cima do table que mostra os registros.

- [x] Ctrl + Scroll não está funcionando no leitor de PDF.

- [x] O convertion page deveria mostrar o tamanho estimado para o arquivo. (Isso é importante principalmente na conversão de CBZ -> PDF, porque eu preciso saber o quanto a redução da resolução da imagem vai impactar o tamanho real do arquivo no final.

- [x] Ao converter para um PDF, ao invés de mostrar Chapter 9 - Page 1, ou algo do tipo, eu quero que você mostre que ele está na página x de Total de páginas. É mais natural pensar assim em PDFs. Eu quero conseguir ver qual será a quantidade de páginas finais do PDF gerado, pois isso é um dado interessante de se ter, caso o usuário queira ajustar as margens.

- [x] Ao converter um EPUB -> PDF, é necessário escolher as margens, contudo, ter que alterar as 4 toda vez é muito chato. Coloque um slider para o usuário decidir quanto de margem horizontal ou margem vertical (Ambos considerando margens iguais para ambos os lados, dado que é um ebook) e opções avançadas para alterar um por um.

- [x] Eu quero que a tela quando você clica para abrir o Preview de uma das páginas do PDF tenha todas as opções de alteração lá mesmo, para eu ver de imediato como aquelas configurações de fato impactam o resultado final.

- [x] Eu tentei copiar o texto Chapter 9 - Page 1 da aba de conversão no preview e ele copiou o arquivo ao invés do Texto. Isso já aconteceu em outros lugares no app, não quero que se repita. Então resolva esse problema.

- [x] Quando eu mudo o nome de uma pasta, ele não atualiza automaticamente. Os livros somem por um momento e só depois de um tempo, sem nenhum feedback, eles voltam. Isso causa medo e desconfiança para o usuário.

- [x] Na topbar aonde está a label: FOLDERS no menu lateral de folder tree, existem vários ícones e cada um tem uma função, contudo, quando eu pego na barra lateral para diminuir o tamanho desse sidebar, esses componentes acabam saindo da tela, o que é um problema de responsividade.

- [x] No mobile, no leitor de .lyceum, o top bar que contém os capítulos e as configurações, ele some da tela para cima quando eu movo para baixo, contudo, ao invés de preencher aquele espaço com o texto que aparece, ele só some e fica preto no lugar que era para estar o texto. E para voltar ele, eu preciso rolar muito para cima. Eu quero precisar rolar pouco para ele voltar.

- [x] No mobile, no leitor de .lyceum, a aba de tradução está bonita e nativa para o mobile, mas a aba que tem Words, Progress, Chapters, Review e Notes não está nem um pouco nativa para o mobile. Tudo nela é muito pequeno, como se fosse pensada para o computador e só colocaram a mesma no celular. Quero que resolva isso. Além disso, abrir essa aba está sendo muito pesado e custoso no celular então ela está demorando um pouco para abrir e a performance não está das melhores dentro dela.

- [x] No mobile, no leitor de .lyceum, eu quero que você adicione opção de aumentar e diminuir a margem horizontal do texto. Atualmente tem como mudar a distância entre as linhas, mas não tem como mudar a distância entre o texto e as bordas da tela. Além disso, quando eu giro a tela no mobile,a responsividade não acompanha. Então o problema geral do leitor de .lyceum é uma falta de natividade para o contexto mobile.

- [x] No mobile, Na biblioteca, quando eu abro um EPUB qualquer, ele abre o EPUB normal, mas quando eu clico na parte de cima da tela, ao invés de abrir as configs do EPUB, ele abre o leitor .lyceum, sem motivo aparente.

- [x] No mobile, eu quero que você faça uma aba de Configuração real. Com os mesmos propósitos do que a do computador, mas nativa para o mobile (aquele tipo que mostra o título da configuração e quando você clica, ele abre, e sempre tem como voltar um galho na árvore ou avançar mais um. Essa nova Config deve conter tudo que já tem, updates, login, general.

- [x] No mobile, eu quero que de dentro de um arquivo EPUB, PDF, ou qualquer que seja, eu quero que seja possível nas configurações de dentro do arquivo trocar para a leitura .lyceum. E o sistema guarda a memória de qual é o formato que o usuário usou pela última vez naquele livro para ele saber se deve já iniciar o livro como .lyceum ou como a extensão original. Sempre tendo como trocar nas configs de dentro do .lyceum para o formato original e vice versa, para o sistema ficar mais inteligente.

- [x] Adicione a leitura .lyceum para outros formatos também, além de apenas EPUB e TXT.

- [ ] Eu quero que você coloque essas configurações aqui como padrão para a conversão de um PDF:
Top margin
20
mm
Bottom margin
20
mm
Left margin
20
mm
Right margin
20
mm
Text size
14
pt
Line height
1.5
Paragraph spacing
0.5
em

As configs abaixo devem levar em consideração aquele padrão adotado acima como um PDF padrão. Além disso, ao invés de mostrar várias opções dessas, coloque um Selector para elas. Pense mais em hierarquia visual nessa tela. O preview deveria ser uma prioridade, o restante são só adendos caso o usuário realmente precise.:
Layout

Screen reading
Comfortable on a monitor or tablet (A4).
A4 · 11pt

E-reader
Small page, thin margins and larger type for 6–7" screens.
A5 · 12pt

Paperback
Pocket-book proportions with classic margins (A5).
A5 · 10.5pt

Print
Academic print layout: 3 cm top/left, 2 cm bottom/right, 12 pt, 1.5 spacing.
A4 · 12pt

Large print
14 pt type with airy spacing for easier reading.
A4 · 14pt

- [ ] Eu quero deixar tudo relacionado ao Foldergrid como uma opção beta prestes a ser removida, tnanto ela quanto essa barra superior para adicionar nova pasta ou novo livro. Essas opções já nem fazem sentido estarem ali mais. Eu quero remover tudo isso para deixar essa parte da tela mais clean, até sem essas barras de divisão estranhas e esse espaçamento exagerado. De tudo ali, a única coisa que eu quero que permaneça, talvez movido para outra posição, ou ocupando menos espaço, é o folder path, pq ele é útil para o usuário. Mas de resto, eu não gosto dessa parte da UI e acho que ela pode ser eliminada, ou ao menos posta para ser eliminada no futuro e não mostrada mais na tela, e resolvendo esses problemas de barras inúteis e espaçamento exagerado, para deixar essa parte mais limpa e hierarquicamente bonita. Suma com tudo isso para simplificar a leitura e deixe isso apenas como uma opção nas configurações que vem desabilitada por padrão. E olhe para outras opções nas configurações que podem sem querer abrir essa funcionalidade de novo.

- [ ] Nas configs do aplicativo, eu quero que você reorganize melhor ela. Agrupe funções parecidas nos mesmos locais, pense melhor no que deve ir para cada lugar (Por exemplo, não faz sentido ter uma aba inteira só para um scroll de zoom e dentre outros). Utilize a organização de grandes aplicativos, como obsidian para se basear. Caso tenha sugestões de funcionalidades novas para a biblioteca, eu ficaria grato em saber.

