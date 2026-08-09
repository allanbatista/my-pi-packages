# Incident

## Responsabilidade

Manager de operação que orquestra o fluxo de incidente em produção na sessão raiz: descoberta (CloudWatch), investigação de causa raiz, plano enxuto de correção, implementação via workers, deploy e monitoramento pós-deploy até o gate "tudo corrigido" — com evidência prática e reproduzível.

## Entidades

`incident.md` (sintoma, erros classificados, causa raiz, correção planejada, status, monitoramento pós-deploy), erros classificados (regressão/configuração/infraestrutura/dependência), hipótese + confirmação de causa raiz, gate "tudo corrigido".

## Relações

Manager raiz que orquestra (por `read`, nunca `/skill:` entre skills): `batista-plan` (plano enxuto), `batista-validation` (`validation.md` do incidente), `batista-execute` (correção via worker + workflow-validator), `batista-ship-pr-to-deploy` (deploy após corretor), `batista-memory` (encerramento/memória) e `batista-discord-webhook-messages` (resumo opcional).

## Fluxo

Sintoma/alvo identificado no `incident.md` → descoberta/Classificação de erros via CloudWatch (subagent) → investigação de causa raiz (logs ↔ código ↔ histórico de deploys; hipótese + confirmação) → plano enxuto via `batista-plan` + `validation.md` via `batista-validation` (formulado antes de implementar) → implementação via `batista-execute` (worker corrige, workflow-validator aprova item a item) → deploy via `batista-ship-pr-to-deploy` → monitoramento pós-deploy (re-consulta CloudWatch antes/depois) → gate "tudo corrigido" (monitoramento aprovado + itens `pass`) → encerramento/memória via `batista-memory`. Gerencia ceiling/rollback/blocked conforme evidência.

## Fontes no código

- `skills/batista-incident/SKILL.md`
- `skills/batista-loop/SKILL.md`
- `skills/batista-plan/SKILL.md`
- `skills/batista-validation/SKILL.md`
- `skills/batista-execute/SKILL.md`
- `skills/batista-ship-pr-to-deploy/SKILL.md`
- `skills/batista-memory/SKILL.md`
- `skills/batista-discord-webhook-messages/SKILL.md`
- `references/WORKFLOW_COMMON.md`
- `references/PI_ADAPTATION.md`
