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
6. Começar a próxima tarefa a partir da `develop` atualizada. Branches de tarefa podem ser removidas após integração e autorização de limpeza. O histórico integrado permanece preservado.

Não é necessário usar merge queue com um único fluxo de trabalho. Se futuramente
houver contribuições simultâneas, essa configuração pode ser avaliada separadamente.

## Entrega consolidada na main

O usuário autorizou explicitamente integrar `develop` em `main` e remover as
branches auxiliares. O bloqueio temporário de promoção do CI foi retirado;
os checks de qualidade continuam ativos. `main` contém a aplicação, sem a pasta `docs/`. `develop` mantém a aplicação,
a documentação e os materiais de entrega, além de ser a base de novas tarefas.

A integração preserva o histórico. A limpeza remove apenas nomes de branches
já integradas, mantendo os commits acessíveis em `main` e `develop`.
Novas promoções para main precisam de solicitação do usuário; tags, releases e
deploys não são automáticos. Não se presume aprovação acadêmica a partir do merge.
