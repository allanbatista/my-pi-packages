---
name: ux
description: Cria, revisa e mantém apenas o `ux.md` de usabilidade de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/ux.md`, a partir de `spec.md` e condicional a haver superfície de frontend afetada. Use como `/skill:ux` quando o usuário pedir usabilidade, fluxo de uso, estados de tela, prevenção de erro, feedback, acessibilidade ou revisão da experiência de uma feature com frontend.
---

# Feature UX


## Pi Runtime

No Pi, a delegação padrão é **inline** com isolamento de contexto (ver `references/PI_ADAPTATION.md`). Use `spawn_agent`/`fork_context` apenas quando o runtime oferecer paridade Codex. Invoque skills filhas via `/skill:<name>`. Não bloqueie o workflow por indisponibilidade de subagent.
## Delegação

Siga `references/PI_ADAPTATION.md`:
- **Padrão Pi**: execução inline na sessão atual, contexto mínimo (pedido, paths, `AGENTS.md`, docs da feature).
- **Opcional**: subagent via `spawn_agent` quando disponível; `fork_context: false` e model pinning são opcionais.
- **Guardian**: passo separado (inline ou subagent) que aplica rubrica sem editar arquivos.
- **Paralelo**: batch paralelo quando suportado; senão serialize com write sets verificados.


Use esta skill para fechar a **usabilidade** da feature antes do plano técnico, quando há frontend afetado. Foco em usabilidade — não em estética, tokens ou pixel (isso fica para `frontend-design` na execução).

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta e registre como `pending` qualquer afirmação que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Quando invocada por outra skill do feature-workflow, execute com isolamento de contexto (inline por padrão no Pi; subagent opcional — ver `references/PI_ADAPTATION.md`), recebendo apenas pedido, project root, feature dir e docs necessários.

## Applicability

- Produza `ux.md` só quando `spec.md` indicar superfície de frontend/UI afetada (ver `Validation surfaces` da spec).
- Se não houver frontend afetado, não crie o arquivo: responda `ux não aplicável` com a evidência (superfícies da spec) e devolva o controle.
- Roda em paralelo com `/skill:arch`; ambas partem da mesma spec como contrato âncora.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Determine o modo: **standalone** (usuário invocou direto) ou **orchestrated** (invocada por `manifest` em subagent — não pergunte ao usuário no meio). Ver `Clarification Protocol`.
3. Localize o `spec.md` da feature. Se não existir, use `/skill:spec` primeiro. Se estiver `draft`/`blocked`, registre blocker, set `Status: blocked` e devolva ao manager.
4. Confirme a aplicabilidade (superfície frontend na spec). Se não aplicável, pare conforme `Applicability`.
5. Se o input for um `ux.md` existente, trate como revisão: leia antes de decidir status.
6. **Usability Discovery**: trace os fluxos de uso atuais ponta a ponta, telas/rotas afetadas, componentes reutilizáveis, estados existentes e baseline de acessibilidade. Registre cada achado no `Usability Ledger` com `U#`, fonte e evidência. Use Graphify quando `graphify-out/graph.json` existir.
7. Para cada requisito de frontend da spec (forma EARS), desenhe a usabilidade alinhada ao `Shared Contract` da spec: fluxo de tarefa eficiente, estados (empty/loading/error/success), prevenção e recuperação de erro, feedback e visibilidade de estado, consistência, carga cognitiva e acessibilidade.
8. Monte a rastreabilidade: cada decisão de usabilidade ligada a um requisito EARS da spec e a um `U#` do Discovery.
9. Feche estados, a11y e fora de escopo antes de `Status: ready`. Dúvida de produto → orchestrated: `Open Questions` + `Status: blocked`; standalone: pergunte.
10. Escreva ou atualize somente `ux.md`.
11. Rode guardian independente (inline ou subagent); aplique o menor ajuste e repita até `approved`.
12. Responda conforme `Final Response` (inclua `Open Questions` + `Resume` quando `blocked` em orchestrated).

## Template

```markdown
# {Feature} — UX

Status: draft | ready | blocked
Spec: ./spec.md
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Applicability

- Frontend afetado: {sim | não} — evidência: {superfícies da spec}

## Usability Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| U1 | {tela/rota/componente/fluxo/doc/resposta} | {fato ou lacuna de usabilidade} | {path, trecho, screenshot, comando} | {como muda o fluxo/estado} | confirmed/pending |

## Affected Screens & Flows

- Telas/rotas: {lista}
- Fluxo de tarefa alvo: {passo a passo eficiente para o usuário concluir}

## Component & State Inventory

- Componentes: {reusados/novos}
- Estados por tela: empty | loading | error | success

## Usability Traceability

| Requisito (EARS front) | Decisão de usabilidade | Estados cobertos | Acessibilidade | Validação | Basis | Status |
|---|---|---|---|---|---|---|
| {req da spec} | {fluxo/interação/feedback} | {empty/loading/error/success} | {a11y concreta} | {browser/step/probe} | {U# ou decisão} | defined/pending |

## Error Prevention & Recovery

- Prevenção: {como o design evita o erro}
- Recuperação: {como o usuário se recupera}

## Accessibility

- {navegação por teclado, foco, contraste, labels, roles — concreto por tela}

## Out of Scope

- Estética/tokens/pixel: delegado a `frontend-design` na execução.
- {outras exclusões}

## Open Questions

- {none | pergunta de usabilidade que bloqueia ready}

## Readiness Gates

- [ ] `AGENTS.md` e `spec.md` lidos.
- [ ] Cada requisito de frontend tem fluxo, estados e a11y definidos e ligados a um `U#`.
- [ ] Prevenção e recuperação de erro cobertas.
- [ ] Estados empty/loading/error/success cobertos por tela afetada.
- [ ] Guardian aprovou o `ux.md`.

## Definition of Done

- [ ] Usabilidade de todo requisito frontend fechada com rastreabilidade.
- [ ] Estados e acessibilidade definidos com evidência ou decisão.
- [ ] Validação prática (browser/steps) definida para cada fluxo.
- [ ] Guardian aprovou.
```

## Artifact Guardian

Após atualizar `ux.md`, rode guardian independente (inline ou subagent) com contexto mínimo: pedido do usuário, project root, `AGENTS.md`, feature dir, `spec.md`, `ux.md` e evidências citadas.

O guardian não edita arquivos. Ele valida por usabilidade, sem achismo.

Saída obrigatória do guardian:

```markdown
Status: approved | rejected
Rubric:
- [pass/fail] Cada requisito de frontend da spec tem fluxo de tarefa eficiente definido.
- [pass/fail] Estados empty/loading/error/success cobertos em cada tela afetada.
- [pass/fail] Erro é prevenível e recuperável, com feedback visível.
- [pass/fail] Acessibilidade concreta por tela (teclado, foco, contraste, labels).
- [pass/fail] Cada decisão de usabilidade referencia um `U#` do Discovery ou decisão registrada.
- [pass/fail] Escopo não invade estética/tokens (fora de escopo respeitado).
Questions: none | {perguntas que bloqueiam ready}
Critiques: none | {críticas que bloqueiam ready}
Required changes: none | {ajustes obrigatórios}
```

Qualquer item `fail` na rubrica força `Status: rejected`. Trate `Rubric`, `Questions`, `Critiques` e `Required changes` como blocker; corrija `ux.md` quando a resposta já estiver disponível, pergunte ao usuário (standalone) ou registre em `Open Questions` (orchestrated). Só use `Status: ready` com guardian `approved`.

## Rules

- Foco em usabilidade; não decida estética, tokens ou pixel (fora de escopo, delegado a `frontend-design`).
- Não decida produto: se faltar decisão de produto, registre blocker e puxe para `spec.md`.
- Cada decisão de usabilidade referencia um requisito EARS da spec e um `U#` do Discovery, ou vira `pending`.
- Cubra empty/loading/error/success em toda tela afetada; estado faltante é blocker.
- Prevenção e recuperação de erro são obrigatórias por fluxo.
- Acessibilidade concreta por tela; não aceite "seguir boas práticas" genérico.
- Mesmo se o usuário disser "implemente", esta skill cria/refina `ux.md` e para.
- Ao receber `ux.md` existente, trate como revisão e não aceite status pronto herdado sem checagem.
- Roda em paralelo com `arch` sem ver `arch.md`; conflito com `Shared Contract` ou premissa técnica vira `Open Questions` (orchestrated: `Status: blocked`) — reconciliação final no `plan`.
- Não aceite guardian genérico; ele lista evidência conferida ou bloqueia com pergunta/crítica objetiva.

## Clarification Protocol

- Standalone: pergunte ao usuário em lote, registre em `Open Questions` resolvidas e continue.
- Orchestrated: não pergunte no meio. Preencha `Open Questions` com IDs `Q#`, set `Status: blocked`, grave `ux.md` e devolva ao manager com bloco copiado na resposta final.

## Checkpoint (obrigatório)

Antes de **cada** guardian ou de ceder o turno, grave no `ux.md`: `Updated:`, `Status`, `Open Questions` e blockers.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `ux.md` antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, requisito/tela atual, blockers abertos, próxima ação. O resto é ponteiro e se re-lê sob demanda.
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence.
- O que sobrevive à feature (padrão de usabilidade reutilizável, convenção de a11y) vai pro projeto (`AGENTS.md`/skill project-local); o efêmero fica em `.features/{...}/`.

## Context Isolation

- Quando houver manager, aceitar invocação orchestrated com contexto mínimo (inline por padrão no Pi).
- Não herdar contexto irrelevante da sessão manager.
- Passar somente artefatos mínimos: pedido, paths, `AGENTS.md`, `spec.md` e documentos da feature.
- Se subagents não estiverem disponíveis, siga `references/PI_ADAPTATION.md` (execução inline com isolamento de contexto); declare a limitação na resposta final e não use contexto oculto como evidência.

## Final Response

Ao concluir, responda com:

- `Resumo`: aplicabilidade e status do `ux.md`.
- `Será feito`: fluxos e estados desenhados do ponto de vista de usabilidade.
- `Validação planejada`: browser/steps por fluxo.
- `Open Questions` (somente quando `Status: blocked`): copie o bloco com IDs `Q#`.
- `Resume` (mesmo caso): feature dir + instrução de re-invocar com respostas `Q#`.
- `Pendências`: blockers, perguntas de usabilidade ou `none`.
- `Evidência`: arquivos/telas lidos e fatos que sustentam o `ux.md`.
