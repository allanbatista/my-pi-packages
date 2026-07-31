# Pi Runtime Adaptation

## Fronteira correta

- `/skill:<name>` é entry point de **input do usuário**. Texto emitido pelo assistant não invoca outra skill.
- `/subagents` é a interface humana de administração do `pi-subagents`.
- Managers executam delegações pela ferramenta `subagent(...)`; nunca escrevem slash commands esperando que o Pi os execute.

## Managers na sessão raiz

`batista-loop`, `batista-manifest` e `batista-execute` permanecem na sessão raiz, que possui a ferramenta `subagent`:

- `batista-loop` carrega `../skills/batista-manifest/SKILL.md` e `../skills/batista-execute/SKILL.md`, resolvidos a partir deste arquivo, com `read` e aplica essas rotinas inline, no mesmo turno.
- `batista-manifest` delega `batista-spec`, `batista-ux`, `batista-arch` e `batista-plan` a subagents folha.
- `batista-execute` delega implementação e validação a subagents separados.
- Uma rotina manager carregada por outra rotina não emite sua `Final Response`; devolve o controle ao manager chamador.

Não delegue um manager a um child comum: children comuns não recebem a ferramenta `subagent` e não conseguem orquestrar o próximo nível.

## Delegação por `pi-subagents`

1. Faça preflight com `action: "list"` e depois `action: "get"` para cada papel, conforme `./WORKFLOW_COMMON.md`; bloqueie source/tools divergentes.
2. Use `context: "fresh"`, `cwd` canônico do projeto e contexto mínimo explícito.
3. Para autoria, use `delegate` com `model: "inherit"` e mande ler o path absoluto da skill deste package; não use seleção por nome, que pode sofrer shadowing no projeto alvo.
4. Para guardians de artefato/outcome, use `artifact-guardian`.
5. Para execução, use `worker`; para aceite independente, use `workflow-validator`.
6. Aguarde o resultado necessário antes de avançar; não ceda o turno entre etapas dependentes.
7. Releia os artefatos após cada retorno. Arquivo vence relato do child.

## Runtime ausente

Se a ferramenta `subagent` ou algum papel obrigatório estiver indisponível, grave `Status: blocked` e instrua `pi install npm:pi-subagents` seguido de reinício do Pi. Não simule guardian, worker ou validador inline e não marque `ready`/`done`.
