# Checklist PDF para EPUB

## Implementado agora

- [x] Extrair tokens com `pdfjs-dist`: texto, coordenadas, fonte, tamanho, pagina e transform original.
- [x] Normalizar ligaturas comuns e reconstruir texto de linha por gaps geometricos.
- [x] Agrupar tokens em linhas por baseline com tolerancia proporcional ao tamanho da fonte.
- [x] Calcular `bbox`, `baseline`, `left`, `right`, `center` e tamanho medio por linha.
- [x] Analise dinamica de fontes por histogram: bins de 0.5pt, smoothing, deteccao de picos.
- [x] Identificar body font size pelo mode (pico mais frequente), nao pela mediana.
- [x] Clusterizar tamanhos: tiny (notas), body, heading3, heading2, heading1 com thresholds adaptativos.
- [x] Detecao visual de bold: char-width ratio intra-familia + nome de fonte.
- [x] Detecao visual de italic: skew factor do transform matrix + nome de fonte.
- [x] Calcular estatisticas globais: fonte de corpo, margens uteis, altura/largura de pagina e gap mediano.
- [x] Detectar ruido em topo/rodape por posicao, repeticao, tamanho, texto curto e padrao de pagina.
- [x] Remover cabecalhos, rodapes e numeracao com score deterministico/probabilistico.
- [x] Detectar paginas de uma ou duas colunas por clusters de centro horizontal.
- [x] Reconstruir ordem de leitura por colunas, preservando linhas full-width.
- [x] Detectar entradas de sumario/TOC por padrao (leader dots, page number, numeracao hierarquica).
- [x] Quebrar entradas TOC em paragrafos separados automaticamente.
- [x] Classificar blocos TOC com renderizacao XHTML dedicada (`p.toc-entry`).
- [x] Reconstruir paragrafos com gap vertical, indentacao, troca de fonte e pontuacao.
- [x] Corrigir hifenizacao de fim de linha quando a linha anterior enche a coluna.
- [x] Classificar blocos como capitulo, titulo, subtitulo, paragrafo, citacao, lista, TOC e nota.
- [x] Agrupar itens consecutivos em `ol`/`ul`.
- [x] Gerar XHTML semantico reflowable.
- [x] Empacotar EPUB 3 com `mimetype`, `container.xml`, `content.opf`, `toc.xhtml`, spine, capitulos e CSS.
- [x] Gerar relatorio com checklist, contagens, avisos e confianca media.
- [x] Cobrir heuristicas centrais com testes unitarios (16 testes).

## Parcial

- [ ] OCR fallback: o pipeline marca paginas com pouco texto, mas ainda precisa de adaptador Tesseract/cloud OCR.
- [ ] Tabelas: existem tipos e fallback semantico; falta detector dedicado por grid/gaps.
- [ ] Formulas: existem tipos e fallback semantico; falta detector por simbolos/superscript/subscript.
- [ ] Imagens: falta extracao por `operatorList` ou recorte de pagina renderizada.
- [ ] TOC externo do PDF: falta ler outline/bookmarks do PDF e combinar com titulos detectados.

## Proximos incrementos recomendados

1. Integrar o conversor ao fluxo de importacao de livros do Lyceum.
2. Adicionar adaptador OCR com tokens `confidence` e bboxes no mesmo formato interno.
3. Adicionar extracao de imagens/figuras e captions.
4. Adicionar detector de tabelas com fallback para imagem (sugerido: TATR da Microsoft).
5. Rodar `epubcheck` no pipeline de release.
6. Criar corpus golden com livro simples, duas colunas, paper academico, notas e PDF escaneado.
7. Considerar GROBID para extracao de metadados (autores, DOI, abstract) em papers academicos.
8. Considerar Nougat (Meta AI) para OCR neural de documentos academicos com formulas LaTeX.
