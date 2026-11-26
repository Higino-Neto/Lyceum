import type { SupportedLanguageCode } from "../../i18n/config";

export type ReleaseNoteKind = "new" | "improved" | "fixed" | "removed";

type Localized = Record<SupportedLanguageCode, string>;

export interface ReleaseNoteItem {
  kind: ReleaseNoteKind;
  text: Localized;
}

export interface ReleaseNote {
  version: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: Localized;
  items: ReleaseNoteItem[];
}

/**
 * Release history shown by the "What's new" dialog, newest first.
 * Add an entry here whenever `package.json` is bumped; entries newer than the
 * running app version are hidden until that version ships.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.14.0",
    date: "2026-11-25",
    title: {
      en: "Gmail sends books up to 25 MB and you name your conversions",
      "pt-BR": "O Gmail envia livros de até 25 MB e você escolhe o nome das conversões",
    },
    items: [
      { kind: "fixed", text: { en: "Send to Kindle by Gmail refused books above 18.75 MB. Gmail's 25 MB limit applies to the file itself, so books up to 25 MB now go through.", "pt-BR": "O envio para o Kindle pelo Gmail recusava livros acima de 18,75 MB. O limite de 25 MB do Gmail vale para o próprio arquivo, então livros de até 25 MB agora passam." } },
      { kind: "new", text: { en: "Conversion: choose the name of the converted file. Leave it empty to keep the default name.", "pt-BR": "Conversão: escolha o nome do arquivo convertido. Deixe vazio para manter o nome padrão." } },
    ],
  },
  {
    version: "1.13.0",
    date: "2026-11-22",
    title: {
      en: "A full word page on the phone and working vocabulary sync",
      "pt-BR": "Página completa da palavra no celular e sincronização de vocabulário funcionando",
    },
    items: [
      { kind: "fixed", text: { en: "Phone: vocabulary sync failed with \"Sync failed: {}\" before the first snapshot existed in the account. It now creates it, and real server errors are shown with their message.", "pt-BR": "Celular: a sincronização do vocabulário falhava com \"Sync failed: {}\" antes de existir o primeiro backup na conta. Agora ela o cria, e erros reais do servidor aparecem com a mensagem." } },
      { kind: "new", text: { en: "Pull the word card up for a full word page: translations you can save with one tap, meanings with examples, synonyms, the word in this book (all forms or only this one, with jumps and sentences), inflections, grammar and expressions, pronunciation recordings, related words and etymology.", "pt-BR": "Puxe o cartão da palavra para cima para abrir a página completa: traduções que você salva com um toque, significados com exemplos, sinônimos, a palavra neste livro (todas as formas ou só esta, com saltos e frases), flexões, gramática e expressões, gravações de pronúncia, palavras relacionadas e etimologia." } },
      { kind: "new", text: { en: "The word card shows how many times the word appears counting every inflection (irregular forms come from the Wiktionary dictionary) and how many times this exact form appears.", "pt-BR": "O cartão mostra quantas vezes a palavra aparece contando todas as flexões (formas irregulares vêm do dicionário Wiktionary) e quantas vezes aparece esta forma exata." } },
      { kind: "new", text: { en: "\"Mark all forms as known\" marks the word and every inflection of it in the book in one tap.", "pt-BR": "\"Marcar as formas como conhecidas\" marca a palavra e todas as flexões dela no livro com um toque." } },
      { kind: "new", text: { en: "New reader setting: play the pronunciation as soon as you tap a word.", "pt-BR": "Nova configuração do leitor: tocar a pronúncia assim que você toca numa palavra." } },
    ],
  },
  {
    version: "1.12.2",
    date: "2026-11-21",
    title: {
      en: "A new word card on the phone and more reliable saving",
      "pt-BR": "Novo cartão de palavra no celular e salvamento mais confiável",
    },
    items: [
      { kind: "new", text: { en: "Phone word card: pull it up to see the details right there — occurrences in the book and chapter with jumps between them, synonyms and antonyms, all translations, meanings with examples, the book's sentences and forms, your translation, then related words, inflections and etymology.", "pt-BR": "Cartão de palavra no celular: puxe para cima para ver os detalhes ali mesmo — ocorrências no livro e no capítulo com saltos entre elas, sinônimos e antônimos, todas as traduções, significados com exemplos, frases e formas do livro, sua tradução e, depois, palavras relacionadas, flexões e etimologia." } },
      { kind: "improved", text: { en: "The pronunciation button plays the native-speaker recording from Wiktionary when there is one.", "pt-BR": "O botão de pronúncia toca a gravação de falante nativo do Wiktionary quando existe." } },
      { kind: "fixed", text: { en: "Phone: \"Could not save your learning data\" after the system closed the app's database in the background; Lyceum now reconnects and saves. A full storage is reported as such.", "pt-BR": "Celular: \"Não foi possível salvar seus dados de aprendizado\" depois que o sistema fechava o banco de dados do app em segundo plano; o Lyceum agora reconecta e salva. Armazenamento cheio é informado como tal." } },
      { kind: "fixed", text: { en: "Phone: the dictionary list no longer goes empty (and the Wiktionary dictionary no longer disappears) when the older dictionaries fail to load.", "pt-BR": "Celular: a lista de dicionários não fica mais vazia (e o dicionário Wiktionary não some mais) quando os dicionários antigos falham ao carregar." } },
    ],
  },
  {
    version: "1.12.1",
    date: "2026-11-21",
    title: {
      en: "Wiktionary dictionaries on the phone",
      "pt-BR": "Dicionários Wiktionary no celular",
    },
    items: [
      { kind: "fixed", text: { en: "Android: the Wiktionary dictionaries now appear in the reader's dictionary list (the native download and database components were not registered in 1.12.0).", "pt-BR": "Android: os dicionários Wiktionary agora aparecem na lista de dicionários do leitor (os componentes nativos de download e banco de dados não estavam registrados na 1.12.0)." } },
    ],
  },
  {
    version: "1.12.0",
    date: "2026-11-21",
    title: {
      en: "Wiktionary dictionaries: meanings, synonyms, pronunciation and translations between five languages",
      "pt-BR": "Dicionários Wiktionary: significados, sinônimos, pronúncia e traduções entre cinco idiomas",
    },
    items: [
      { kind: "new", text: { en: "Wiktionary dictionaries for English, Portuguese, Spanish, French and German, on the computer and on the phone. One download per language you read gives translations into all the others, meanings with examples, IPA and native-speaker audio, synonyms, antonyms, related and derived words, inflections and etymology, offline.", "pt-BR": "Dicionários Wiktionary de inglês, português, espanhol, francês e alemão, no computador e no celular. Um download por idioma que você lê traz traduções para todos os outros, significados com exemplos, IPA e áudio de falantes nativos, sinônimos, antônimos, palavras relacionadas e derivadas, flexões e etimologia, sem internet." } },
      { kind: "improved", text: { en: "Inflected words are found: clicking \"courait\", \"yeux\" or \"chevaux\" opens \"courir\", \"œil\" and \"cheval\" and says which form it is (imperfect, plural…).", "pt-BR": "Palavras flexionadas são encontradas: clicar em \"courait\", \"yeux\" ou \"chevaux\" abre \"courir\", \"œil\" e \"cheval\" e mostra qual é a forma (imperfeito, plural…)." } },
      { kind: "improved", text: { en: "The word inspector has a Dictionary section with the full entry; the phone's word card shows the pronunciation and the dictionary translation.", "pt-BR": "O inspetor de palavras ganhou a seção Dicionário com o verbete completo; o cartão de palavra no celular mostra a pronúncia e a tradução do dicionário." } },
    ],
  },
  {
    version: "1.11.0",
    date: "2026-11-19",
    title: {
      en: "Pick pages while riffling and pull the exercises out of any book",
      "pt-BR": "Selecione páginas ao folhear e separe os exercícios de qualquer livro",
    },
    items: [
      { kind: "new", text: { en: "Riffle through the book: right-click pages to pick them (right-drag picks several, Ctrl+click toggles, Shift+click picks a range, Space picks the inspected page) and export only those pages as a new PDF. Picks are kept per book and shown on the book edge.", "pt-BR": "Folhear o livro: clique com o botão direito nas páginas para selecioná-las (arrastar com o botão direito seleciona várias, Ctrl+clique alterna, Shift+clique seleciona um intervalo, Espaço seleciona a página em destaque) e exporte só essas páginas como um novo PDF. A seleção fica salva por livro e aparece na borda do livro." } },
      { kind: "new", text: { en: "PDF Builder: \"Exercises from a book\" finds the exercise pages of a PDF (by outline, section titles, running headers and the layout of the questions) and keeps only them, or removes them to split theory from practice. Review by chapter, adjust sensitivity, include answer keys or exercises within the text, and leave out single pages.", "pt-BR": "PDF Builder: \"Exercícios de um livro\" encontra as páginas de exercícios de um PDF (pelo sumário, títulos de seção, cabeçalhos e formato das questões) e mantém só elas, ou as remove para separar teoria de prática. Revise por capítulo, ajuste a sensibilidade, inclua gabaritos ou exercícios no meio do texto e deixe páginas avulsas de fora." } },
      { kind: "new", text: { en: "\"Pick exercises\" in the riffle dialog pre-selects the detected exercise pages so you can fine-tune and export them.", "pt-BR": "\"Selecionar exercícios\" no diálogo de folhear pré-seleciona as páginas de exercícios detectadas para você ajustar e exportar." } },
    ],
  },
  {
    version: "1.10.0",
    date: "2026-11-17",
    title: {
      en: "Send books between your devices, vocabulary synced everywhere, and a native phone experience",
      "pt-BR": "Envie livros entre seus aparelhos, vocabulário sincronizado em todos e experiência nativa no celular",
    },
    items: [
      { kind: "new", text: { en: "Send to my devices: select books in the library (or open a book's details on the phone) and send them to your account; they appear in the library of your other devices, computer or phone.", "pt-BR": "Enviar para meus aparelhos: selecione livros na biblioteca (ou abra os detalhes de um livro no celular) e envie para sua conta; eles aparecem na biblioteca dos seus outros aparelhos, computador ou celular." } },
      { kind: "new", text: { en: "Vocabulary sync: words, translations and notes are merged between the computer and the phone automatically, with a \"Sync now\" button in vocabulary backups.", "pt-BR": "Sincronização de vocabulário: palavras, traduções e notas são combinadas entre o computador e o celular automaticamente, com um botão \"Sincronizar agora\" nos backups de vocabulário." } },
      { kind: "new", text: { en: "Conversion preview shows the final page count and an estimated file size (compared with the original), which helps when shrinking comics to PDF.", "pt-BR": "A prévia de conversão mostra o total de páginas final e o tamanho estimado do arquivo (comparado ao original), útil ao reduzir quadrinhos para PDF." } },
      { kind: "new", text: { en: "The enlarged conversion preview has every setting beside the page, so each change is visible right away.", "pt-BR": "A prévia ampliada da conversão traz todas as configurações ao lado da página, para ver cada mudança na hora." } },
      { kind: "new", text: { en: "EPUB → PDF: horizontal and vertical margin sliders, with each side still adjustable in the advanced settings.", "pt-BR": "EPUB → PDF: controles de margem horizontal e vertical, com cada lado ainda ajustável nas configurações avançadas." } },
      { kind: "new", text: { en: ".lyceum reading now opens MOBI, AZW3, FB2 and DOCX books on desktop, and PDF books on the phone.", "pt-BR": "A leitura .lyceum agora abre livros MOBI, AZW3, FB2 e DOCX no computador, e PDF no celular." } },
      { kind: "new", text: { en: "Mobile: a real Settings tab (account, general, reading, updates, data and about) that you browse level by level.", "pt-BR": "Celular: uma aba de Ajustes de verdade (conta, geral, leitura, atualizações, dados e sobre), navegada nível a nível." } },
      { kind: "new", text: { en: "Mobile: switch any book between its own reader and .lyceum from the reader settings; Lyceum remembers the mode per book.", "pt-BR": "Celular: troque qualquer livro entre o leitor original e o .lyceum pelas configurações do leitor; o Lyceum lembra o modo de cada livro." } },
      { kind: "new", text: { en: "Mobile .lyceum reader: adjustable side margins.", "pt-BR": "Leitor .lyceum no celular: margens laterais ajustáveis." } },
      { kind: "improved", text: { en: "Mobile .lyceum reader: the top bar hides while reading and the text takes its place; a short scroll up brings it back. Rotating the phone keeps the layout and position.", "pt-BR": "Leitor .lyceum no celular: a barra superior some durante a leitura e o texto ocupa o espaço; uma rolagem curta para cima a traz de volta. Girar o celular mantém o layout e a posição." } },
      { kind: "improved", text: { en: "Mobile: the Words, Progress, Chapters, Review and Notes panel was rebuilt for touch and opens instantly.", "pt-BR": "Celular: o painel de Palavras, Progresso, Capítulos, Revisão e Notas foi refeito para toque e abre na hora." } },
      { kind: "improved", text: { en: "The folder tree toolbar moves the actions that do not fit into a \"More\" menu when the sidebar is narrow.", "pt-BR": "A barra da árvore de pastas move as ações que não cabem para um menu \"Mais\" quando a barra lateral fica estreita." } },
      { kind: "fixed", text: { en: "Renaming or moving a folder keeps it selected and expanded: its books no longer disappear for a while.", "pt-BR": "Renomear ou mover uma pasta a mantém selecionada e expandida: os livros não somem mais por um tempo." } },
      { kind: "fixed", text: { en: "Ctrl+C copies the selected text instead of the selected book files.", "pt-BR": "Ctrl+C copia o texto selecionado em vez dos arquivos dos livros selecionados." } },
      { kind: "fixed", text: { en: "Mobile EPUB: tapping the top of the page shows the controls instead of opening the .lyceum reader.", "pt-BR": "EPUB no celular: tocar no topo da página mostra os controles em vez de abrir o leitor .lyceum." } },
    ],
  },
  {
    version: "1.9.2",
    date: "2026-11-17",
    title: {
      en: "Language learning on mobile, smarter library",
      "pt-BR": "Aprendizado de idiomas no celular, biblioteca mais inteligente",
    },
    items: [
      { kind: "new", text: { en: "Mobile: the language-learning reader comes to the phone for EPUB and TXT books, with tappable words, translation, offline dictionaries and vocabulary shared by language.", "pt-BR": "Celular: o leitor de aprendizado de idiomas chega ao celular para livros EPUB e TXT, com palavras tocáveis, tradução, dicionários offline e vocabulário por idioma." } },
      { kind: "new", text: { en: "Mobile: double-tap marks a word as known, and the end of each chapter can mark the words you did not tap as known (with undo).", "pt-BR": "Celular: toque duplo marca a palavra como conhecida, e o fim de cada capítulo pode marcar como conhecidas as palavras que você não tocou (com desfazer)." } },
      { kind: "new", text: { en: "Mobile: vocabulary is backed up automatically to Documents/Lyceum/Vocabulario and can be exported/imported in the same format as the desktop app.", "pt-BR": "Celular: o vocabulário é copiado automaticamente para Documentos/Lyceum/Vocabulario e pode ser exportado/importado no mesmo formato do app de computador." } },
      { kind: "new", text: { en: "Mobile: \"Continue reading\" on the Today screen, even when signed out.", "pt-BR": "Celular: \"Continuar lendo\" na tela Hoje, mesmo sem conta conectada." } },
      { kind: "improved", text: { en: "Mobile EPUB reader: swipe or tap the edges to turn pages, tap the center for controls, position slider and chapter jumps; scrolling flows across chapters.", "pt-BR": "Leitor EPUB no celular: deslize ou toque nas bordas para virar a página, toque no centro para os controles, barra de posição e salto de capítulos; a rolagem passa de um capítulo para o outro." } },
      { kind: "improved", text: { en: "Mobile: books open faster and large PDFs no longer exhaust memory.", "pt-BR": "Celular: os livros abrem mais rápido e PDFs grandes não esgotam mais a memória." } },
      { kind: "fixed", text: { en: "Mobile: the Android back gesture closes the open panel or reader instead of leaving the app (new APK).", "pt-BR": "Celular: o gesto de voltar do Android fecha o painel ou leitor aberto em vez de sair do app (novo APK)." } },
      { kind: "fixed", text: { en: "Books whose metadata says \"fre\" or \"French\" are filed under the same language as \"fr\".", "pt-BR": "Livros cujos metadados dizem \"fre\" ou \"French\" são guardados no mesmo idioma que \"fr\"." } },
      { kind: "new", text: { en: "Global search (Ctrl+K): books, folders, pages, settings and actions, tolerant to accents and typos.", "pt-BR": "Pesquisa global (Ctrl+K): livros, pastas, páginas, configurações e ações, tolerante a acentos e erros de digitação." } },
      { kind: "new", text: { en: "This \"What's new\" dialog, with the history of every release.", "pt-BR": "Este diálogo de novidades, com o histórico de todas as versões." } },
      { kind: "new", text: { en: "Plugins tab in Settings to turn beta routes, the folder grid and Continue reading on or off.", "pt-BR": "Aba Plugins nas configurações para ligar ou desligar rotas beta, a grade de pastas e o Continuar lendo." } },
      { kind: "new", text: { en: "Ctrl/Shift multi-selection in the library and in the \"Add from library\" picker, with folder and reading-status filters.", "pt-BR": "Seleção múltipla com Ctrl/Shift na biblioteca e no seletor \"Adicionar da biblioteca\", com filtros por pasta e status de leitura." } },
      { kind: "new", text: { en: "Source folders can be unlinked from the library without deleting anything from disk, and Lyceum can suggest folders that contain books.", "pt-BR": "Pastas fonte podem ser desvinculadas da biblioteca sem apagar nada do disco, e o Lyceum pode sugerir pastas que contêm livros." } },
      { kind: "new", text: { en: "EPUB → PDF layout presets, with the fine-grained spacing controls moved to an advanced section.", "pt-BR": "Predefinições de layout para EPUB → PDF, com os controles finos de espaçamento em uma seção avançada." } },
      { kind: "improved", text: { en: "The PDF output preview now pages through the final PDF page by page.", "pt-BR": "A prévia do PDF final agora navega página a página." } },
      { kind: "improved", text: { en: "Folder tree remembers expanded folders, supports multi-selection and deletes to the trash instantly.", "pt-BR": "A árvore de pastas lembra as pastas expandidas, permite seleção múltipla e exclui para a lixeira na hora." } },
      { kind: "improved", text: { en: "Redesigned list view in the library and a more compact folder carousel.", "pt-BR": "Visualização em lista redesenhada na biblioteca e carrossel de pastas mais compacto." } },
      { kind: "improved", text: { en: "Higher-contrast light theme.", "pt-BR": "Tema claro com mais contraste." } },
      { kind: "improved", text: { en: "Library search ranks title matches first and still finds books with typos.", "pt-BR": "A busca da biblioteca prioriza o título e encontra livros mesmo com erros de digitação." } },
      { kind: "improved", text: { en: "Conversion logs and warnings are translated.", "pt-BR": "Os logs e avisos de conversão agora são traduzidos." } },
      { kind: "fixed", text: { en: "Opening the library folder on Linux no longer freezes the app.", "pt-BR": "Abrir a pasta da biblioteca no Linux não trava mais o aplicativo." } },
      { kind: "fixed", text: { en: "Lyceum is offered as a recommended app for books in Linux file managers.", "pt-BR": "O Lyceum aparece como aplicativo recomendado para livros nos gerenciadores de arquivos do Linux." } },
      { kind: "fixed", text: { en: "Offline FreeDict dictionaries are used by the .lyceum reader before falling back to the web.", "pt-BR": "Os dicionários offline FreeDict são usados no leitor .lyceum antes de recorrer à web." } },
      { kind: "removed", text: { en: "The Atlas and Habit tracker betas were removed.", "pt-BR": "Os betas Atlas e Rastreador de hábitos foram removidos." } },
    ],
  },
  {
    version: "1.9.1",
    date: "2026-11-16",
    title: { en: "Packaging fix", "pt-BR": "Correção de empacotamento" },
    items: [
      { kind: "fixed", text: { en: "Fixed the Linux .deb/.rpm packaging that broke the 1.9.0 release builds.", "pt-BR": "Corrigido o empacotamento .deb/.rpm do Linux que quebrou as builds da versão 1.9.0." } },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-11-16",
    title: { en: "Diagnostics and vocabulary backup", "pt-BR": "Diagnóstico e backup de vocabulário" },
    items: [
      { kind: "new", text: { en: "App logs and a diagnostics report to help track down problems.", "pt-BR": "Logs do aplicativo e relatório de diagnóstico para ajudar a encontrar problemas." } },
      { kind: "new", text: { en: "Vocabulary backup section in Settings.", "pt-BR": "Seção de backup do vocabulário nas configurações." } },
      { kind: "improved", text: { en: "Format chips on the library grid and more reliable merged books.", "pt-BR": "Etiquetas de formato na grade da biblioteca e livros mesclados mais confiáveis." } },
      { kind: "removed", text: { en: "Collections were replaced by per-file control over merged books.", "pt-BR": "As coleções foram substituídas pelo controle por arquivo dos livros mesclados." } },
    ],
  },
  {
    version: "1.8.30",
    date: "2026-11-15",
    title: { en: "More formats and Kindle page numbers", "pt-BR": "Mais formatos e números de página do Kindle" },
    items: [
      { kind: "new", text: { en: "Read MOBI, AZW, AZW3, DOCX, FB2, TXT, HTML, CBZ and CBR files directly in the reader.", "pt-BR": "Leia arquivos MOBI, AZW, AZW3, DOCX, FB2, TXT, HTML, CBZ e CBR diretamente no leitor." } },
      { kind: "new", text: { en: "Kindle page numbers (APNX) when sending books to a Kindle.", "pt-BR": "Números de página do Kindle (APNX) ao enviar livros para o Kindle." } },
      { kind: "new", text: { en: "Duplicate finder and configurable list columns in the library.", "pt-BR": "Localizador de duplicados e colunas configuráveis na lista da biblioteca." } },
      { kind: "new", text: { en: "The Lyceum Reader for language learning: Ctrl+click marks a word as Known.", "pt-BR": "O Lyceum Reader para aprender idiomas: Ctrl+clique marca uma palavra como conhecida." } },
      { kind: "new", text: { en: "PDF Builder to merge PDFs and images into a single document.", "pt-BR": "PDF Builder para juntar PDFs e imagens em um único documento." } },
      { kind: "new", text: { en: "Send to Kindle by e-mail.", "pt-BR": "Enviar para o Kindle por e-mail." } },
    ],
  },
];

function parseVersion(version: string): number[] {
  return version.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Notes for versions already shipped to this install (newest first). */
export function getVisibleReleaseNotes(currentVersion: string | undefined): ReleaseNote[] {
  if (!currentVersion) return RELEASE_NOTES;
  return RELEASE_NOTES.filter((note) => compareVersions(note.version, currentVersion) <= 0);
}

/** Notes released after `lastSeenVersion`, up to and including `currentVersion`. */
export function getUnseenReleaseNotes(
  lastSeenVersion: string | null,
  currentVersion: string | undefined,
): ReleaseNote[] {
  if (!lastSeenVersion) return [];
  return getVisibleReleaseNotes(currentVersion)
    .filter((note) => compareVersions(note.version, lastSeenVersion) > 0);
}
