---
name: batista-validation
description: Elabora e orquestra o plano e o progresso de validação de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`. Quando executada de forma independente (standalone), monta o checklist de validações (o que será validado, o que precisa ser feito e o que precisa ser confirmado para passar com sucesso, cobrindo API, E2E incluindo frontend e testes automatizados), delega a execução prática da validação para um subagent worker, delega a checagem independente de sucesso para o subagent workflow-validator e executa o loop de correção e reteste até aprovação total. Quando orquestrada por batista-manifest, atua como child delegate formulando o validation.md. Use `/skill:batista-validation` quando o usuário solicitar plano de validação, checklist de testes, execução de validações de API/E2E, conferência de evidências ou revisão de validation.md.
---

# Feature Validation

## Runtime & Delegation

Leia e siga `../../references/WORKFLOW_COMMON.md` (runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints), `../../references/PI_ADAPTATION.md` (interface real da tool `Agent` de `@tintinweb/pi-subagents` v0.14.x) e `../../references/MODEL_POLICY.md`.

### Modos de Operação

1. **Modo Orquestrado (Child de `batista-manifest`):**
   - Roda como child `delegate` com contexto mínimo (fresh) via `Agent({ subagent_type: "delegate", ... })`.
   - Escopo: formulação exclusiva do artefato de planejamento `validation.md` da feature (nunca edita código de produto nem roda validações inline).
   - Retorna apenas o envelope canônico `DELEGATION_RESULT` para o manager.

2. **Modo Independente / Standalone (Invocação direta pelo usuário via `/skill:batista-validation`):**
   - Esta sessão na raiz atua como **Manager de Validação**: nunca implementa código diretamente nem atesta seu próprio trabalho.
   - **Monta o checklist de validações** estruturado no `Validation Plan` em `validation.md` (ou display de checklist), definindo com rigor:
     - **O que será validado:** identificação do alvo, fluxo, endpoint, componente, tela ou requisito da spec (`R#`).
     - **O que precisa ser feito:** método concreto, passos de execução, scripts, comandos CLI, chamadas de API ou navegação E2E/UI.
     - **O que precisa ser confirmado para passar com sucesso:** critérios de aceite objetivos, saída observável esperada, exit code `0`, status HTTP (ex: 200/201), payloads validados, estado visual no frontend e ausência de erros.
   - **Cobertura mandatória:** validação por **API**, validação **E2E (incluindo Frontend)** e testes automatizados focados.
   - **Delegação da execução:** despacha subagent `worker` para executar os passos práticos da validação e coletar evidências observáveis reais.
   - **Delegação da checagem independente:** despacha subagent `workflow-validator` (estritamente read-only) para auditar as evidências produzidas e emitir aprovação positiva explícita item a item (`pass`/`fail`).
   - **Loop de correção e reteste:** se qualquer item falhar ou o validador rejeitar, despacha `worker` para corrigir a falha, re-executa a validação do item afetado e submete novamente ao `workflow-validator` até convergência total.

### Fronteira de Escrita e Segurança (Fail-Closed)

- **Manager de Validação (sessão raiz):** edita apenas `validation.md` (status, progresso, evidências registradas, resume point e `Updated:`). Jamais edita código de produto, testes ou configurações diretamente.
- **Worker (`worker`):** subagent com tools de escrita (`read, bash, edit, write, grep, find, ls`) responsável por executar comandos, testes, requests, fluxos E2E e aplicar correções de código quando houver falhas.
- **Validador (`workflow-validator`):** subagent estritamente read-only (`tools: read, grep, find, ls`, `acceptanceRole: read-only`, `extensions: false`). Jamais edita arquivos ou executa comandos de mutação.
- Sem adivinhação: toda conclusão deve ser sustentada por evidência concreta (stdout/stderr observável, exit code, log, response de API, DOM/screenshot de frontend). Sem evidência reproduzível = blocker.

---

## Preflight e Runtime Canary

Antes do primeiro dispatch de subagent no modo standalone:

1. **Preflight de agents:** confirme as tools `Agent`, `get_subagent_result` e `steer_subagent` no harness. Confirme a presença e integridade dos arquivos `worker.md`, `workflow-validator.md` e `artifact-guardian.md` em `~/.pi/agent/agents/` ou `.pi/agents/`.
2. **Runtime Canary (obrigatório):** execute um canary read-only antes de iniciar as validações:
   ```text
   Agent({
     subagent_type: "worker",
     prompt: "Canary: sem escrever nada, reporte pwd; git rev-parse --show-toplevel; git branch --show-current; conectividade. Retorne DELEGATION_RESULT com evidence.",
     description: "canary validação",
     max_turns: 3
   })
   ```
   Confirme (1) cwd == project root / worktree esperado, (2) modelo/thinking efetivo conforme `MODEL_POLICY.md`, (3) conectividade para API e E2E. Divergência → `blocked`.

---

## Workflow

### 1. Descoberta e Determinação do Modo
1. Leia o `AGENTS.md` do projeto.
2. Identifique o modo de execução: **standalone** (invocado diretamente pelo usuário) ou **orquestrado** (child `delegate` invocado pelo `batista-manifest`).
3. Localize a pasta da feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/` ou o escopo indicado pelo usuário. Se já existirem `spec.md`, `plan.md` e `validation.md`, leia todos os artefatos existentes.
4. No modo orquestrado, o `validation.md` só é formulado **após** `spec.md` e `plan.md` estarem `ready` com seus guardians `approved`.

### 2. Formulação do Checklist / Validation Plan
Monte ou atualize o `Validation Plan` em `validation.md` **antes** de qualquer execução de validação. Cada item `V#` deve cobrir uma superfície ou requisito da feature/escopo e conter obrigatoriamente os três pilares:

1. **O que será validado:**
   - Descrição clara do comportamento, endpoint, componente visual, fluxo de usuário ou regra de negócio sendo validada.
   - Vínculo direto com o requisito EARS (`R#`) e critério de aceite (Dado/Quando/Então) da spec.
   - Superfície técnica afetada (ex: `API`, `Frontend/E2E`, `CLI`, `Database`, `Integration`).

2. **O que precisa ser feito:**
   - Roteiro passo a passo e comandos executáveis exatos.
   - Para **Validação por API:** comandos `curl`/scripts com método HTTP, URL/endpoint, headers (autenticação, Content-Type), payload de request JSON, query params e parâmetros de rota.
   - Para **Validação E2E (incluindo Frontend):** passos do fluxo de interface (abertura de rota/URL, renderização de elementos UI, preenchimento de inputs, cliques em botões, disparo de ações assíncronas, navegação entre telas, validação de responsividade e comportamento visual).
   - Para **Testes Automatizados:** comando exato de teste focado (ex.: `npm test -- ...`, `pytest ...`, `cargo test ...`).

3. **O que precisa ser confirmado para passar com sucesso:**
   - Critérios de aceite objetivos e mensuráveis.
   - Saída observável esperada: exit code `0`, HTTP Status Code esperado (ex: `200 OK`, `201 Created`, `400 Bad Request` em caso de erro esperado).
   - Assertividade no payload retornado (campos, tipos e valores obrigatórios).
   - Estado visual e DOM no frontend (componentes visíveis, mensagens de sucesso/erro renderizadas, estado reativo atualizado, ausência de erros no console do navegador).
   - Integridade de persistência (dados gravados corretamente no banco/armazenamento).

### 3. Guardião do Plano de Validação (Artifact Guardian)
- No modo standalone, antes de iniciar a execução dos testes, submeta o `validation.md` ao `artifact-guardian`:
  ```text
  Agent({
    subagent_type: "artifact-guardian",
    prompt: "Audite o validation.md em {path} aplicando a rubrica de validação. Verifique se todos os itens V# possuem: o que será validado, o que precisa ser feito (método/comandos concretos) e o que precisa ser confirmado para passar (evidência esperada observável), cobrindo API e E2E/front. Retorne DELEGATION_RESULT.",
    description: "guardian validation.md",
    max_turns: 3
  })
  ```
- Se o guardian rejeitar (`status: rejected`), aplique o menor ajuste necessário no `validation.md` até obter `approved`.

### 4. Delegação da Execução da Validação para o Subagent `worker`
Para cada item `V#` (ou lote de itens independentes):
1. Atualize o `Validation Progress` em `validation.md` com status `running`.
2. Dispare o subagent `worker` com escopo fechado para executar a validação prática:
   ```text
   Agent({
     subagent_type: "worker",
     prompt: "Você é o worker responsável por executar a validação prática do item {V#}.\nLeia validation.md e execute estritamente os passos do método:\n- O que fazer: {passos/comandos de API, E2E/front ou testes}\n- O que confirmar: {critérios de sucesso e saída esperada}\nColete a evidência observável completa (stdout/stderr cru, exit codes, responses de API, logs de execução, estados de UI/DOM).\nNão edite código de produto durante a execução do teste.\nRetorne DELEGATION_RESULT com a evidência detalhada e arquivos afetados.",
     description: "executar validação {V#}",
     max_turns: 10
   })
   ```
3. Registre no `validation.md` (`Validation Progress`) a evidência prática bruta produzida pelo worker e marque o status preliminar (`pending` para conferência do validador).

### 5. Delegação da Checagem Independente para o Subagent `workflow-validator`
Para cada validação executada:
1. Dispare exatamente um subagent `workflow-validator` (read-only):
   ```text
   Agent({
     subagent_type: "workflow-validator",
     prompt: "Você é o validador independente da validação do item {V#}.\nLeia AGENTS.md, spec.md, plan.md, validation.md e a evidência produzida pelo worker.\nVocê é estritamente read-only: não altere arquivos nem execute comandos.\nConfira item a item se a evidência prática comprova que todos os critérios de sucesso ('o que precisa ser confirmado') foram satisfeitos para API e E2E/front.\nExija saída observável real, exit codes, status HTTP e estados de UI comprovados.\nConceda aprovação positiva explícita ('pass') somente se comprovado; ausência de erro não é aprovação.\nRetorne DELEGATION_RESULT com approved/rejected, itens conferidos e causa mínima se rejeitado.",
     description: "checar validação {V#}",
     max_turns: 5
   })
   ```
2. Analise o retorno do validador:
   - **Aprovado (`approved` / `pass`):** registre a conferência positiva na tabela `Validation Progress` do `validation.md` e promova o item para `pass`.
   - **Rejeitado (`rejected` / `fail`):** registre o motivo da falha, aponte a discrepância e promova o item para `fail`, iniciando o loop de correção.

### 6. Loop de Correção e Reteste (Fix & Re-validation)
Sempre que um item `V#` falhar ou for rejeitado pelo `workflow-validator`:
1. **Registro da falha:** anote no `validation.md` a causa raiz, a discrepância observada e a correção necessária.
2. **Delegação da correção para o `worker`:**
   ```text
   Agent({
     subagent_type: "worker",
     prompt: "Você é o worker de correção da falha no item {V#}.\nMotivo da rejeição pelo validador: {diagnóstico/causa}\nWrite set permitido: {arquivos de código/teste afetados}\nImplemente o menor diff seguro para corrigir o problema e garanta que o código atenda aos critérios esperados.\nRetorne DELEGATION_RESULT com os arquivos alterados e a justificativa da correção.",
     description: "corrigir falha {V#}",
     max_turns: 15
   })
   ```
3. **Re-execução da validação:** despache novamente o `worker` de validação para re-executar os testes, chamadas de API e fluxos E2E/front do item afetado, coletando nova evidência prática pós-correção.
4. **Re-checagem independente:** despache novamente o `workflow-validator` para auditar a nova evidência.
5. **Convergência:** repita até que o item obtenha `pass` confirmado pelo validador.
6. **Guardrail Anti-thrash:** se a mesma falha persistir por 3 iterações sem novo avanço de evidência, registre `Status: blocked` com a pergunta/escalação necessária no `validation.md` e solicite direcionamento do usuário.

### 7. Fechamento e Sincronização
1. Atualize o cabeçalho `Status:` do `validation.md` para `done` (se todos os itens forem `pass` com conferência aprovada) ou `fail`/`blocked`.
2. Atualize o timestamp `Updated: {YYYY-MM-DD HH:MM}`.
3. No modo standalone, apresente o relatório final consolidado ao usuário.
4. No modo orquestrado, retorne o `DELEGATION_RESULT` canônico ao manager chamador.

---

## Template de `validation.md`

```markdown
# {Feature} — Plano e Progresso de Validação

Status: draft | ready | running | done | fail | blocked
Spec: ./spec.md
Plan: ./plan.md
Updated: {YYYY-MM-DD HH:MM}

> `Validation Plan` formulado **antes** de qualquer validação; `Validation Progress` rastreado item a item.
> Cada item contém: o que será validado, o que precisa ser feito e o que precisa ser confirmado para passar.

## Validation Plan

Itens `V#` derivados dos requisitos da spec e tasks do plano, cobrindo validações de API, E2E (incluindo Frontend) e testes automatizados.

### V1 — {Nome do item / Funcionalidade}

- **O que será validado:** {descrição do comportamento/funcionalidade, componente, endpoint ou fluxo afetado}
- **Requisito/AC:** {R#} ({AC Given/When/Then})
- **Superfície:** API | Frontend/E2E | CLI | Integration
- **O que precisa ser feito:**
  - Passo 1: `{comando concreto / chamada de API / ação no front}`
  - Passo 2: `{comando concreto / verificação de estado}`
- **O que precisa ser confirmado para passar com sucesso:**
  - Saída observável: `{saída esperada no terminal / log}`
  - Exit code esperado: `0`
  - Status HTTP / Resposta API: `{ex: 200 OK com payload schema { id, status: "active" }}`
  - Estado visual / Frontend: `{ex: componente renderizado com texto X, sem erros no console}`
  - Persistência: `{ex: registro gravado na tabela Y com status Z}`
- **Fase/task produtora:** {Phase/task do plan.md ou standalone}

### V2 — {Nome do item de API}

- **O que será validado:** Validação de endpoint de API `{METHOD /path}` sob condições normais e casos de erro.
- **Requisito/AC:** {R#}
- **Superfície:** API
- **O que precisa ser feito:**
  - `curl -s -X POST http://localhost:PORT/api/v1/... -H "Content-Type: application/json" -d '{"key":"value"}'`
- **O que precisa ser confirmado para passar com sucesso:**
  - HTTP `200 OK` (ou `201 Created`), JSON contendo campos obrigatórios, exit code `0`.

### V3 — {Nome do item E2E / Frontend}

- **O que será validado:** Fluxo de ponta a ponta na interface do usuário (Frontend UI + integração Backend).
- **Requisito/AC:** {R#}
- **Superfície:** Frontend/E2E
- **O que precisa ser feito:**
  - Navegar até `{URL/rota}`, interagir com `{elementos/botões}`, preencher formulário `{dados}`, submeter.
- **O que precisa ser confirmado para passar com sucesso:**
  - Renderização visual correta, mensagem de sucesso visível na UI, dados refletidos na tela e na API, sem erros no console.

## Validation Progress

Rastreamento item a item. O subagent `worker` produz as evidências práticas e o subagent independente `workflow-validator` audita e confere cada item antes de promover para `pass`.

| Item | Superfície | Status | Evidência prática produzida | Conferido pelo workflow-validator |
|---|---|---|---|---|
| V1 — {Nome} | Integration | pending | pending | pendente |
| V2 — {Nome} | API | pending | pending | pendente |
| V3 — {Nome} | Frontend/E2E | pending | pending | pendente |

## Registro de Correções e Retestes (Fix & Re-validation Log)

| Item | Falha identificada | Correção aplicada (Worker) | Novo reteste | Veredicto Validator |
|---|---|---|---|---|
| - | Nenhuma falha até o momento | - | - | - |

## Regras de Promoção e Invalidação

- **Promoção:** um item só vira `pass` com evidência prática registrada (saída observável + exit code / HTTP / estado UI) e conferência positiva explícita do `workflow-validator`.
- **Falha e Correção:** qualquer item `fail` ou rejeitado dispara correção via `worker` e novo ciclo de reteste/validação.
- **Bloqueio:** itens `pending`/`fail` bloqueiam `Status: done`, `converged` e merge.
- **Cascata (C2/D6):** mudança substantiva em `spec.md` ou `plan.md` rebaixa `validation.md` para `draft` e o guardian para `pending`, resetando itens `pass` anteriores para `pending`.
- **Limite de escrita:** este arquivo é editado somente pelo manager de validação/execução; nunca entra no write set direto de workers paralelos.
```

---

## Artifact Guardian

O `artifact-guardian` é invocado no modo standalone após a formulação de `validation.md` (e no modo orquestrado pelo manager). É estritamente read-only (`tools: read, grep, find, ls`).

### Rubrica Obrigatória

Registre cada critério como `pass/fail` no campo `evidence` do `DELEGATION_RESULT`:

- [pass/fail] `Validation Plan` formulado antes de executar as validações, cobrindo todas as superfícies da feature/escopo.
- [pass/fail] Cada item `V#` detalha com clareza os 3 pilares: (1) o que será validado (com vínculo a `R#`), (2) o que precisa ser feito (método/comandos concretos, requests de API ou passos E2E) e (3) o que precisa ser confirmado para passar (saída observável, exit code, HTTP status, estado visual).
- [pass/fail] Cobertura expressa de **API** e **E2E (incluindo Frontend)** quando aplicáveis ao escopo.
- [pass/fail] `Validation Progress` contém um registro por item `V#`, rastreando evidências práticas e status de conferência pelo `workflow-validator`.
- [pass/fail] `Status` e `Updated:` consistentes; nenhum `pass` sem veredito explícito positivo do validador.

Qualquer `fail` exige `status: rejected`. O manager aplica o ajuste mínimo em `validation.md` e revalida com o guardian.

---

## Regras

- Status permitidos: `draft`, `ready`, `running`, `done`, `fail`, `blocked`.
- Separação de papéis: Manager nunca edita produto nem executa testes diretamente; Worker executa validações práticas e correções; Workflow-Validator audita evidências de forma independente.
- Formulário prévio obrigatório: nunca execute validações sem o `Validation Plan` estruturado.
- Validação completa: abrange API, E2E (incluindo Frontend) e testes automatizados pertinentes.
- Evidência real obrigatória: "parece certo", leitura de diff ou resumo genérico não são evidências. Exija stdout/stderr cru, exit codes, responses de API e confirmação de estado de tela.
- Qualquer falha detectada durante a validação **deve ser corrigida pelo worker e retestada** até aprovação pelo validador.
- Sem promoção por silêncio: o `workflow-validator` deve aprovar positivamente cada item de forma inequívoca.
- No modo orquestrado: retorna apenas `DELEGATION_RESULT` e não executa validação inline.

---

## Skill Extraction

Receitas de validação repetitivas tornam-se skills de projeto:
- **Gatilho:** mesma sequência de validação/comandos repetida em ≥ 2–3 itens ou features.
- **Ação:** planejar task de extração para `{project}/skills/{skill-name}/` com guardian de validação.
- Roda apenas no worktree principal, após merge, uma extração por vez.

---

## Checkpoint (obrigatório)

Antes de qualquer chamada de subagent, guardian ou encerramento de turno, registre em `validation.md`: `Updated:`, ponto de retomada, status dos itens, evidências coletadas e blockers.

---

## Estado e Memória

- O arquivo `validation.md` é a fonte da verdade, não o contexto efêmero da sessão. Escreva deltas antes de prosseguir (write-before-forget).
- O contexto retém apenas: diretório da feature, item atual em validação, blockers e próxima ação.
- Divergência entre contexto e arquivo: o arquivo sempre vence.

---

## Isolamento de Contexto

- Subagents (`worker`, `workflow-validator`, `artifact-guardian`, `delegate`) recebem apenas o contexto mínimo necessário para sua tarefa específica.
- Nunca repasse conversas inteiras ou históricos de sessões passadas.

---

## Resposta Final

No encerramento em **modo standalone**, responda com:

- **Sumário da Validação:** objetivo da validação e status consolidado (`done` | `fail` | `blocked`).
- **Checklist de Validações Executadas:** itens `V#` detalhando o que foi validado, passos executados e confirmações obtidas (API, E2E/Frontend, Testes).
- **Evidências Práticas:** comandos executados, exit codes, responses de API e validações visuais de UI registradas.
- **Relatório de Correções e Retestes:** problemas encontrados, correções aplicadas pelo worker e revalidações aprovadas pelo workflow-validator.
- **Veredito do Validador Independente:** confirmação explícita do `workflow-validator` atestando o sucesso de cada item.
- **Itens Abertos / Bloqueios:** blockers pendentes ou `nenhum`.

No **modo orquestrado**, substitua a resposta humana pelo envelope canônico `DELEGATION_RESULT`.
