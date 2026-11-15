# Números de página reais no Kindle

O Lyceum gera "Página X de Y" no Kindle com um arquivo **APNX** (Amazon Page Number Index), um índice binário que fica em `documents/.../<livro>.sdr/<livro>.apnx`, ao lado do livro enviado por USB.

## Como funciona

1. **Mapa de páginas** (`LyceumTextualContent.pageMap`, salvo em `content/textual/pages.json`). Cada página é uma âncora `<span id epub:type="pagebreak">` dentro do capítulo. A origem é escolhida nesta ordem:
   - `publisher`: o EPUB de origem já tem `nav epub:type="page-list"` ou NCX `pageList`.
   - `pdf`: a origem é um PDF. O `pdf-to-epub` grava uma âncora por página do PDF, na linha onde a página começa.
   - `target-count`: há uma contagem de páginas impressas, distribuída proporcionalmente pelo texto visível.
   - `estimate`: nada acima existe. Usa cerca de 1.800 caracteres visíveis por página.
2. **AZW3** (`mobi/azw3Writer.ts`): grava o byte offset de cada âncora no fluxo de texto KF8 descomprimido (`pageOffsets`).
3. **APNX** (`kindle/apnxWriter.ts`): o exportador grava `<livro>.apnx` ao lado do `.azw3`. Os campos ASIN e `acr` precisam bater com o EXTH 113 e com o nome do PDB do livro.
4. **Envio USB** (`electron/main.ts`): copia o APNX para `<livro>.sdr/`, usando o nome final do livro no aparelho.
5. AZW3/MOBI já prontos, que são copiados sem conversão, recebem um APNX estimado gerado no worker (`build-apnx`, `kindle/mobiPages.ts`).

## Limites conhecidos

- **E-mail (Send to Kindle):** quem converte é a Amazon, e um APNX não pode ser enviado por e-mail. O EPUB gerado do PDF já leva o `nav page-list`, mas não há garantia de que a Amazon o use. Isso é experimental.
- Os rótulos romanos usam o código de grupo `r` no `pageMap` do APNX. Isso ainda não foi confirmado num aparelho.

## Checklist de teste no aparelho

- [ ] PDF de N páginas → AZW3 por USB com "Páginas reais". Em Aa → Progresso de leitura → "Página no livro", o total deve ser N.
- [ ] "Ir para → página 37" abre o trecho da página 37 do PDF original.
- [ ] EPUB com page-list da editora → as páginas batem com a edição impressa.
- [ ] EPUB sem page-list → as páginas aparecem estimadas.
- [ ] AZW3 externo enviado sem conversão → as páginas aparecem estimadas.
- [ ] "Desligado" → nenhuma pasta `.sdr` é criada.
- [ ] Enviar o mesmo livro de novo ("Livro (2).azw3") → o APNX vai para `Livro (2).sdr/Livro (2).apnx`.
- [ ] E-mail: EPUB gerado de PDF → anotar aqui se o Kindle mostra as páginas.
