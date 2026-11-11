# Regras de colaboração — HeatCity

## Branches e entrega

- A base de integração é `develop`. Use branches curtas `feature/*`, `fix/*` ou
  `chore/*` criadas a partir da `develop` atualizada, com uma tarefa por branch.
- Direcione PRs para `develop`. Confira os checks antes de integrar, preserve o
  histórico e não use force push em branches compartilhadas.
- `main` está congelada para a entrega em aula com apresentação. Não faça commits,
  push, merges ou PRs de promoção para `main` até o usuário sinalizar explicitamente
  que o projeto terminou por completo e autorizar a promoção final. Aprovação de
  uma etapa, commit, push ou apresentação parcial não é essa autorização.
- Não crie releases/tags finais nem publique/deploy automaticamente. Somente após
  autorização final, revise a entrega e remova o bloqueio de promoção do CI em uma
  alteração explícita antes de abrir PR `develop` → `main`.
- Commits e pushes de progresso estão autorizados. Não adicione assinaturas
  automáticas ChatGPT/Codex ou trailers de coautoria de ferramentas.
- Preserve a estrutura da aplicação. Este fluxo não exige GitButler, Jujutsu,
  agentes paralelos ou ferramentas de orquestração.

Consulte [o fluxo de desenvolvimento](docs/fluxo-desenvolvimento.md).
