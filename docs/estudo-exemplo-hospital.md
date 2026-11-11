# Estudo-base: orientação na entrada de um hospital

O hospital deve aparecer como um estudo normal na lista, sem botão ou fluxo de
exemplos. Terá os dois cenários originais enviados pelo usuário, quatro AOIs por
imagem e a tarefa **Localize a placa Recepção**. Nenhuma sessão será inventada.

## Uso normal

1. Execute Iniciar-HeatCity.cmd.
2. Abra **Orientação na entrada de um hospital** na lista de estudos.
3. Consulte Cenários e placas e PDI visual, ou inicie Nova sessão.
4. Cada participante informa código e consentimento e faz a calibração.
   Ensaios exploratórios continuam fora dos indicadores oficiais.

## Arquivos originais incluídos

Os arquivos A.md e B.md enviados pelo usuário foram identificados pelo conteúdo
como JPEG de 1371 × 1536 pixels. Foram incluídos como `hospital-a.jpg` e
`hospital-b.jpg`, sem edição, recorte ou recompressão. O manifesto
`backend/heatcity/fixtures/hospital-study.json` registra SHA-256 de cada original
junto das oito AOIs. A API e o teste de navegador conferem essa identidade.
Nenhuma imagem de substituição é usada.

## Preparação da base versionada

Somente para reconstruir a fixture a partir dos originais, executar na raiz:

```sh
.venv/bin/python scripts/prepare_hospital_fixture.py "caminho/A.png" "caminho/B.png"
```

O script preserva os bytes das duas imagens, sem cortar ou recriar pixels. Empacota
as imagens e AOIs iniciais em `backend/heatcity/fixtures/hospital-study.json`.
As AOIs devem ser conferidas visualmente antes de versionar esse arquivo.
O arquivo e os JPEGs já estão versionados; um checkout atualizado tem a base pronta.

Ao iniciar a API, o arquivo versionado é carregado como estudo normal de ID
`hospital-orientacao-base-v1`. Novas inicializações não duplicam nem sobrescrevem
esse estudo, suas cenas ou sessões. A criação dos dois cenários é transacional.
Se o estudo-base for excluído, ele volta vazio de participantes na próxima
inicialização enquanto a fixture continuar incluída no projeto.

A base contém somente imagens/AOIs/protocolo. Não compartilhar o banco SQLite,
pois ele pode conter participantes e sessões reais.

## Limitações do material

As imagens foram informadas como geradas por IA. A Recepção muda da esquerda
para a direita, mas também mudam outras placas, uma seta e detalhes das pessoas.
Os títulos A/B fazem parte dos estímulos. É uma comparação ilustrativa de cenas,
sem isolamento causal do posicionamento e sem comprovação de melhora.
Não houve coleta em hospital real.

## Testes de software

A CI executa `frontend/scripts/hospital-smoke.mjs`: abre o estudo carregado na
lista normal, confere os hashes das imagens originais, as oito AOIs, o PDI e o
preparo de uma nova sessão sem participante pré-preenchido. A execução requer o
banco de testes isolado configurado pela CI; não usar em estudos pessoais com
sessões já preenchidas. Os testes Python verificam validação, transação, identidade
dos JPEGs e carga idempotente, sem medir precisão ocular humana.
