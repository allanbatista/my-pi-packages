# Execute

## Responsabilidade

Coordenar workers e validators sem implementar ou aprovar o próprio trabalho.

## Entidades

Baseline, write set, task status, worker evidence, validator verdict e phase gate.

## Relações

Usa `worker` para escrita e `workflow-validator` para aceite independente.

## Fluxo

Reconciliar → checkpoint → um worker síncrono produz mudança/evidência por task/tentativa → manager confere write set mesmo com `(no output)` → um validator read-only inspeciona a evidência → corrigir ou fechar atomicamente headers, tasks/fases, `State.Plan` e resume points → reler plan e manifest. Ausência de envelope, `status` por nome do agent e dispatch duplicado não são retry válido; validator só promove com aprovação positiva explícita, nunca por mera ausência de rejeição.

O manager escreve somente `loop.md`, `manifest.md` e `plan.md`; produto incorreto, ausente ou em path errado sempre exige worker de correção.

## Fontes no código

- `skills/execute/SKILL.md`
- `agents/workflow-validator.md`
- `references/MODEL_POLICY.md`
