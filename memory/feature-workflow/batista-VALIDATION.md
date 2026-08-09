# Validation

## Responsabilidade

Formular e rastrear o plano e o progresso de validação de uma feature no artefato `validation.md` (`.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`) — o que validar/testar, evidências e progresso — antes de qualquer validação ser executada.

## Entidades

`Validation Plan` (itens `V#` vinculados a requisito/AC da spec — `R#` — com método/comandos concretos e evidência esperada) e `Validation Progress` (um registro por item `V#`, evoluindo `pending → pass/fail`).

## Relações

Consome Spec e Plan aprovados; alimenta o Guardian e o workflow-validator (conferência item a item); orienta o Execute (gate de convergência/merge exigem itens todos `pass`).

## Fluxo

spec + plan ready/approved → formular `Validation Plan` (itens `V#`) → escrever `Validation Progress` (todos `pending`) → guardian aprova (`ready`) → manager de execução atualiza status/evidência por item → `workflow-validator` confere item a item (`pass`/`fail`) → itens todos `pass` → `converged`.

## Fontes no código

- `skills/batista-validation/SKILL.md`
- `references/WORKFLOW_COMMON.md`
- Artefato `validation.md` da feature (`.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`)
