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
    version: "1.10.0",
    date: "2026-11-16",
    title: {
      en: "Smarter library, cleaner settings",
      "pt-BR": "Biblioteca mais inteligente, configurações mais limpas",
    },
    items: [
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
