# Entity Memory Playbook

## Responsabilidade

Manter memória técnica curta, navegável e rastreável ao código, por domínio, para o próximo agente.

## Entidades

- `memory/<dominio>/README.md`: índice e relações do domínio.
- `memory/<dominio>/{COMPONENTE}.md`: um arquivo por componente de domínio.

## Relações

- Atualiza relacionamentos entre componentes junto com a mudança que os conecta.

## Fluxo

1. Localizar `memory/<dominio>/` → 2. mapear fonte de verdade no código → 3. definir componentes por responsabilidade → 4. estrutura fixa (`Responsabilidade`, `Entidades`, `Relações`, `Fluxo`, `Fontes no código`) → 5. atualizar junto da mudança → 6. validar com `rg` e `git diff --check`.

## Fontes no código

- `skills/batista-entity-memory-playbook/SKILL.md`
