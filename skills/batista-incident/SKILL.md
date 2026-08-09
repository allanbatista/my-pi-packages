---
name: batista-incident
description: "Incident/root-cause manager in the root session that generalizes the production incident flow — está dando muitos erros em produção hoje: olhe o cloudwatch, identifique os erros, investigue, elabore a correção, corrija, faça deploy e monitore. Orchestrates discovery (CloudWatch via aws cli), investigation, lean correction plan + validation, implementation, deploy and post-deploy monitoring with an evidence-based todo-corrigido gate. Use as /skill:batista-incident when the user reports errors in production, an incident, an error spike, degradation, or asks for investigation + fix + deploy + monitoring."
---

# Incidente em Produção

Manager de operação na **sessão raiz** que generaliza o fluxo de incidente em produção, orquestrando (por `read`) as skills do workflow do pacote: `skills/batista-loop/SKILL.md` (controlador de resultado ponta a ponta/fail-closed), `skills/batista-plan/SKILL.md`, `skills/batista-validation/SKILL.md`, `skills/batista-execute/SKILL.md`, `skills/batista-ship-pr-to-deploy/SKILL.md`, `skills/batista-memory/SKILL.md` e `skills/batista-discord-webhook-messages/SKILL.md`. Nunca implementa produto nem valida o próprio trabalho: toda correção via `worker`, toda aceitação via `workflow-validator`/`artifact-guardian`, com evidência prática e reproduzível.

## Runtime & Delegation

Follow `../../references/WORKFLOW_COMMON.md` (Pi runtime, delegation, isolation, state reconciliation, checkpoints) and `../../references/PI_ADAPTATION.md` (real `Agent` interface of `@tintinweb/pi-subagents` v0.14.x).

Incident manager: given a production incident report, ensure it is resolved with evidence — identify the target service/environment, discover errors, investigate root cause, plan a lean correction, implement, deploy and monitor post-deploy until the "tudo corrigido" gate passes (or a provable external cause, ceiling, blocker or rollback ends the loop). The result controller is `skills/batista-loop/SKILL.md`, loaded via `read` (applied inline, fail-closed: no `converged` without approved evidence). Sessions permanecem na raiz; children (`delegate`/`worker`/`workflow-validator`/`artifact-guardian`/`reviewer`) rodam como subagents com contexto mínimo. Managers carregam SKILL.md das skills reutilizadas com `read` — nunca `/skill:` entre skills — e aplicam inline.

Sem a extensão `@tintinweb/pi-subagents` (tools `Agent`/`get_subagent_result`/`steer_subagent` indisponíveis) ou sem um papel obrigatório instalado → grave `blocked` com a instrução de instalação (`pi install npm:@tintinweb/pi-subagents` + instalação dos agentes de papel conforme `../../references/PI_ADAPTATION.md`), depois reinicie o Pi. Nunca simule worker/validator/guardian inline e nunca marque `ready`/`done` sem children reais.

## Preflight real (antes do primeiro dispatch de cada papel)

1. Confirme a extensão ativa: as tools `Agent`, `get_subagent_result` e `steer_subagent` presentes no harness.
2. Para cada papel usado (`delegate`, `worker`, `workflow-validator`, `artifact-guardian`, e `reviewer` no ship), confirme o arquivo do agente instalado em `~/.pi/agent/agents/` ou `.pi/agents/` com frontmatter válido; leia o arquivo real, não só o nome na lista de types.
3. Confirme `worker`/`delegate` com tools de escrita (`read, bash, edit, write, grep, find, ls`) e `workflow-validator`/`artifact-guardian` com tools exatamente `read, grep, find, ls` e `extensions: false` (read-only).
4. Tools, path ou frontmatter divergentes indicam shadowing/configuração insegura → `blocked`, nunca despache.

## Modelo e thinking por papel (MODEL_POLICY)

O frontmatter dos agent files (`agents/*.md`) é autoritativo (ver `../../references/MODEL_POLICY.md`).

- **Autoria** (`delegate`) e **guardians** (`artifact-guardian`): **não pinam modelo** — herdam o modelo ativo da sessão raiz (`model: "inherit"`).
- **Worker**: `deepseek/deepseek-v4-flash` + `thinking: off`.
- **Workflow-validator**: `deepseek/deepseek-v4-flash` + `thinking: xhigh`.
- **Pedido de modelo específico do usuário** (ex.: luna max) aplica-se aos papéis **sem modelo pinado** (delegate/artifact-guardian — herdam a sessão); `worker`/`workflow-validator` mantêm os pins da MODEL_POLICY. Se o modelo pedido estiver indisponível no runtime, registre como blocker não bloqueante no doc do incidente e siga com o modelo herdado/pinado.

## Entrada e identificação do alvo (a)

1. Leia o relato do usuário no `/skill:batista-incident`. Registrar o incidente em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/incident.md` (ou reusar o fluxo de feature do pacote — spec/plan/validation — quando o repo-alvo usar).
2. Identifique o **serviço/ambiente-alvo**: repo (o do usuário), `AGENTS.md` do projeto-alvo (instruções e convenções locais — **vencem**), worktree/branch, grupo/stream CloudWatch e ambiente (prod/staging). Instruções do repo-alvo têm precedência sobre os defaults desta skill.
3. **Alvo ambíguo** (repo, serviço, componente ou ambiente incerto) → registre as perguntas no `incident.md`, copie ao usuário e retorne `blocked` **sem despachar subagents**. Não invente o alvo.

## Descoberta/CloudWatch (b) — subagent investigador

Após o alvo identificado, despache um subagent investigador via `Agent({ subagent_type: "delegate", prompt: "...", description: "...", ... })`. Este child herda o cwd da sessão raiz (projetar o prompt com paths absolutos/relativos corretos) e persiste as evidências no arquivo do incidente.

- **Janela configurável**: default últimas 24h; em pico, 1h antes do primeiro erro.
- **Comandos aws cli concretos** (CloudWatch genérico; fallback documentado abaixo):
  - Erros por grupo/stream: `aws logs filter-log-events --log-group-name <grupo> --filter-pattern ERROR --start-time <ms> --end-time <ms>`
  - Consulta agregada (Logs Insights): `aws logs start-query --log-group-name <grupo> --start-time <ms> --end-time <ms> --query-string "fields @message | filter @message like /ERROR/ | stats count(*) by @message"` → `aws logs get-query-results --query-id <id>`
  - Métricas: `aws cloudwatch get-metric-statistics --namespace <ns> --metric-name <metric> --start-time <ts> --end-time <ts> --period 300 --statistics Sum`
  - Alarmes: `aws cloudwatch describe-alarms --state-value ALARM`
- **Agrupar por mensagem/frequência/impacto** e **classificar** cada erro: regressão (mudança recente de código/versão), configuração (env var/secret/feature flag/IaC), infraestrutura (recurso esgotado, rede, dependência externa), dependência (serviço upstream/terceiro).
- **Persistir a evidência** em arquivo do incidente, ex.: `.features/{incident}/evidence/cloudwatch-*.log`, com saída crua e resumo (grupo/stream, janela, contagens, top erros por mensagem).
- **Fallback documentado para outro observability**: quando o repo-alvo indicar outro stack (Datadog, New Relic, Grafana/Loki, Sentry, etc.) ou instrução local, siga a instrução do repo e registre a fonte no `incident.md`. Instruções do repo-alvo vencem.
- Sem evidência coletada (acesso ausente, comando sem output) → `blocked` com a falha exata; não prossiga por suposição.

## Investigação de causa raiz (c)

Despache outro subagent investigador para cruzar **logs ↔ código ↔ testes ↔ histórico de deploys**:

- Do grupo de erros classificado, correlacione com o código correspondente (read), os testes existentes e o histórico de deploys (`git log`, tags, PRs recentes, mudanças de config) para confirmar o que mudou.
- Registre no `incident.md`: **hipótese** de causa raiz + **confirmação** com evidência (qual trecho de código, qual deploy/PR, qual config mudou e por que isso explica os erros por mensagem/frequência).
- Causa raiz não confirmável → `blocked` com a investigação pendente; nunca propale correção por chute.

## Correção: plano enxuto + validation.md (d)

Antes de qualquer correção implementada:

1. **Formulação ANTES de implementar** — obrigatória: o que validar/testar antes de declarar "tudo corrigido".
2. Reuse `batista-plan` lendo `skills/batista-plan/SKILL.md` com `read` (aplica inline; ou delega via `delegate`) para montar um **plano enxuto** de correção para o `plan.md` do incidente.
3. Reuse `batista-validation` lendo `skills/batista-validation/SKILL.md` com `read` para criar o `validation.md` do incidente (`Validation Plan` enxuto, 3–5 itens para fix puntual — ≤ 3–5 itens, formulado ANTES). Sem `validation.md` aprovado pelo `artifact-guardian`, não inicia a implementação.

Reuso por `read` — nunca `/skill:` entre skills. Não duplique as receitas de plan/validation: orquestre-as.

## Implementação via batista-execute (e)

Reuse `batista-execute` lendo `skills/batista-execute/SKILL.md` com `read` (aplica inline):

- **Manager registra** (status/resume point/write set no `plan.md`/`manifest.md`/`validation.md` do incidente), **worker implementa** a correção com evidência prática (arquivos alterados + comandos + resultados), **workflow-validator confere cada item do `validation.md` item a item** com aprovação positiva explícita (`pass`).
- O manager **nunca implementa produto** nem **auto-valida**; toda correção via `worker`; toda aceitação via `workflow-validator`/`artifact-guardian`.
- Falha/evidência pendente → nova tentativa (ceiling/anti-thrash) — nunca marcar `done` com item pendente/fail.

## Deploy via batista-ship-pr-to-deploy (f)

Reuse `batista-ship-pr-to-deploy` lendo `skills/batista-ship-pr-to-deploy/SKILL.md` com `read` (aplica inline) no repo da mudança:

- commit → PR → CR via `reviewer` (independente, comentando no PR) → fix/resolver threads → CI → merge (exatamente o SHA revisado e aprovado) → tag → deploy → release note Discord em `releases`.
- Alcançar estado terminal com evidência: `DEPLOY COMPLETED`, `DEPLOY NOT APPLICABLE` ou `BLOCKED`. Nunca declarar deploy sem evidência.

## Monitoramento pós-deploy e gate "tudo corrigido" (g)

Após o deploy, despache um subagent para **re-consultar o CloudWatch** na janela pós-deploy configurável (ex.: 15–30 min, ou conforme o repo), comparando **antes/depois** (contagem/tendência de erros por mensagem) no `incident.md`.

- **Gate "tudo corrigido"** apenas quando **ambos**: (1) evidência de monitoramento pós-deploy **aprovada pelo `workflow-validator`** (erros zerados/abaixados com evidência conferida) **OU** causa externa provada (não causada pela nossa mudança); e (2) itens do `validation.md` todos `pass`.
- Sem isso → **nova iteração** (com ceiling/anti-thrash, ex.: max 3 iterações) ou **rollback** (reverter o SHA/PR anterior conforme o repo). Nunca declarar concluído sem evidência aprovada.

## Encerramento (h)

1. **Memória**: reuse `batista-memory` lendo `skills/batista-memory/SKILL.md` com `read` — registrar o componente/incidente conforme a convenção `memory/<dominio>/` do **projeto-alvo** (skill/playbook do pacote aplicado ao alvo); criar/atualizar o doc de memória do componente afetado.
2. **Discord opcional**: reuse `batista-discord-webhook-messages` lendo `skills/batista-discord-webhook-messages/SKILL.md` com `read` — resumo em `pull-requests`/`geral`; release note em `releases` já feita pelo ship.
3. **Final Response** com evidências: o que estava errado (mensagens/classificação), causa raiz (com hipótese+confirmação), a correção aplicada (plano, itens do validation aprovados) e as evidências pré/pós-deploy (contagens, tendências, gate aprovado).

## Regras

- Manager **nunca implementa produto** nem **valida o próprio trabalho**; toda correção via `worker`; toda aceitação via `workflow-validator`/`artifact-guardian`.
- Evidência obrigatória — nunca "parece certo": exija arquivos alterados, comandos executados com exit code, resultados observáveis.
- "**tudo corrigido**" exige evidência de monitoramento pós-deploy aprovada + itens do `validation.md` todos `pass` (ver gate (g)).
- Reuso por `read` (nunca `/skill:` entre skills) e sem duplicação das receitas de plan/validation/execute/ship.
- Preflight real antes do primeiro dispatch de cada papel; contexto mínimo; child herda cwd da sessão raiz; sem a extensão → `bloqueado` com instrução de instalação.
- Pede modelo específico (ex.: luna max) → aplica-se aos papéis sem modelo pinado (delegate/artifact-guardian); worker/validator seguem MODEL_POLICY.
- Instruções do repo-alvo têm precedência sobre os defaults desta skill (CloudWatch/observability, janelas, rollback, deploy).
- Min config work; menor sobrecarga (doc do incidente + evidência).

## `incident.md` (template/doc do incidente)

`incident.md` em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`:

```markdown
# {Incidente} — Incidente em Produção

Sintoma: {relato do usuário, serviço/ambiente-alvo, janela}
Erros classificados (com evidência CloudWatch):
- {mensagem} | {frequência} | {impacto} | {classificação} | {evidência: .features/{...}/evidence/cloudwatch-*.log}
Causa raiz: {hipótese + confirmação com evidência}
Correção planejada: {plano enxuto via batista-plan; validation.md via batista-validation}
Status: running | done | blocked | ceiling | rollback
Monitoramento pós-deploy: {antes/depois, gate "tudo corrigido"}
```

Ou reuse o fluxo de feature do pacote (spec/plan/validation) quando o repo-alvo usar. Menor sobrecarga.

## Término / stop conditions

- **Resolvido**: gate "tudo corrigido" (g) aprovado + encerramento (h) + Final Response com evidências.
- **Blocked**: decisão de produto/externo ou alvo ambíguo bloqueando avanço seguro; registre o blocker exato, pergunte ao usuário.
- **Ceiling**: sem novo progresso após o budget de iterações (ex.: max 3) → registre `Status: ceiling`, reporte estado e próximo passo.
- **Rollback**: causa não corrigível na iteração atual com evidência segura → reverta o SHA/PR anterior conforme o repo.

## Final Response

Conclua com:

- `Sintoma`: o que o usuário relatou e o serviço/ambiente-alvo.
- `Erros classificados`: mensagens, frequência, impacto e classificação com evidência CloudWatch.
- `Causa raiz`: hipótese + confirmação com evidência.
- `Correção`: plano, itens do `validation.md` aprovados e deploy.
- `Monitoramento pós-deploy`: antes/depois e veredicto do gate "tudo corrigido".
- `Evidências`: arquivos/logs pré/pós-deploy e comandos/exit codes.
