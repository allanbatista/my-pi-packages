---
name: loop
description: Controlador de resultado (closed loop) de uma feature ou épico em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/loop.md`. Garante que o objetivo é atingido, orquestrando as rotinas `manifest` e `execute` na sessão raiz e replanejando/reexecutando o menor ponto até fechar. Use como `/skill:loop` quando o usuário pedir para atingir um objetivo ponta a ponta, autopilot, decomposição em sub-features, execução sequencial/paralela, worktrees, merge/integração ou retomada de um objetivo long-running.
---

# Feature Loop

## Runbook obrigatório para modelo simples

Execute na ordem; não pule passos nem compense falha de child:

1. Paths de instrução (`../execute/SKILL.md`, `../manifest/SKILL.md`, `../../references/*`) são relativos ao diretório deste `loop/SKILL.md`, **nunca** ao cwd, project root ou epic dir. Se não conseguir ler o path real do package, grave `blocked`; não simule a rotina.
2. Antes do primeiro child, chame `subagent({ action: "list" })` e depois `subagent({ action: "get", agent: "{papel}" })` para cada papel usado.
3. Toda chamada de execução contém literalmente:
   - worker: `subagent({ agent: "worker", model: "deepseek/deepseek-v4-flash:off", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`;
   - validator: `subagent({ agent: "workflow-validator", model: "deepseek/deepseek-v4-flash:xhigh", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`;
   - outcome: `subagent({ agent: "artifact-guardian", model: "inherit", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`.
4. Em correção raiz, cheque ceiling/anti-thrash e persista/releia, antes do worker: outcome `pending`; iteração+ledger; plan/manifest/`State.Plan` `ready`; task/fase/evidência `pending`; linha `manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`.
5. Ordem de children da correção: **worker → workflow-validator → artifact-guardian**. Entre worker e validator não existe outro child; o outcome só vem após fechamento terminal, E2E e checkpoint.
6. Falha de chamada, `context` omitido, `(no output)` ou child incorreto nunca autoriza o manager a escrever produto. Inspecione o write set; se o produto não estiver correto, persista `fail` e faça um novo dispatch válido de worker. Sem validator positivamente aprovado, não marque task/sub-feature/E2E/outcome como pass/done/approved.
7. No máximo um dispatch por papel+task/tentativa. Não repita worker, validator ou guardian apenas para obter outro texto; erro real abre uma nova tentativa persistida, e retorno ambíguo bloqueia.


## Runtime & Delegação

Leia e siga `../../references/WORKFLOW_COMMON.md` para runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints.


Use esta skill como controlador de resultado: dado um objetivo, garanta que ele é atingido de fato, decidindo decomposição, sequência/paralelismo e integração, e iterando (planejar/replanejar/executar/reexecutar) até fechar com evidência.

Esta é a camada mais externa do plugin. Ela orquestra as rotinas `manifest` (autoria) e `execute` (execução); não escreve `spec`/`ux`/`arch`/`plan` direto nem implementa código de produto.

### Manager Tool Firewall — antes de todo `write`/`edit`

Resolva o target antes da chamada. A allowlist fechada da sessão raiz contém somente o `loop.md` selecionado e os `manifest.md`/`plan.md` das sub-features; qualquer outro path é produto e a chamada é proibida. Isso vale também para correção trivial de um byte, gap raiz, worker vazio/incorreto ou arquivo no path errado. Cancele a chamada e aplique `execute`, que despacha um `worker`. O manager nunca cria, edita, move, copia ou remove produto.

Não use achismo: o objetivo só está atingido com evidência prática no caminho afetado. Registre como blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Esta skill atua como manager raiz. Carregue as rotinas de `manifest` e `execute` com `read`; elas não são slash commands internos. Veja `../../references/PI_ADAPTATION.md`.

## Workflow

1. Leia o `AGENTS.md`, valide paths e aplique o preflight `list` + `get` de `../../references/WORKFLOW_COMMON.md`. Antes do **primeiro dispatch de cada papel**, deve existir uma chamada anterior `action: "get"` para esse papel; `list` não substitui `get`. Faça isso para `worker`, `workflow-validator`, `artifact-guardian` e, somente se houver autoria pendente, `delegate`.
2. Se o input resolver para `loop.md` ou diretório de épico existente, selecione-o e releia seu estado; **não crie outro diretório**. Se for objetivo novo, identifique o project root e crie `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/loop.md`.
3. Fixe o **objetivo verificável**: resultado esperado + evidência de aceite no nível do resultado. Ambiguidade material vira pergunta e `blocked`.
4. Decida ou releia a decomposição (ver `Decomposition`) e persista DAG, write sets, dependências e estratégia.
5. Reconcile `loop.md`, cada `manifest.md` e os artefatos ligados conforme `State Reconciliation`. Rebaixe qualquer índice otimista; arquivo e gates vencem resumos.
6. Para cada sub-feature liberada **não terminal**, cujo `execute`/`Status` ainda não seja `done`/`done`, carregue `../manifest/SKILL.md` somente se o manifest não estiver realmente `ready`; manifest com primeiro `Status: done` é terminal válido quando sua linha também está `done` e nunca deve ser reaberto. Aplique `../manifest/SKILL.md` inline em modo orchestrated, sem emitir `/skill:manifest` nem propagar a `Final Response` interna.
7. Releia manifest, spec, ux/arch e plan. Só aceite autoria quando todos os status literais, gates e guardians persistidos forem válidos e não houver clarificação material. Se houver perguntas, copie-as ao usuário, grave `blocked` e ceda o turno.
8. Com autoria válida e `execute` `pending|running|fail` elegível a retry, carregue `../execute/SKILL.md` com `read` e aplique sua rotina inline. Cada chamada deve informar literalmente `cwd: "{canonical-project-root}"`, `model: "deepseek/deepseek-v4-flash:off"` para `worker` e `model: "deepseek/deepseek-v4-flash:xhigh"` para `workflow-validator`; feature dir como `cwd`, `inherit`, campo ausente ou valor efetivo divergente invalida o dispatch e não promove estado. Execução concluída deve persistir `Status: done` no `manifest.md` e no `plan.md`. **Não encerre pedindo ao usuário para executar a fase.**
9. Execute batches de sub-features como batches: inicie as independentes antes de aguardar; serialize só as dependentes. Features paralelas usam worktrees isolados.
10. Ao fechar um batch, releia `manifest.md` e `plan.md` de cada sub-feature. Atualize sua linha atomicamente para `manifest=done`, `execute=done`, `Verify=pass`, `Status=done` somente quando o **primeiro campo `Status:`** de ambos e `manifest.md > State > Plan` persistirem `done`, todas as tasks/fases estiverem `done`, os resume points não indicarem trabalho e a evidência estiver aprovada. Antes da execução, `manifest=ready`; depois dela, espelhe o header terminal como `done`. Aprovação local não atualiza `Integration`, `Outcome Guardian`, `Status` nem `Iterations used` do épico.
11. Enquanto qualquer linha de `Sub-features` não estiver `done | done | pass | done`, continue pela próxima sub-feature liberada no DAG. Mantenha o Outcome Guardian raiz `pending` e não emita resposta final de fase.
12. Somente após passar os itens 1–2 do `Root Completion Gate`, faça merge dos worktrees quando aplicável, rode o aceite end-to-end do objetivo inteiro diretamente com `bash`/`read` da sessão raiz e persista toda prova e todo ajuste de linha/resume em `loop.md`. Não lance child para executar ou aprovar o E2E. Se ele passar, não faça outra chamada `subagent` até o `artifact-guardian`; se falhar, invalide o checkpoint e siga imediatamente ao passo 14.
13. Após passar também o item 3, faça o `Pre-Guardian Checkpoint`; só então dispare o `artifact-guardian` raiz com `model: "inherit"`, `context: "fresh"`, `cwd: "{canonical-project-root}"`, o objetivo literal do `loop.md`, todas as sub-features e a evidência de `Integration > E2E` desta iteração.
14. **Gap → itera:** se a integração ou o outcome raiz falhar, diagnostique a menor causa e, antes de incrementar ou reabrir qualquer estado, aplique os guards de `Ceiling` e `Anti-thrash`. Se nenhum guard parar o loop, registre exatamente uma iteração raiz e aplique integralmente `Root Correction Reopen` antes de rotear para `manifest`, `execute` ou decomposição. O manager raiz não corrige produto; toda mutação de produto continua obrigatoriamente no `worker` de `execute`.
15. Repita até uma `Stop Condition`. Atualize `loop.md` antes de ceder o turno.
16. Ao final, responda conforme `Final Response`.

### Resume Dispatch

| Estado persistido | Próxima ação |
|---|---|
| Clarificação material aberta | `blocked`; perguntar ao usuário |
| Sub-feature não terminal + manifest ausente, inválido ou não `ready` | carregar `manifest/SKILL.md` e continuar inline |
| Manifest válido + execute `pending|running|fail` elegível a retry | carregar `execute/SKILL.md` e continuar inline |
| Execute `done` + verify pendente | validar somente a sub-feature e atualizar sua linha |
| Sub-feature `done`, mas existe outra incompleta | não reabrir a concluída; continuar a próxima liberada e manter outcome raiz `pending` |
| Todas as sub-features `done|done|pass|done` | rodar integração end-to-end raiz |
| Integração raiz válida + outcome `pending` | rodar o guardian raiz |
| Outcome raiz rejeitado | registrar gap e abrir uma iteração raiz |
| Outcome raiz aprovado para a evidência atual | `converged` |

### Root Completion Gate — fail-closed

Avalie o gate cumulativamente: itens 1–2 antes da integração raiz, 1–3 antes do Outcome Guardian e todos os itens antes de gravar `converged`:

1. Todas as linhas de `Sub-features` têm `manifest=done`, `execute=done`, `Verify=pass` e `Status=done`, espelhando os primeiros `Status:` de cada `manifest.md` e `plan.md` e `manifest.md > State > Plan`; não há task/fase ou resume point incompleto.
2. Não existe blocker aberto no épico ou nas sub-features.
3. `Integration > E2E` contém prova concreta e atual do objetivo inteiro nos paths definidos a partir do project root; não aceite prova isolada de fase nem reinterprete paths a partir do feature dir.
4. O Outcome Guardian está `approved` para `Artifact: {epic-dir}/loop.md` resolvendo exatamente para o loop raiz selecionado, a `Iteration` atual e a mesma `Evidence` de `Integration > E2E`.

Qualquer campo ausente, divergente ou ambíguo falha o gate. Rebaixe Outcome Guardian incompatível para `pending`; se `Status: converged` estiver otimista, rebaixe-o para `running` e continue pelo `Resume Dispatch`. Nunca trate `approved` de spec, UX, Arch, plan, task, fase, `workflow-validator` ou sub-feature como aprovação do épico.

### Root Correction Reopen

Após falha raiz, antes de qualquer incremento ou mutação de reabertura, avalie `Ceiling` e `Anti-thrash` com o budget e o ledger persistidos. Se um guard disparar, grave a stop condition e não incremente nem reabra trabalho. Caso contrário, rebaixe Outcome Guardian para `pending`, incremente `Iterations used` uma vez e grave uma entrada concreta no ledger. Se a correção couber numa task já planejada, reabra **somente** a sub-feature responsável antes de chamar `execute`:

- `plan.md`: primeiro `Status: ready`; task/fase afetada `pending`; `Evidence: pending`; resume aponta a task; preserve o guardian/readiness do plano `approved`, pois a task existente não muda o plano;
- `manifest.md`: primeiro `Status: ready`; `State > Plan: ready` — nunca `pending`; resume aponta `execute` da task; preserve todos os demais estados e guardians;
- linha do loop: `manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`.

Essa transição inteira deve estar persistida e relida **antes de qualquer correção**; campo divergente impede o worker. Preserve campos não citados e não reescreva o documento inteiro para reabrir status. Depois siga esta ordem sem atalhos:

1. faça o preflight `list`/`get` exigido para `worker` e `workflow-validator`;
2. aplique `execute`: checkpoint `running` → um worker → inspeção do write set/evidência;
3. o próximo child após esse worker é obrigatoriamente um único `workflow-validator`, nunca `artifact-guardian`; sem aprovação positiva, a task não fecha;
4. só então retorne task/fase, plan/manifest/`State.Plan`, resumes e linha do loop ao estado terminal;
5. repita o E2E raiz, o checkpoint limpo e um único `artifact-guardian`.

É proibido saltar de outcome/E2E rejeitado para E2E `pass`, guardian raiz ou `converged`. As demais sub-features permanecem terminais. Se a correção mudar requisito, contrato, solução ou tasks do plano, não preserve approvals: invalide os artefatos downstream e roteie ao `manifest`/replan.

### Pre-Guardian Checkpoint

Primeiro persista `Integration > E2E`, linhas e resume point. Depois, em uma nova rodada de ferramentas, releia apenas `loop.md`, cada `manifest.md`/`plan.md` completo e as evidências referenciadas por `Integration > E2E`; confirme os itens 1–3 do gate. Qualquer `write`, `edit`, `bash` ou child após essas leituras invalida o checkpoint: faça a mutação e repita toda a rodada de leitura. O guardian deve ser a chamada imediatamente seguinte ao último `read` de um checkpoint limpo.

## Decomposition

Decida com critério, não por conveniência:

| Sinal | Decisão |
|---|---|
| Superfície coesa, pequeno/médio, sem incrementos independentes | 1 feature (manifest único) |
| Abrange superfícies independentes, grande, ou incrementos que entregam/validam sozinhos | N sub-features |
| Sub-feature B precisa do contrato de A, ou compartilha write set | sequencial |
| Write sets disjuntos + validação independente | paralelo → 1 worktree por feature |

Mesma regra de write-set disjunto do `plan` (paralelismo de tasks), elevada para o nível de feature. Não paralelize features que compartilham arquivo, migração, contrato ou sequência de validação.

## Stop Conditions

Pare quando (ordem de preferência):

- **Converged**: `Root Completion Gate` integralmente satisfeito e objetivo inteiro aprovado pelo Outcome Guardian raiz.
- **Blocked**: decisão de produto ou dependência externa trava progresso seguro; registre o blocker exato e pergunte ao usuário.
- **Ceiling**: após nova falha raiz, antes de abrir outra correção, `Iterations used` ≥ `Iteration budget` (default 5), ou 3 iterações seguidas não produziram evidência nova; pare e reporte estado, gap restante e próxima ação. Grave `Status: ceiling` no `loop.md`.

Nunca itere em silêncio nem declare `converged` sem evidência. Cada iteração deve mudar algo mensurável em artefato ou evidência verificável.

### Anti-thrash

- Mesmo par `gap` + `causa` repetido **2×** no Convergence Ledger → `Status: blocked` (não reexecute à cega).
- Oscilação detectada (ex.: `impl`→`integração`→`impl` no mesmo gap) → `blocked` na 2ª volta.
- Iteração só conta como progresso se o ledger registrar evidência nova (path, comando, commit, teste) distinta da iteração anterior.

### Contagem de iterações

- `Iterations used` pertence somente ao loop raiz e começa em `0`.
- Não incremente no passe inicial nem por manifest, artefato, guardian local, sub-feature, batch, worker, validator, task ou fase de um plan.
- Após falha de `Integration > E2E` ou qualquer rejeição do Outcome Guardian raiz, inclusive por metadata/status prematuro, cheque o ceiling; se houver orçamento, incremente exatamente uma vez antes de corrigir ou repetir o guardian.
- Cada incremento exige uma única entrada numerada no Convergence Ledger com `gap` e `causa` concretos. Linhas `gap: none` não representam iteração e não devem existir.
- Se o passe inicial convergir, preserve `Iterations used: 0` e `Convergence Ledger: - none`; não crie uma entrada `0`, resumo de sucesso ou `gap: none`.
- Na retomada, reconcilie `Iterations used` com essas entradas raiz antes de agir; contagem derivada de tasks/fases deve ser corrigida, não preservada.

## Worktrees & Merge

- Para features paralelas com write sets disjuntos, execute cada uma em um worktree isolado.
- Não deixe workers de features diferentes escreverem no mesmo working tree.
- Após um batch paralelo, faça merge dos worktrees na ordem do DAG, resolva conflito como blocker (não sobrescreva mudança paralela) e só então rode a integração E2E.
- Se a integração falhar, registre gap e roteie a correção para a feature/camada certa; não conserte inline.

## `loop.md` Template

```markdown
# {Objetivo} — Loop

Status: running | converged | blocked | ceiling
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}
Iteration budget: 5
Iterations used: {0}

## Objective

- Resultado esperado: {o que precisa ser verdade no fim}
- Evidência de aceite: {prova observável no nível do resultado}

## Strategy

- Decomposição: single | decomposed(N)
- Execução: sequential | parallel
- Racional: {por que essa estratégia}

## Sub-features

| Feature | Dir | Batch | Depends on | Write set | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|---|---|
| {nome} | ./{dir} | {B#} | {features ou none} | {paths} | {branch/path ou none} | missing/running/ready/done/blocked | pending/running/done/fail | pending/pass/fail | pending/running/done/blocked |

## Convergence Ledger

- none (enquanto `Iterations used: 0`)
- {iter >= 1} | gap: {descrição concreta} | causa: {spec/ux/arch/plan/impl/integração} | ação: {replan/reexec/redecompose} | evidência: {ref} | resultado: {running/pass/fail/blocker}

## Integration

- Merge: {status/ordem}
- E2E: {evidência cross-feature ou pending}

## Outcome Guardian

Status: pending | approved | rejected
Artifact: {epic-dir}/loop.md
Iteration: {Iterations used}
Evidence: {mesma referência de Integration > E2E}
- {achado/pergunta/crítica que bloqueia o objetivo, ou none}

## Resume Point

- Última sub-feature concluída: {none}
- Próxima ação: {ação}
- Blockers: {none}
```

## Outcome Guardian

Somente após passar os itens 1–3 do `Root Completion Gate` e concluir um `Pre-Guardian Checkpoint` limpo em uma rodada anterior, rode `artifact-guardian` pela ferramenta `subagent` com `model: "inherit"`, `context: "fresh"`, `cwd: "{canonical-project-root}"` e contexto mínimo: objetivo literal do épico, `AGENTS.md`, `loop.md`, manifests/plans de todas as sub-features e a evidência raiz produzida.

Use estes campos literalmente; nenhum pode ser omitido:

```text
subagent({ agent: "artifact-guardian", model: "inherit", context: "fresh", cwd: "{canonical-project-root}", task: "..." })
```

O guardian não edita arquivos nem valida task, fase ou sub-feature isolada (isso é do `execute`). Ele valida o **objetivo end-to-end**: o resultado combinado de todas as sub-features entrega o objetivo, a integração/aceite funciona e há evidência prática — sem achismo. Qualquer linha incompleta ou `Integration > E2E: pending` força `rejected`, inclusive em feature única.

Somente o `DELEGATION_RESULT` desta chamada, com `artifact` resolvendo para o `loop.md` raiz selecionado e evidência ligada ao `Integration > E2E` atual, pode atualizar o Outcome Guardian raiz. Em `evidence`, ligue cada critério do objetivo a `pass|fail` e à prova conferida; use `questions`, `blockers` e `resume` para decisão, gap e menor correção. Origem ou escopo não comprovável mantém `pending`; `status: rejected` abre uma iteração raiz.

## Rules

- O objetivo do loop é resultado atingido com evidência, não docs escritos nem código que "parece certo".
- Invocar `/skill:loop` autoriza autoria, execução, validação e iteração até uma `Stop Condition`; não peça uma segunda autorização entre manifest e execute.
- Delegue autoria a `manifest` e execução a `execute`; não escreva `spec`/`ux`/`arch`/`plan` direto nem implemente produto.
- Toda sub-feature passa por `manifest` (autoria + guardians) antes de `execute`.
- Execute batches paralelos como batches: spawn primeiro, wait depois; um worktree por feature paralela; merge só depois.
- Não paralelize features com arquivo, migração, contrato ou validação compartilhados.
- Cada iteração corrige o menor ponto que fecha o gap; não replaneje tudo por hábito.
- Antes de replan, reexecução ou merge, rebaixe o Outcome Guardian para `pending`; aprovação anterior não sobrevive a mutação/evidência nova.
- Nunca declare `converged` com `Integration > E2E: pending`; para feature única, registre a evidência de aceite end-to-end ali.
- Pare em blocker duro (decisão de produto/dependência externa) e pergunte; não invente resposta.
- Respeite `Iteration budget`; conte somente correções abertas por falha raiz conforme `Contagem de iterações`.
- Ao retomar por diretório ou `loop.md`, use o mesmo épico, comece pelo resume point e revalide o estado antes de agir.
- O que sobrevive ao objetivo vai pro projeto (`AGENTS.md`, skills project-local, `docs/adr`); o que morre com a feature fica em `.features/{...}/`.

## Checkpoint (obrigatório)

Antes de **cada** delegação a `manifest`/`execute`, merge ou de ceder o turno, grave no `loop.md`: `Updated:`, `Iterations used`, resume point, última linha do Convergence Ledger e Outcome Guardian. Não delegue com `loop.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `loop.md` (e docs de feature) antes de seguir para o próximo passo (write-before-forget).
- O contexto de trabalho guarda só: épico dir, sub-feature/iteração atual, blockers abertos, próxima ação. O resto é ponteiro (path + resume point) e se re-lê sob demanda.
- Antes de ceder o turno ou compactar: garanta resume point e evidência reais no arquivo; colapse o convergence ledger para os últimos 10 + rollup por sub-feature; descarte transcripts de `manifest`/`execute` (guarde só {docs, evidência, gap}).
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence e re-lê.

## Context Isolation

- Passar a cada delegação (`manifest`/`execute`/guardian) só objetivo/sub-feature, paths, feature dir, worktree e docs necessários.
- Nunca usar histórico completo da sessão como contexto da delegação.
- Se `subagent` estiver indisponível, siga `../../references/PI_ADAPTATION.md`: grave blocker e não simule autoria, guardian ou execução inline.

## Final Response

Ao concluir, responda com:

- `Objetivo`: o objetivo verificável e o status (`converged` | `blocked` | `ceiling`).
- `Estratégia`: decomposição, batches paralelos/sequenciais e worktrees usados.
- `Executado`: sub-features concluídas, iterações de replan/reexec e merge/integração.
- `Evidência`: prova de resultado end-to-end aprovada pelo outcome guardian.
- `Pendências`: blockers, decisões abertas ou `none`.
- `Resume`: épico dir, resume point e próxima ação.
