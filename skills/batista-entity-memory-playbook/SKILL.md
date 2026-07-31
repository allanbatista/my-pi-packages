---
name: batista-entity-memory-playbook
description: Playbook para criar e atualizar memória técnica de entidades, componentes, arquivos de contrato e seus relacionamentos em `memory/<dominio>/`. Use como `/skill:batista-entity-memory-playbook` quando o agente criar, alterar, remover ou documentar entidade/model/API/UI/consumer/job/skill/arquivo de domínio, ou quando uma mudança afetar relacionamento entre componentes e precisar atualizar a pasta `memory/` do domínio.
---

# Entity Memory Playbook

## Objetivo

Manter uma memória técnica curta, navegável e rastreável ao código atual. A memória deve ajudar o próximo agente a entender entidades, componentes e relacionamentos sem repetir uma investigação inteira.

## Workflow

1. **Localize a memória do repo.**
   - Use `memory/<dominio>/` quando existir ou quando o repo já usa `memory/`.
   - Use `.memory/` apenas para regras persistentes globais do repo, não para mapas de componentes.
   - Se não houver pasta clara, crie `memory/<dominio>/` com nome curto em kebab-case.

2. **Mapeie a fonte de verdade antes de escrever.**
   - Leia modelos/tipos/schemas, services, controllers/routes, jobs/consumers, UI e docs existentes.
   - Trate código atual como fonte primária; memória antiga e docs ajudam, mas não vencem o código.
   - Não transforme grep em documentação: agrupe por responsabilidade de domínio.

3. **Defina componentes por responsabilidade.**
   - Crie um arquivo por componente de domínio: exemplo `MONITOR.md`, `ALERT.md`, `INCIDENT.md`.
   - Use `README.md` como índice, resumo do domínio e diagrama de relações.
   - Evite arquivo por botão, card ou helper pequeno; agrupe detalhes visuais em `API_AND_UI.md` quando fizer sentido.

4. **Use estrutura fixa em cada arquivo.**
   - `# Nome`
   - `## Responsabilidade`
   - `## Entidades`
   - `## Relações`
   - `## Fluxo`
   - `## Fontes no código`

5. **Atualize relacionamentos junto com a mudança.**
   - Ao criar/alterar/remover entidade, arquivo de contrato, rota, service, job, tabela/collection, componente UI de domínio ou fila, atualize o arquivo de memória correspondente.
   - Se a mudança conectar dois componentes, atualize ambos ou o arquivo transversal (`DATA_MODEL.md`, `API_AND_UI.md`, `QUEUES_AND_CONSUMERS.md`).
   - Se adicionar componente novo, adicione arquivo novo e link no `README.md`.

6. **Mantenha curto e verificável.**
   - Escreva em pt-BR; preserve nomes de código em en-US.
   - Cite paths reais em `Fontes no código`.
   - Remova placeholders, typos de template e texto especulativo.
   - Prefira Mermaid simples para relações centrais.

## Validação mínima

Execute checks focados antes de finalizar:

```bash
rtk rg -n "TODO|FIXME|placeholder|path/to|single responsability|Componenets|\{uma" memory/<dominio>
rtk rg -n "[ \t]+$" memory/<dominio>
```

Quando citar muitos paths, confira que existem. Para docs-only, não rode suite de testes; `rtk git diff --check` basta se o repo permitir.

## Resultado esperado

- `memory/<dominio>/README.md` explica o domínio e lista os componentes.
- Cada componente relevante tem seu próprio `.md`.
- Relacionamentos alterados estão refletidos no README ou arquivo transversal.
- A memória aponta para o código atual e não para conclusões soltas da conversa.
