# KFX com Kindle Previewer

## Objetivo

Adicionar uma rota opcional de conversao para KFX usando o Kindle Previewer como backend de composicao intermediaria, sem Calibre, sem `ebook-convert` e sem renomear KPF/EPUB como KFX.

## Estado atual

- [x] `kfx` registrado como formato de saida do Lyceum.
- [x] UI de conversao oferece KFX.
- [x] Pipeline Lyceum gera EPUB intermediario a partir do pacote canonical.
- [x] Kindle Previewer CLI e localizado por `LYCEUM_KINDLE_PREVIEWER`, `KINDLE_PREVIEWER` ou caminhos comuns do sistema.
- [x] Previewer e chamado com `-convert -output`.
- [x] Saidas `.kfx`, `.kpf` e `.mobi` sao detectadas no diretorio gerado.
- [x] KPF e inspecionado como container proprio e recusado quando for EPUB renomeado.
- [x] KFX so e aceito se existir uma saida/montagem KFX real.
- [x] KPF gerado pelo Previewer e materializado em KFX por ponte de montagem `kfxlib` quando disponivel.
- [x] Erro explicito quando Previewer gera MOBI ou KPF que nao pode ser montado.
- [ ] Montador TypeScript nativo KPF -> KFX sem ponte externa.
- [ ] Validador estrutural KFX completo.
- [ ] Fixtures reais por versao do Kindle Previewer.
- [ ] Validacao em Kindle fisico por modelo/firmware/data.

## Checklist de implementacao completa

### 1. Descoberta e execucao do Previewer

- [x] Detectar Kindle Previewer instalado em Windows/macOS/Linux.
- [x] Permitir override por variavel de ambiente.
- [x] Rodar conversao em workspace temporario isolado.
- [x] Capturar stdout, stderr e logs.
- [ ] Detectar versao do Previewer e registrar no relatorio.
- [ ] Normalizar mensagens conhecidas de erro por versao.
- [ ] Expor configuracao visual para caminho manual do Previewer.

### 2. EPUB intermediario

- [x] Reusar export EPUB do pacote `.lyceum`.
- [x] Preservar capa, TOC, metadados principais e recursos ja importados.
- [ ] Aplicar sanitizer especifico para Enhanced Typesetting antes do Previewer.
- [ ] Validar links internos, footnotes e landmarks antes de chamar Previewer.
- [ ] Gerar relatorio de warnings acionaveis por capitulo/recurso.

### 3. KPF

- [x] Detectar KPF gerado pelo Previewer.
- [x] Abrir KPF zip-like e listar entradas quando aplicavel.
- [x] Rejeitar EPUB renomeado.
- [x] Mapear KPF com `resources/book.kdf`/SQLite fingerprinted usado pelo Previewer moderno.
- [x] Extrair recursos, metadados, flows, indices e fragmentos Kindle modernos via `kfxlib`.
- [ ] Criar fixtures KPF pequenas e anonimizadas para regressao.

### 4. Montagem KFX

- [x] Implementar montagem KPF -> KFX por ponte Python isolada usando `kfxlib` quando `LYCEUM_KFXLIB_PATH` ou `.tmp/calibre-kfx-output` estiver disponivel.
- [x] Escrever fragments/resources na ordem esperada por Kindle moderno pela rotina de container KFX validada contra KPF real.
- [x] Gerar indices auxiliares e tabelas necessarias para sideload a partir dos fragments do KPF.
- [x] Ajustar ASIN, CDEType, idioma, titulo, autor e publisher na montagem.
- [ ] Implementar escritor de container KFX nativo sem ponte externa.
- [ ] Ajustar series e sorts quando suportado pelo metadata KFX.
- [ ] Gerar/validar capa e thumbnail Kindle.
- [x] Nunca produzir `.kfx` quando a estrutura final nao tiver assinatura KFX `CONT`.
- [ ] Tratar variacoes de KPF/KFX por versao do Previewer em fixtures automatizadas.

### 5. Validacao

- [x] Rejeitar arquivo vazio, EPUB renomeado e arquivo sem assinatura KFX `CONT`.
- [ ] Reabrir KFX e reconstruir manifesto interno.
- [ ] Verificar todas as referencias de recursos.
- [ ] Verificar TOC/anchors/indices.
- [ ] Verificar metadados Kindle essenciais.
- [ ] Comparar estrutura com amostras de referencia apenas em testes.
- [ ] Rodar teste manual em Kindle real antes de marcar concluido.

### 6. UX

- [x] Mostrar KFX como saida de conversao.
- [ ] Mostrar requisito do Kindle Previewer antes de enfileirar.
- [ ] Relatorio granular: Previewer ausente, KPF gerado, MOBI fallback, KFX validado.
- [ ] Opcao de abrir pasta de logs do Previewer.
- [ ] Integrar envio para Kindle com preferencia KFX quando disponivel.

## Regra de qualidade

KPF nao e KFX. EPUB renomeado nao e KFX. A conversao deve falhar com erro claro quando o KPF nao puder ser montado e validado como container KFX real.
