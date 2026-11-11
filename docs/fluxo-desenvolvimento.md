# Fluxo de desenvolvimento e entrega

Adotamos integração contínua na `develop`, com branches curtas e promoção final
controlada pelo usuário. É uma adaptação com trunk de integração separado da
branch de entrega, sem ciclos de `release/*` do Git Flow e sem mudar pastas,
launcher ou código da aplicação. `ai-develop` seria redundante: a `develop` existente
já cumpre esse papel.

## Ciclo de uma tarefa

1. Atualizar `develop` com `git pull --ff-only origin develop`.
2. Criar `feature/nome`, `fix/nome` ou `chore/nome` a partir dela.
3. Implementar, executar os checks pertinentes e salvar commits pequenos.
4. Fazer push e abrir PR com **base develop**, descrevendo comportamento e validação.
5. Integrar após os checks passarem. Se houver conflito, resolvê-lo e repetir os
   checks afetados. Não reescrever o histórico compartilhado.
6. Começar a próxima tarefa a partir da `develop` atualizada. As branches antigas
   permanecem preservadas; não é necessário apagar ou reescrever entregas anteriores.

Não é necessário usar merge queue com um único fluxo de trabalho. Se futuramente
houver contribuições simultâneas, essa configuração pode ser avaliada separadamente.

## Reserva da main

A `main` preserva seu estado até o usuário declarar o projeto completo para a
entrega em aula e autorizar sua promoção. O CI rejeita PRs com base `main` enquanto
essa regra estiver vigente; testes continuam rodando normalmente nas tarefas.
Executar a apresentação exploratória ou concluir uma etapa não libera a `main`.

O CI é uma verificação, não uma proteção contra push direto: para bloquear merges
ou pushes no servidor, um administrador precisa configurar regras do GitHub.
A API do GitHub não ficou acessível neste ambiente; nenhuma proteção remota ou
mudança de branch padrão foi aplicada. Ao criar PRs, selecione `develop` explicitamente.

Quando houver autorização final, revisar código, testes, documentação, evidências
reais, slides e roteiro; liberar o gate em alteração explícita e abrir um PR de
`develop` para `main`. Não há promoção, tag, release ou deploy automáticos.
