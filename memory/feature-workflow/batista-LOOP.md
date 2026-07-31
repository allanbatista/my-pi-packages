# Loop

## Responsabilidade

Conduzir um objetivo até `converged`, `blocked` ou `ceiling`, retomando o mesmo épico.

## Entidades

`loop.md`, sub-feature, convergence ledger, resume point, validação local e outcome guardian raiz.

## Relações

Carrega `batista-manifest` e `batista-execute` inline na sessão raiz; `workflow-validator` fecha apenas a sub-feature e `artifact-guardian` valida somente o outcome do épico completo.

## Fluxo

Reconciliar arquivos → pular linhas terminais → autoria/execução das sub-features liberadas → headers, `State.Plan`, tasks/fases, resumes e linha manager em `done` → gate `done/done/pass/done` → integração raiz executada sem child e persistida → checkpoint read-only dos documentos e evidências posterior à última mutação → outcome raiz → iterar ou parar. Aprovação local nunca promove o épico. `Iterations used` conta apenas correções abertas por falha raiz, inclusive toda rejeição do outcome; sucesso no passe inicial preserva `0` e ledger `none`. Replan, reexecução ou merge rebaixa o outcome para `pending`; a DAG persiste batch, dependências e write sets.

Falha raiz avalia ceiling/anti-thrash antes de incrementar ou reabrir. Havendo orçamento, persiste e relê integralmente a reabertura da menor sub-feature: plan/manifest headers e `State.Plan` voltam a `ready`, task/fase/evidence voltam a `pending`, linha manager vira `ready/fail/pending/running`; guardian/readiness do plano existente permanece aprovado e `execute=fail` é retomável. Sequência obrigatória: preflight → worker → workflow-validator → fechamento terminal → E2E → checkpoint → um guardian raiz. Só o worker corrige produto. Mudança de requisito/contrato/plano volta ao manifest e invalida approvals downstream.

## Fontes no código

- `skills/batista-loop/SKILL.md`
- `references/PI_ADAPTATION.md`
