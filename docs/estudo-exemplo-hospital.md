# Estudo de exemplo: orientação na entrada de um hospital

Título: **Orientação na entrada de um hospital**.
Objetivo: investigar a localização da placa Recepção em dois posicionamentos.
Tarefa: **Localize a placa Recepção.**

## Preparação disponível

1. Execute Iniciar-HeatCity.cmd e, na página de estudos, clique **Exemplo hospitalar A/B**.
2. Escolha os arquivos das imagens A e B, com a mesma resolução. São aceitos PNG,
   JPEG ou WebP, até 4 MB por imagem e 8 megapixels.
3. Confira as quatro AOIs: Recepção, Pronto Socorro, Ambulatório e Triagem. As
   caixas iniciais são aproximações das imagens mostradas no chat, normalizadas
   ao quadro completo. Não são detecções automáticas.
4. Para ajustar uma caixa, escolha a placa e desenhe novamente sobre a imagem.
   As imagens permanecem intactas; só as coordenadas são alteradas.
5. Confirme a revisão e clique **Criar estudo com os dois cenários**. A API cria
   estudo e cenários numa única transação. Uma imagem inválida não deixa um estudo
   incompleto. Nenhuma sessão ou participante é pré-preenchido.
6. Use PDI visual para explorar as imagens. Para testes oculares, use Nova sessão
   (aprovação obrigatória) ou Ensaio exploratório (não validado e separado).

## Limite do par fornecido

As imagens foram informadas pelo usuário como geradas por IA. A versão A mostra
Recepção à esquerda e a B à direita. Também mudam a distribuição das outras
placas, uma seta e detalhes das pessoas. Os títulos A/B fazem parte dos estímulos.
Logo, esse par serve como exemplo ilustrativo de comparação entre cenas, sem
isolar causalmente o efeito do posicionamento. Não é coleta em hospital real.
Nenhum resultado humano, melhora de orientação ou superioridade A/B foi medido.

## Base compartilhada para qualquer checkout

O importador, as AOIs iniciais e o teste automatizado estão versionados. O teste
`frontend/scripts/hospital-smoke.mjs` cria imagens sintéticas de software em
memória e exercita o fluxo, sem depender das imagens do chat ou de webcam.
Com API e frontend ativos e Playwright configurado conforme README:

```sh
node frontend/scripts/hospital-smoke.mjs
```

A CI também executa esse teste. Ele verifica importação, ajuste de AOI, criação
completa, PDI e ausência de sessões fictícias; não verifica precisão humana.

**Pendente para distribuir a base visual exata:** anexar os dois arquivos originais
PNG/JPG/WebP ou enviar o JSON completo exportado do estudo criado pelo importador.
As imagens exibidas inline no chat não estavam disponíveis como arquivos locais
nesta etapa. Após recebê-las, poderão ser versionadas com AOIs e carregamento rápido,
sem armazenar resultados ou dados pessoais. Não compartilhar o banco SQLite local
como fixture, pois ele pode conter sessões reais.
