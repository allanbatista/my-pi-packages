# Validation

## Responsabilidade

Formular e rastrear o plano e o progresso de validação de uma feature no artefato `validation.md` (`.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`) — o que validar/testar, evidências e progresso — antes de qualquer validação ser executada. Quando executada de forma independente (standalone), monta o checklist de validações (o que será validado, o que precisa ser feito e o que precisa ser confirmado para passar, com API e E2E/front), delega a execução prática ao subagent `worker`, delega a checagem independente de sucesso ao subagent `workflow-validator` e executa o loop de correção e reteste até aprovação total.

## Entidades

`Validation Plan` (itens `V#` vinculados a requisitos da spec/plan — contendo o que será validado, o que precisa ser feito e o que precisa ser confirmado para passar), `Validation Progress` (um registro por item `V#`, evoluindo `pending → running → pass/fail`) e `Fix & Re-validation Log` (registro de correções e retestes).

## Relações

Consome Spec e Plan aprovados (ou escopo standalone); alimenta o Guardian e o `workflow-validator` (conferência independente item a item); delega execução ao `worker`; orienta o Execute/Loop (gate de convergência/merge exige itens todos `pass`).

## Fluxo

- **Orquestrado (child delegate):** spec + plan ready/approved → formular `Validation Plan` (itens `V#`) → escrever `Validation Progress` (todos `pending`) → retornar `DELEGATION_RESULT` ao manager.
- **Independente (standalone):** formular checklist/`Validation Plan` estruturado (o que validar, o que fazer, o que confirmar para passar — cobrindo API e E2E/front) → aprovar plano com `artifact-guardian` → delegar execução ao subagent `worker` (coleta de evidência observável) → delegar checagem independente ao subagent `workflow-validator` (conferência `pass`/`fail`) → havendo falha, delegar correção ao `worker` e retestar até aprovação → consolidar resultado.

## Fontes no código

- `skills/batista-validation/SKILL.md`
- `references/WORKFLOW_COMMON.md`
- `references/PI_ADAPTATION.md`
- `references/MODEL_POLICY.md`
- Artefato `validation.md` da feature (`.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`)
