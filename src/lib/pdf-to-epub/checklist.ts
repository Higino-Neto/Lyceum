import type { ChecklistItem } from "./types";

export const PDF_TO_EPUB_CHECKLIST: ChecklistItem[] = [
  {
    id: "pdfjs-parsing",
    label: "Extrair tokens com texto, fonte, tamanho, pagina e geometria via pdfjs-dist",
    status: "done",
  },
  {
    id: "line-reconstruction",
    label: "Agrupar tokens em linhas por baseline e ordenar horizontalmente",
    status: "done",
  },
  {
    id: "font-size-clustering",
    label: "Analisar distribuicao de fontes por histogram e clustering dinamico (body, h1-h3, tiny)",
    status: "done",
    detail: "Histogram com bins de 0.5pt, smoothing e deteccao de picos. Thresholds adaptativos por documento.",
  },
  {
    id: "font-style-detection",
    label: "Detecao visual de bold/italic por char-width ratio, skew factor e nome de fonte",
    status: "done",
    detail: "3 camadas: nome da fonte, comparacao intra-familia, e skew do transform matrix.",
  },
  {
    id: "document-stats",
    label: "Calcular estatisticas globais de corpo, margens e espacamento com analise de fonte",
    status: "done",
  },
  {
    id: "noise-removal",
    label: "Remover cabecalhos, rodapes, numeracao e linhas repetidas",
    status: "done",
  },
  {
    id: "column-detection",
    label: "Detectar uma ou multiplas colunas por pagina",
    status: "done",
  },
  {
    id: "reading-order",
    label: "Reconstruir ordem de leitura por regioes e colunas",
    status: "done",
  },
  {
    id: "toc-detection",
    label: "Detectar entradas de sumario por padrao (dots, page number, numeracao)",
    status: "done",
    detail: "Quebra forcada entre entradas TOC, classificacao como tocEntry com clean text.",
  },
  {
    id: "paragraph-reconstruction",
    label: "Unir linhas em paragrafos por gap, indentacao e continuidade",
    status: "done",
  },
  {
    id: "hyphenation",
    label: "Corrigir hifenizacao de fim de linha e normalizar espacos/ligaturas",
    status: "done",
  },
  {
    id: "semantic-detection",
    label: "Classificar titulos, capitulos, subtitulos, citacoes, listas, TOC e notas",
    status: "done",
  },
  {
    id: "semantic-html",
    label: "Gerar XHTML semantico reflowable com estilos de TOC",
    status: "done",
  },
  {
    id: "epub-packaging",
    label: "Gerar EPUB 3 com mimetype, container, OPF, TOC, spine e CSS",
    status: "done",
  },
  {
    id: "images",
    label: "Extrair imagens e figuras do PDF",
    status: "pending",
    detail: "O pipeline possui tipo de bloco e renderizacao; falta extracao por operator list ou recorte renderizado.",
  },
  {
    id: "tables",
    label: "Detectar tabelas e decidir entre HTML table ou imagem fallback",
    status: "partial",
    detail: "O tipo semantico existe; a heuristica especifica ainda deve ser adicionada.",
  },
  {
    id: "formulas",
    label: "Detectar formulas e renderizar fallback como imagem",
    status: "partial",
    detail: "O tipo semantico existe; a deteccao matematica ainda deve ser adicionada.",
  },
  {
    id: "ocr",
    label: "Detectar PDF escaneado e acionar OCR fallback",
    status: "partial",
    detail: "O pipeline marca paginas candidatas a OCR; a integracao com Tesseract/cloud OCR deve ser plugada.",
  },
  {
    id: "epubcheck",
    label: "Validar EPUB com epubcheck em ambiente de release",
    status: "pending",
  },
];
