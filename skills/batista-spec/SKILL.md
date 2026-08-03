---
name: batista-spec
description: Cria, revisa e mantém apenas o `spec.md` de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/spec.md`. Use como `/skill:batista-spec` quando o usuário pedir spec, especificação, contrato de produto, Definition of Done, classificação da intenção do usuário, esclarecimento de requisitos, revisão de uma feature existente, ou quando uma feature precisar de perguntas antes do plano técnico.
---

# Feature Spec


## Runtime & Delegação

Leia e siga `../../references/WORKFLOW_COMMON.md` para runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints.


Use esta skill para fechar o contrato de produto antes de qualquer plano técnico.

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta para fatos e registre como `pending` qualquer afirmação que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Quando invocada por outra skill do feature-workflow, execute como child `delegate` com `context: "fresh"` (ver `../../references/PI_ADAPTATION.md`), recebendo apenas pedido, project root, feature dir e docs necessários.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Determine o modo de execução: **standalone** (o usuário invocou a skill direto e pode responder perguntas) ou **orchestrated** (invocada por outra skill do feature-workflow com contexto isolado, sem poder perguntar ao usuário no meio da execução). Ver `Clarification Protocol`.
3. Identifique o project root. Em dúvida real: standalone pergunta; orchestrated registra em `Clarifications Needed`. Use uma pasta existente `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/` quando indicada; senão crie uma nova com data/hora local e `short-desc` em kebab-case ASCII.
4. Se o input for um diretório de feature ou arquivo (`manifest.md`, `spec.md` ou `plan.md`), trate a tarefa como revisão: leia os arquivos existentes da feature antes de decidir status (perguntas pendentes, decisões contraditórias, DoD fraco, contrato/persistência ausentes, divergência entre spec/plan/manifest e evidência faltante).
5. Faça `Phase 0: Discovery` como método, não como desejo: percorra as dimensões — contratos/APIs, schemas/persistência, rotas/handlers, consumers/jobs/filas, configs/flags, testes existentes, dependências externas, telemetria/logs e owners — e **trace pelo menos um fluxo atual ponta a ponta**. Registre cada achado no `Discovery Ledger` com `ID` (`D#`), fonte, evidência e impacto. Afirmação sem evidência vira `pending`. Use Graphify quando `graphify-out/graph.json` existir.
6. Reflita e registre a intenção real do usuário (pontual/localizada vs feature ponta a ponta) com justificativa baseada em achados do Discovery.
7. Levante as clarificações materiais pela taxonomia (ver `Clarification Protocol`), priorize por (Impacto × Incerteza) e leve no máximo 5 de alto impacto por rodada. Só uma dúvida que **não altera** escopo, aceite, contrato, persistência, UX, segurança, rollout ou validação pode virar suposição explícita.
8. Resolva as clarificações conforme o modo: standalone pergunta em lote e espera as respostas; orchestrated preenche `Clarifications Needed`, seta `Status: blocked` e devolve o controle ao manager.
9. Monte a rastreabilidade: cada requisito em forma **EARS** ligado a um `D#` do Discovery ou a uma decisão registrada; cada critério de aceite em **Dado/Quando/Então** com superfície de validação (ver `Gramática de Requisitos`).
10. Aplique o **Minimalism Gate** a cada requisito: (a) faz parte do que o usuário pediu? (b) é essencial para o projeto funcionar? Se a resposta a qualquer uma for não, mova para `Out of Scope` com uma linha de justificativa. (c) Está na menor complexidade que atinge o critério de aceite, ou dá para simplificar? Se dá, simplifique o requisito antes de seguir.
11. Feche explicitamente contrato, persistência, evidência obrigatória e fora de escopo antes de `Status: ready`.
12. Escreva ou atualize somente `spec.md`. Não escreva `plan.md`.
13. Aplique o **Fail-Closed Clarification Gate**. Em modo orchestrated, grave `draft` (ou `blocked`) e devolva sem rodar guardian; somente uma re-invocação com verdict real `approved` pode persistir o gate e promover para `ready`. Em standalone, delegue a rubrica ao `artifact-guardian`, aplique o menor ajuste e repita até `approved`.
14. Responda conforme `Final Response`; em modo orchestrated, retorne somente o `Delegation Result` de `../../references/WORKFLOW_COMMON.md`.

## Fail-Closed Clarification Gate

Antes de guardian ou `Status: ready`, procure decisões materiais com `A: a definir`, `pending` ou origem `suposição explícita`. Converta cada uma em `Clarifications Needed`, grave `Status: blocked` e devolva as perguntas. Não rode guardian e não continue para UX/Arch/Plan enquanto existir qualquer ocorrência.

## Gramática de Requisitos (EARS + Gherkin)

Escreva cada requisito em uma forma EARS (gatilho + sujeito + resposta = testável):

- Ubíquo (sempre ativo): `O sistema deve <resposta>.`
- Evento: `Quando <gatilho>, o sistema deve <resposta>.`
- Estado: `Enquanto <pré-condição>, o sistema deve <resposta>.`
- Opcional: `Onde <funcionalidade presente>, o sistema deve <resposta>.`
- Indesejado: `Se <gatilho>, então o sistema deve <resposta>.`
- Complexo: combine gatilho + estado na mesma sentença.

Escreva cada critério de aceite em Gherkin: `Dado <contexto>, Quando <ação>, Então <resultado observável>` (use `E` para passos extras). Prefira 1-3 critérios por requisito; 4+ sugere requisito grande demais (divida).

Calibração:

- Requisito fraco (vago, sem gatilho, não testável): "O sistema deve tratar cupom inválido corretamente."
- Requisito bom (EARS evento): "Quando o usuário aplica um cupom expirado no checkout, o sistema deve rejeitar o cupom e exibir 'Cupom expirado'."
- Aceite fraco: "Cupom inválido não funciona."
- Aceite bom (Gherkin): "Dado um carrinho com cupom expirado, Quando o usuário confirma o checkout, Então nenhum desconto é aplicado E a mensagem 'Cupom expirado' aparece."

## Template

```markdown
# {Feature}

Status: draft | ready | blocked
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Objective

{O que deve existir ou mudar do ponto de vista do usuário/sistema.}

## Context

{Por que isso é necessário, estado atual conhecido e restrições relevantes.}

## Discovery Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| D1 | {arquivo/comando/doc/resposta do usuário} | {fato confirmado ou lacuna} | {path, trecho curto, comando ou decisão} | {como muda escopo/contrato/validação} | confirmed/pending |

## Intent Classification

- User intent: {pontual/localizada | feature ponta a ponta | pending}
- Rationale: {por que essa classificação é correta}
- Coverage expectation: {somente fluxo afetado | contrato completo end-to-end | pending}

## Actors and Flows

- Actors/systems affected: {usuários, sistemas, jobs, consumers, APIs ou none}
- Current flow: {fluxo atual traçado ponta a ponta, referenciando D# do Discovery; `pending` só se a feature for greenfield comprovado}
- Target flow: {comportamento esperado}

## Scope

- {Incluído}

## Out of Scope

- {Excluído}

## Questions and Decisions

- [C1] Q: {pergunta}
  A: {resposta/decisão} — origem: {usuário | decisão registrada | suposição explícita}

## Requirements Traceability

| Need | Requirement (EARS) | Acceptance criterion (Dado/Quando/Então) | Validation surface | Basis | Status |
|---|---|---|---|---|---|
| {necessidade do usuário/sistema} | {requisito em forma EARS} | {critério em Dado/Quando/Então} | {frontend/backend/job/infra/browser/API/consumer} | {D# do Discovery ou decisão} | defined/pending |

## Contract and Persistence

- Changed contracts: {public/internal contracts or none}
- Persistence: {where state/config/data lives, or none}
- Validation surfaces: {frontend/backend/job/infra/browser/API/consumer}
- Ambiguities: {none | pending decision}

## Shared Contract

> Contrato mínimo compartilhado entre `batista-ux` e `batista-arch` antes do spawn paralelo. Use `none` quando só uma superfície roda ou fix pontual sem contrato novo.

- Status: closed | none | pending
- Payloads/campos: {campos, tipos, nullability, ou none}
- Estados e erros: {códigos HTTP/erros de domínio, mensagens expostas ao usuário, ou none}
- Sequência mínima: {quem chama quem, ordem, ou none}
- Basis: {D# ou decisão}

## Acceptance Criteria

- {Dado <contexto>, Quando <ação>, Então <resultado observável>}

## Clarifications Needed

> none = nada bloqueia `ready`. Máx. 5 itens de alto impacto, priorizados por (Impacto × Incerteza). Dúvida trivial não entra aqui: vira suposição explícita em `Questions and Decisions` ou `Out of Scope`.

- [C1] Categoria: {escopo funcional | modelo de dados | fluxo/UX | não-funcional | integração/dependências | edge cases/falhas | contrato | persistência | rollout | terminologia}
  Pergunta: {pergunta de alto impacto}
  Bloqueia: {escopo | contrato | persistência | aceite | rollout | validação}
  Opções: {A) ... | B) ... | resposta curta}
  Recomendado: {opção + 1 frase de justificativa}

## Spec Readiness Gates

- [ ] `AGENTS.md` e fontes citadas foram lidos.
- [ ] Cada requisito está em forma EARS e referencia um achado do Discovery (`D#`) ou decisão registrada.
- [ ] Cada critério de aceite está em Dado/Quando/Então com superfície de validação.
- [ ] Cada requisito passou no Minimalism Gate: é parte do pedido, essencial para o projeto funcionar e está na menor complexidade que atinge o aceite; o resto está em `Out of Scope`.
- [ ] `Clarifications Needed` = none, ou `Status: blocked`.
- [ ] O `plan.md` pode ser escrito sem decisão de produto pendente.
- [ ] `Shared Contract` = `closed` ou `none` antes de spawn paralelo `batista-ux`∥`batista-arch`.

## Definition of Done

- [ ] Resultado de produto completo.
- [ ] Discovery e rastreabilidade sustentam escopo e critérios de aceite.
- [ ] Contratos públicos/internos alterados estão listados.
- [ ] Validação prática com evidência real ou bloqueio exato registrado.
- [ ] Testes automáticos necessários estão separados entre foco da task e gate final de fase.
- [ ] Evidência real exigida para frontend/backend/job/infra está definida.
- [ ] Guardian aprovou a spec.
```

## Artifact Guardian

Após atualizar `spec.md`, o modo standalone roda `artifact-guardian`; no modo orchestrated, o manager é responsável pelo guardian após receber o artefato.

O guardian não edita arquivos. Ele valida se a spec fecha discovery, objetivo, escopo, fora de escopo, atores/usuários afetados, fluxos, requisitos rastreáveis, contratos, persistência, validação, DoD e perguntas pendentes sem achismo.

Rubrica obrigatória; registre cada resultado no campo `evidence` do `DELEGATION_RESULT` canônico:

- [pass/fail] Todo requisito está em forma EARS (Quando/Enquanto/Onde/Se-Então/ubíquo).
- [pass/fail] Todo critério de aceite está em Dado/Quando/Então com superfície de validação.
- [pass/fail] Todo fato usado na spec referencia um achado do Discovery (`D#`) com evidência.
- [pass/fail] `Intent Classification` é justificada por achados, não por achismo.
- [pass/fail] Todo requisito faz parte do que o usuário pediu e é essencial para o projeto funcionar; nada além do requisito mínimo entrou no escopo (o excedente está em `Out of Scope`).
- [pass/fail] Cada requisito está na menor complexidade que atinge o critério de aceite; nenhuma simplificação óbvia foi ignorada.
- [pass/fail] Taxonomia coberta: não há pergunta material não feita; `Clarifications Needed` consistente com o estado (none ⇒ nada de alto impacto em aberto).
- [pass/fail] Nenhuma decisão material foi fechada por suposição; toda resposta material referencia usuário, decisão registrada ou evidência `D#`.
- [pass/fail] Contrato, persistência, validação e fora de escopo fechados ou `none` justificado.
- [pass/fail] `Shared Contract` = `closed` ou `none` quando `batista-ux` e `batista-arch` rodarão em paralelo; campos/erros/sequência não podem ficar `pending`.

Qualquer item `fail` força `status: rejected`. Trate `evidence`, `questions`, `blockers` e `resume` como feedback da spec; corrija `spec.md` quando a resposta já estiver disponível, pergunte ao usuário (modo standalone) ou registre em `Clarifications Needed` (modo orchestrated) quando faltar decisão. Só use `Status: ready` com guardian `approved`.

## Rules

- Mantenha o conteúdo sem detalhes técnicos de implementação.
- Faça perguntas só depois de investigar o que o repo, docs e artefatos existentes conseguem responder.
- Pergunte tudo que molda materialmente escopo, aceite, contrato, persistência, UX, segurança, rollout ou validação, em lote e priorizado pela taxonomia (máx. 5 por rodada). Só registre suposição quando ela não alterar nenhuma dessas superfícies.
- Todo requisito em forma EARS; todo critério de aceite em Dado/Quando/Então. O guardian rejeita desvio de forma.
- Todo fato na spec referencia um `D#` do `Discovery Ledger` com evidência, ou uma decisão registrada; sem isso vira `pending`.
- Não marque requisitos, escopo, contratos, persistência ou validação como definidos sem evidência ou decisão registrada.
- Não use `Status: ready` sem `Discovery Ledger`, `Requirements Traceability` e `Spec Readiness Gates` preenchidos e `Clarifications Needed` = none.
- Defina pronto como comportamento validado na prática com evidência, não como revisão de código.
- Mesmo se o usuário disser "corrija", "implemente" ou "execute", esta skill deve criar/refinar `spec.md` e parar; não faça patch de produto.
- Comece pelo menor escopo fiel ao pedido. Não transforme correção localizada em feature ponta a ponta sem evidência ou decisão explícita.
- Qualquer requisito fora do mínimo para o projeto funcionar é descartado para `Out of Scope`, mesmo que pareça útil; só volta com pedido ou decisão explícita do usuário. Requisito que pode ser simplificado sem perder o aceite deve ser simplificado.
- Se a intenção real do usuário estiver ambígua entre ajuste pontual e feature end-to-end, registre `pending` em `Intent Classification` e pergunte antes de `Status: ready`.
- Use `Status: ready` só quando `plan.md` puder ser escrito sem decisões de produto pendentes e o guardian aprovar.
- Não use `Status: ready` se contrato, persistência, harness, usuário afetado ou fora de escopo estiver ambíguo.
- Quando uma ambiguidade bloquear execução segura, pergunte ao usuário (standalone) ou registre o item em `Clarifications Needed` e set `Status: blocked` (orchestrated).
- Ao receber arquivo ou diretório existente, trate a tarefa como revisão: corrija/refine o `spec.md` antes de concluir e não aceite status pronto herdado sem checagem.
- Se `plan.md` ou `manifest.md` revelarem lacuna de produto, puxe a lacuna para `spec.md` como pergunta/decisão pendente.
- Se existir `manifest.md`, atualize apenas links/status da spec quando isso for necessário para manter consistência.
- Não aceite guardian genérico; ele deve listar evidência conferida ou bloquear com pergunta/crítica objetiva.

## Clarification Protocol

Esclareça sem violar o isolamento. Detecte o modo no início (passo 2 do Workflow).

- Standalone (usuário invocou a skill direto): agrupe as clarificações materiais num único lote priorizado (máx. 5), apresente ao usuário, espere as respostas, registre em `Questions and Decisions` e continue. Repita em lotes se surgir nova dúvida de alto impacto.
- Orchestrated (invocada por `batista-manifest`/outra skill com contexto isolado): não pergunte no meio da execução. Preencha `Clarifications Needed` com IDs `C#`, grave o `spec.md`, set `Status: blocked` e devolva o controle ao manager com o bloco `Clarifications Needed` copiado na resposta final. Não invente respostas nem marque `ready`.

Taxonomia para varrer antes de perguntar (marque cada uma Clear/Partial/Missing; Partial/Missing que altera superfície material sempre vira pergunta): escopo funcional, modelo de dados, fluxo/UX, atributos não-funcionais, integração/dependências, edge cases/falhas, restrições/tradeoffs, contrato, persistência, rollout, terminologia, sinais de conclusão/DoD.

Retomada (orchestrated), ao ser re-invocada com respostas referenciadas por `C#`:

1. Leia `spec.md` (fonte da verdade) e as respostas recebidas.
2. Mova cada item resolvido de `Clarifications Needed` para `Questions and Decisions` com resposta e origem; propague o impacto para Scope, Requirements, Contract/Persistence e Acceptance.
3. Re-rode discovery apenas nas áreas afetadas pelas respostas.
4. Se surgir nova clarificação de alto impacto, reabra `Clarifications Needed` (respeitando o cap de 5) e devolva; senão siga para o guardian e `ready`.

## Checkpoint (obrigatório)

Antes de **cada** guardian ou de ceder o turno, grave no `spec.md`: `Updated:`, `Status`, resume point implícito (próxima clarificação ou guardian) e blockers. Não dispare guardian com `spec.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `spec.md` (Discovery Ledger, decisões, status) antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, requisito/clarificação atual, blockers abertos, próxima ação. O resto é ponteiro (path) e se re-lê sob demanda.
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status (pending→confirmed/ready). Em divergência, o arquivo vence e re-lê.
- As `Validation surfaces` desta spec são o sinal de gate para `batista-ux` (frontend) e `batista-arch` (backend/API/job/consumer/infra) na etapa de solução; mantenha-as explícitas. Mapeamento: `frontend`→`batista-ux`; `backend`/`API`/`job`/`consumer`/`infra`→`batista-arch`; `browser` sem mudança de UI→harness no `batista-plan`/`batista-execute`; `browser` com UI→também `batista-ux`.
- `Shared Contract` deve estar fechado antes do manifest spawnar `batista-ux`∥`batista-arch`; conflitos não resolvidos aqui viram `pending` e impedem `ready`.
- O que sobrevive à feature (convenção, terminologia de domínio) vai pro projeto (`AGENTS.md`); o efêmero fica em `.features/{...}/`.

## Context Isolation

- Quando houver manager, aceitar invocação orchestrated como child `delegate` com `context: "fresh"`.
- Não herdar contexto irrelevante da sessão manager.
- Passar somente artefatos mínimos: pedido, paths, `AGENTS.md` e documentos da feature.
- Em modo orchestrated, não rode guardian nem converse com o usuário; devolva o `Delegation Result` ao manager conforme `../../references/WORKFLOW_COMMON.md`.

## Final Response

Ao concluir, responda com:

- `Resumo`: intenção classificada, objetivo e escopo acordado.
- `Será feito`: resultados esperados do ponto de vista do usuário/sistema.
- `Clarifications Needed` (somente quando `Status: blocked` por clarificação): copie o bloco com IDs `C#`, categoria, pergunta, o que bloqueia e a opção recomendada.
- `Resume` (mesmo caso): feature dir + instrução de que a re-invocação deve passar as respostas referenciadas por `C#`.
- `Pendências`: perguntas, blockers ou `none`.
- `Evidência`: arquivos lidos/atualizados e fatos confirmados que sustentam a spec.

Em modo orchestrated, substitua a resposta humana pelo `DELEGATION_RESULT`; o manager raiz é responsável por apresentar perguntas ao usuário.
