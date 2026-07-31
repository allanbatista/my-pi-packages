# Manifest

## Responsabilidade

Orquestrar a autoria e manter `manifest.md` como índice fiel dos artefatos.

## Entidades

Estados de spec, UX, Arch, plan, guardians, blockers e resume point.

## Relações

Delega skills folha ao agent `delegate` e rubricas ao `artifact-guardian`.

## Fluxo

Reconciliar → invalidar approvals downstream quando o upstream mudou → despachar primeiro artefato incompleto → guardian avalia gates internos ignorando apenas seu gate autorreferente → autor persiste verdict → `ready` ou `blocked`.

## Fontes no código

- `skills/batista-manifest/SKILL.md`
- `references/WORKFLOW_COMMON.md`
