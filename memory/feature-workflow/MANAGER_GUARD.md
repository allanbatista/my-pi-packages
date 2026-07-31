# Manager Guard

## Responsabilidade

Impedir que modelos simples contornem as fronteiras do workflow por tool call.

## Entidades

Ativação por `/skill:batista-loop|batista-manifest|batista-execute`, allowlist de paths, preflight de agents, contrato de dispatch e validação pendente.

## Relações

Complementa as instruções de `batista-loop` e `batista-execute` com enforcement no evento `tool_call`; não roda dentro dos children porque eles não recebem o slash command manager.

## Fluxo

Ativar no input manager → permitir `write`/`edit` somente em `loop.md`/`manifest.md`/`plan.md` sob `.features` → bloquear bash obviamente mutável; após terceira leitura idêntica, pausar toda descoberta até escrita de índice ou subagent → converter tentativas iniciais em `list`/`get` e normalizar modelo, `context: fresh` e cwd raiz → manter worker pendente até aprovação positiva do `workflow-validator` → impedir promoção ou `artifact-guardian` prematuros → desativar em `agent_settled`.

## Fontes no código

- `extensions/workflow-manager-guard.ts`
- `test/workflow-manager-guard.test.js`
