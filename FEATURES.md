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

- [ ] Quando eu estou com o Desenho ativado na aba de leitura de PDF. Quando eu faço um desenho em um canto da tela e faço outro desenho no outro canto da tela, ele considera os dois como o mesmo objeto e não me permite desenhar nada na página inteira, apenas mover isso de lugar.

- [ ] Quando eu faço um desenho em uma página e tento dar zoom entre duas páginas, ele altera o scroll da tela para fittar uma página certa (isso é uma inconsistência e atrapalha o fluxo de leitura).

- [ ] Eu quero remover por enquanto o deploy no github releases de versões iOS mobile, porque elas não estão funcionando e eu não quero lidar com isso agora. Então no mobile, ele só deve subir o deploy do Android.
