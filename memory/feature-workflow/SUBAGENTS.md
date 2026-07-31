# Subagents

## Responsabilidade

Definir a fronteira entre comandos humanos, managers raiz e children isolados.

## Entidades

Ferramenta `subagent`, agent `delegate`, `artifact-guardian`, `worker` e `workflow-validator`.

## Relações

`/subagents` administra a extensão; `/skill:*` inicia o workflow; somente `subagent(...)` executa children.

## Fluxo

Preflight `action:list` + `action:get` (source/tools efetivos) → paths canônicos → chamada com `context: fresh`/`cwd` → Delegation Result → releitura do artefato. Referências entre skills resolvem a partir do `SKILL.md` do package, nunca do epic dir/cwd; falha de resolução bloqueia em vez de simular a rotina. Execução exige `cwd` igual ao project root e modelo explícito em cada dispatch: worker `deepseek/deepseek-v4-flash:off` e validator `deepseek/deepseek-v4-flash:xhigh`; feature dir, `context` ausente, `inherit` ou valor efetivo divergente não promove estado nem autoriza correção direta pelo manager. Guardians também usam project root como `cwd`, `context: fresh`, `model: inherit` explícito e allowlist exata `read, grep, find, ls`; nenhum campo pode ser omitido e `cwd` não substitui sandbox para modelos não confiáveis.

## Fontes no código

- `agents/artifact-guardian.md`
- `agents/workflow-validator.md`
- `references/PI_ADAPTATION.md`
- `references/WORKFLOW_COMMON.md`
- `package.json`
