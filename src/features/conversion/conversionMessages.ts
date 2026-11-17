import { translate, type TranslationKey } from "../../i18n";
import { translateKindleStageMessage } from "../kindle/kindleSendMessages";

/**
 * The conversion pipeline (worker/main process) reports warnings as
 * Portuguese text. They are translated in the renderer by pattern so the
 * pipeline stays language-agnostic and existing reports keep working.
 * Captured groups become `{{a}}`, `{{b}}`… in the translation.
 */
const PATTERNS: Array<[RegExp, TranslationKey]> = [
  [/^(\d+) caractere\(s\) foram substituídos por falta de suporte da fonte PDF\.$/, "conversion:pipeline.unsupportedCharacters"],
  [/^(\d+) pagina\(s\) da page-list apontam para documentos fora do spine e foram ignoradas\.$/, "conversion:pipeline.pageListOutsideSpine"],
  [/^Anchor (?:de destino )?ausente em (.+?): (.+)$/, "conversion:pipeline.missingAnchor"],
  [/^Capitulo "(.+)" reduzido a texto: (.+)$/, "conversion:pipeline.chapterReducedToText"],
  [/^Capitulo fora do spine preservado como conteudo extra: (.+)$/, "conversion:pipeline.chapterOutsideSpine"],
  [/^Cap[ií]tulo n[aã]o encontrado: (.+)$/, "conversion:pipeline.chapterNotFound"],
  [/^Capitulo sem conteudo exportavel: (.+)$/, "conversion:pipeline.chapterEmpty"],
  [/^Capítulo sem texto legível: (.+)$/, "conversion:pipeline.chapterUnreadable"],
  [/^CSS nao encontrado para grafo de recursos: (.+)$/, "conversion:pipeline.cssNotFound"],
  [/^Declaracao CSS removida porque um recurso url\(\) nao foi empacotado\.$/, "conversion:pipeline.cssUrlRemoved"],
  [/^Documento HTML nao encontrado para grafo de recursos: (.+)$/, "conversion:pipeline.htmlNotFound"],
  [/^EPUB sem itens no spine\.$/, "conversion:pipeline.emptySpine"],
  [/^Erro ao inserir imagem (.+?): (.+)$/, "conversion:pipeline.imageInsertFailed"],
  [/^Fallback ausente para (.+?): (.+)$/, "conversion:pipeline.missingFallback"],
  [/^Formato de imagem não suportado: (.+)$/, "conversion:pipeline.unsupportedImage"],
  [/^Imagem (.+?) nao pode ser preparada para Kindle \((.+)\); sera omitida se o formato nao for suportado\.$/, "conversion:pipeline.kindleImageFailed"],
  [/^Imagem (.+?) mantida sem otimizacao \((.+)\)\.$/, "conversion:pipeline.imageNotOptimized"],
  [/^Imagem não encontrada: (.+)$/, "conversion:pipeline.imageNotFound"],
  [/^Import CSS invalido removido \((.+?)\): (.+)$/, "conversion:pipeline.cssImportInvalid"],
  [/^Import CSS removido porque nao foi resolvido: (.+)$/, "conversion:pipeline.cssImportUnresolved"],
  [/^Indice NCX ignorado: (.+)$/, "conversion:pipeline.ncxIgnored"],
  [/^OPF sem metadata; usando metadados inferidos pelo Lyceum\.$/, "conversion:pipeline.opfWithoutMetadata"],
  [/^Propriedade CSS removida: (.+?)\.$/, "conversion:pipeline.cssPropertyRemoved"],
  [/^Recurso (.+?) ausente; usando fallback (.+?)\.$/, "conversion:pipeline.resourceFallback"],
  [/^Recurso HTML fora da pasta do documento foi bloqueado: (.+)$/, "conversion:pipeline.htmlResourceBlocked"],
  [/^Recurso HTML nao encontrado: (.+)$/, "conversion:pipeline.htmlResourceNotFound"],
  [/^Recurso ignorado no EPUB \((.+?)\): (.+)$/, "conversion:pipeline.resourceIgnored"],
  [/^Recurso nao encontrado: (.+)$/, "conversion:pipeline.resourceNotFound"],
  [/^Recurso referenciado nao esta no manifesto: (.+)$/, "conversion:pipeline.resourceNotInManifest"],
  [/^Regra CSS @(.+?) removida por incompatibilidade Kindle\.$/, "conversion:pipeline.cssRuleRemoved"],
  [/^Spine ausente ou vazio; usando documentos HTML do manifesto\.$/, "conversion:pipeline.spineFallback"],
  [/^Spine referencia item ausente no manifesto: (.+)$/, "conversion:pipeline.spineMissingItem"],
  [/^Thumbnail Kindle da capa (.+?) nao pode ser gerado \((.+)\)\.$/, "conversion:pipeline.kindleThumbnailFailed"],
  [/^Referencia quebrada em (.+?): (.+)$/, "conversion:pipeline.brokenReference"],
  [/^Referencia CSS quebrada em (.+?): (.+)$/, "conversion:pipeline.brokenCssReference"],
  [/^Ligaduras sem Unicode reconstruidas: (.+?)\.$/, "conversion:pipeline.ligaturesRepaired"],
  [/^Primeiro registro de recurso aponta para zero; .+$/, "conversion:pipeline.azw3FirstResourceZero"],
  [/^Nome completo do livro ausente ou fora do registro zero\.$/, "conversion:pipeline.azw3MissingFullName"],
  [/^Registro DATP ausente; .+$/, "conversion:pipeline.azw3MissingDatp"],
  [/^Fluxo KF8 sem TBS nos registros de texto; .+$/, "conversion:pipeline.azw3MissingTbs"],
  [/^(\d+) link\(s\) interno\(s\) XHTML permaneceram sem conversao para kindle:pos:fid\.$/, "conversion:pipeline.azw3UnconvertedLinks"],
];

const GENERIC_ERRORS: Record<string, TranslationKey> = {
  "erro desconhecido": "conversion:pipeline.unknownError",
};

function translateOne(message: string): string {
  for (const [pattern, key] of PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;
    const values: Record<string, string> = {};
    match.slice(1).forEach((value, index) => {
      const translated = GENERIC_ERRORS[value] ? translate(GENERIC_ERRORS[value]) : value;
      values[String.fromCharCode(97 + index)] = translated;
    });
    return translate(key, values);
  }
  return message;
}

/**
 * Translates a pipeline message. Messages prefixed with a book title
 * (`Title: warning`) keep the prefix.
 */
export function translateConversionMessage(message: string): string {
  if (!message) return message;
  const kindleStage = translateKindleStageMessage(message);
  if (kindleStage) return kindleStage;
  const direct = translateOne(message);
  if (direct !== message) return direct;
  const separator = message.indexOf(": ");
  if (separator > 0) {
    const rest = message.slice(separator + 2);
    const translated = translateOne(rest);
    if (translated !== rest) return `${message.slice(0, separator)}: ${translated}`;
  }
  return message;
}
