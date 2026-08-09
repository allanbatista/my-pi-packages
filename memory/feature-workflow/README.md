# Feature Workflow

## Responsabilidade

Mapear o harness de autoria, execução, validação e retomada oferecido pelo pi package.

## Componentes

- [batista-LOOP.md](./batista-LOOP.md): controlador ponta a ponta.
- [batista-MANIFEST.md](./batista-MANIFEST.md): manager de autoria.
- [batista-SPEC.md](./batista-SPEC.md): contrato e clarificações.
- [batista-UX.md](./batista-UX.md): solução de usabilidade.
- [batista-ARCH.md](./batista-ARCH.md): solução técnica.
- [batista-PLAN.md](./batista-PLAN.md): DAG executável e harness.
- [batista-VALIDATION.md](./batista-VALIDATION.md): plano e progresso de validação (validation.md).
- [batista-EXECUTE.md](./batista-EXECUTE.md): coordenação de implementação.
- [batista-INCIDENT.md](./batista-INCIDENT.md): orquestração de incidente em produção.
- [SUBAGENTS.md](./SUBAGENTS.md): papéis e fronteiras do runtime.
- [MANAGER_GUARD.md](./MANAGER_GUARD.md): contenção nativa de tool calls dos managers.

## Relações

```mermaid
flowchart LR
  User --> Loop
  User --> Incident
  Incident --> Loop
  Loop --> Manifest
  Manifest --> Spec
  Manifest --> UX
  Manifest --> Arch
  Manifest --> Plan
  Manifest --> Validation
  Validation --> Guardian
  Loop --> Execute
  Loop --> ManagerGuard
  ManagerGuard --> Worker
  ManagerGuard --> Validator
  Execute --> Worker
  Execute --> Validator
  Incident --> Plan
  Incident --> Validation
  Incident --> Execute
  Spec & UX & Arch & Plan & Validation --> Guardian
```

## Fontes no código

- `skills/`
- `agents/`
- `extensions/workflow-manager-guard.ts`
- `references/WORKFLOW_COMMON.md`
- `package.json`
