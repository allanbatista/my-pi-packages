# Review: performance-analysis-workflow.md

**Revisor**: deepseek-pro-v4 review subagent
**Alvo**: `docs/performance-analysis-workflow.md`
**Data**: 2026-07-06

---

## Status

Análise estruturalmente sólida mas com riscos subestimados e omissões relevantes. As 4 causas raiz são majoritariamente corretas; as 4 recomendações têm mérito mas precisam de mitigação adicional. Recomendação #1 (remover guardians) é a mais arriscada e não deve ser aplicada sem gate adicional.

---

## Achados

### Q1: As 4 causas raiz estão corretas?

| Causa | Verdicto | Evidência |
|---|---|---|
| **#1 Guardians inflam turn count** | ✅ Correta | Cada skill (spec/ux/arch/plan) tem passo explícito "Rode guardian independente" no workflow (ex: batista-spec/SKILL.md:147, batista-plan/SKILL.md:181). Manifest exige `approved` como gate: "Não marque ready sem guardian aprovado" (batista-manifest/SKILL.md:213). Cada guardian consome 1-2 turns de context reload + rubrica. |
| **#2 Tripla Discovery** | ⚠️ Parcialmente correta | Spec, ux e arch têm Discovery Ledgers com escopos diferentes (spec: contratos/APIs/schemas, ux: telas/fluxos/estados, arch: componentes/dados/integrações). A sobreposição real está nos arquivos-base (AGENTS.md, spec.md, estrutura do repo) — não necessariamente "os mesmos arquivos 3 vezes." O documento superestima a redundância ao não distinguir entre leitura base e discovery especializado. |
| **#3 Boilerplate duplicado** | ✅ Correta | Confirmado em todos os 7 SKILL.md: seções `Pi Runtime`, `Delegação`, `Context Isolation`, `State & Memory` são idênticas ou quase idênticas. ~200 linhas de duplicação entre 1402 totais (14%). Manutenção requer edição em 7 arquivos. |
| **#4 Guardians vs self-check redundante** | ⚠️ Subestima o papel generativo do guardian | A redundância de rubrica é real (Readiness Gates ≈ Guardian Rubric nos itens mecânicos). Porém o guardian tem função generativa que o documento não captura: o campo `Questions` e `Critiques` permite ao guardian levantar problemas que o autor não viu. O self-check é mecânico (checklist de itens conhecidos); o guardian é um juiz independente que pode fazer perguntas novas (ex: spec guardian pergunta "Taxonomia coberta: não há pergunta material não feita" — isso não está nos Readiness Gates da spec). |

### Q2: Recomendação #1 (self-check substitui guardian): seguro?

**Verdicto: ⚠️ Alto risco. Não seguro como proposto.**

A análise propõe remover guardians de artefato (spec, ux, arch, plan) e confiar em self-check + manifest reconciliation + outcome guardian.

**Problemas encontrados:**

1. **Context blindness do autor**: O skill que escreve não tem distância crítica para validar o próprio artefato. O guardian existe justamente para ser um par independente.

2. **Manifest não substitui guardian**: O manifest reconcilia consistência *entre* artefatos (Solution Gate: spec↔ux↔arch↔plan), não a qualidade *interna* de cada artefato. Evidência: batista-manifest/SKILL.md passo 8 diz "confirme aprovação do guardian da spec; se faltar, dispare guardian" — o manifest delega a validação ao guardian, não a faz.

3. **Outcome guardian é shift-right**: O outcome guardian do loop valida se o *resultado* entrega o *objetivo* (batista-loop/SKILL.md:247). Não valida se o spec tem requisitos EARS, se cada fato tem D#, se contratos estão fechados. Erro de spec detectado pós-execução custa replan + reimplement — muito mais caro que pré-execução.

4. **Cascata de retrabalho**: Fluxo proposto: spec self-check → ready → ux/arch → plan → execute → outcome guardian rejeita → reroute para spec → refazer spec → refazer ux/arch/plan → reexecutar. Na prática, um erro de spec que o guardian pegaria em 1-2 turns pode virar 6-10 turns de retrabalho.

5. **Risco composto com #4**: Se #1 e #4 forem ambos aplicados, NENHUM artefato de autoria tem validação independente. Só o outcome guardian (1 ponto de falha no final do pipeline).

**Mitigação necessária**: Manter guardian para spec (artefato âncora). Remover guardians de ux/arch/plan é aceitável porque o plan reconcilia as duas soluções e o spec já foi validado. Alternativa: implementar guardian "leve" (rubrica reduzida, sem Questions/Critiques) em vez de remoção total.

### Q3: Recomendação #2 (discovery único): spec como discovery principal funciona?

**Verdicto: ✅ Funciona com ressalvas.**

O spec já faz o discovery mais amplo (contratos, APIs, schemas, rotas, handlers, consumers, jobs, configs, testes, dependências, telemetria, owners). Passar D# para ux/arch via manifest é viável — o pipeline já tem manifest passando spec como "contrato âncora."

**Ressalvas:**

1. **D# não cobre descobertas UX/arch específicas**: O spec Discovery Ledger pergunta "o que existe e qual o escopo?" — não pergunta "quais são os estados de tela?" (ux) ou "qual o modelo de dados e interações?" (arch). O spec pode listar uma rota (D#) sem descrever o fluxo de uso que o UX precisa traçar.

2. **Critério de "complementary" é vago**: O documento diz "ux e arch apenas complementam com descobertas específicas de UI/backend quando o ledger da spec for insuficiente." Sem critério claro, ux/arch podem pular discovery necessário. Precisa de um gate: "Se discovery complementar revelar lacuna que afeta decisão de design, sinalizar e fazer trace completo."

3. **Risco de cascata de gap**: Se spec errar no discovery (ex: não notar um contrato existente), ux e arch herdam o erro e tomam decisões baseadas em premissa falsa. Mitigação parcial: ux/arch já fazem discovery complementar, mas precisam de autoridade para escalar ("spec discovery insuficiente para decisão de UX/arch → Open Questions + Status: blocked").

### Q4: Recomendação #4 (fast-track): features pontuais sem guardian são seguras?

**Verdicto: ⚠️ Parcialmente. Gate precisa ser mais estreito.**

O Solution Gate atual do manifest já pula ux/arch quando `pontual/localizada` + `somente fluxo afetado` + subconjunto mínimo. A novidade é pular TAMBÉM guardians de spec/plan.

**Problemas:**

1. **"Pontual" ≠ "inofensiva"**: Alteração localizada em handler de pagamento ou auth middleware é "pontual" (1 arquivo) mas de altíssimo risco. A classificação de intenção mede escopo, não risco.

2. **Spec errada em feature pontual causa retrabalho igual**: Se o spec de uma feature pontual está errado (contrato mal definido, edge case não coberto), o outcome guardian detecta após execução. O custo de correção é o mesmo de qualquer feature: replan + reimplement.

3. **Sem spec guardian, ninguém verifica consistência interna**: O manifest não valida spec (delega ao guardian). O outcome guardian valida resultado contra objetivo, não spec contra melhores práticas. Uma spec com requisitos fracos (ex: "O sistema deve tratar cupom inválido corretamente" em vez de EARS) passa batido.

**Gate proposto como correção**: Fast-track (sem spec/plan guardian) só quando TODOS forem verdadeiros:
- `Intent Classification = pontual/localizada`
- `Coverage expectation = somente fluxo afetado`
- `Changed contracts = none` (spec.md Contract and Persistence)
- Nenhuma `Validation surface` nova é introduzida
- `Shared Contract = none`

Isso filtra features pontuais de alto risco (contrato, persistência, superfície nova).

### Q5: Trade-offs: riscos subestimados?

**Verdicto: ✅ Todos os 4 riscos estão subestimados.**

| Decisão | Risco reportado | Risco real | Gravidade da subestimação |
|---|---|---|---|
| Remover guardians de artefato | "Artefato menos revisado; mitigado pelo outcome guardian" | Retrabalho em cascata quando erro de spec é detectado pós-execução. Outcome guardian valida resultado, não qualidade do spec. Custo de correção pós-execução >> custo de guardian preventivo. | Alta |
| Discovery único | "ux/arch podem herdar gap do spec; mitigado por discovery complementar" | Sem critério de escalação, ux/arch operam com descobertas insuficientes. Gap em spec propaga silenciosamente para ux/arch/plan. | Média |
| Boilerplate compartilhado | "Arquivo extra; risco baixo" | Risco real é baixo mesmo. Subestimação insignificante. | Nenhuma |
| Fast-track sem guardians | "Menos rigor em features pequenas; mitigado pelo outcome guardian" | "Pontual" não mede risco. Feature pontual em handler crítico sem guardian = exposição a erro de especificação não detectado. Outcome guardian mitiga resultado, não qualidade do spec. | Alta |

**Risco composto não analisado**: Se #1 + #4 forem implementados juntos, TODAS as features (fullstack e pontuais) perdem guardians de spec/ux/arch/plan. O único ponto de validação independente no pipeline inteiro é o outcome guardian do loop. Isso é um single point of validation failure — se o outcome guardian falhar em detectar um problema, ele se propaga para produção.

O documento trata cada recomendação como independente, mas os riscos são aditivos quando #1 e #4 coexistem.

### Q6: Omissões: causas não identificadas?

**Causas raiz ausentes:**

1. **Context reload amplificado pelo modo inline**: No Pi, cada `/skill:` invocação inline recarrega AGENTS.md, spec.md e docs comuns. Isso não é só discovery (#2) — é overhead de setup por skill. Com 5-7 skills na pipeline, são 5-7 reloads de arquivos-base. O documento não quantifica esse custo.

2. **Pipeline sequencial como bottleneck**: Mesmo com ux ∥ arch em paralelo, a estrutura spec → (ux ∥ arch) → plan é serial no spec. Se spec toma 4 turns, tudo para. O documento não analisa se spec é o bottleneck principal, nem propõe otimizações específicas para ele (ex: spec incremental para revisões vs spec completo para features novas).

3. **Guardian re-run amplification**: Quando guardian rejeita com 1 item `fail`, a skill corrige e re-roda o guardian do zero (reload context, reapply rubrica completa). Um ciclo de fix + revalidate pode ser 2-3 turns extras. O documento conta "1-2 turns por guardian" sem considerar rejeições.

4. **Clarification round-trip overhead**: Modo orchestrated: spec → blocked → manifest relé ao usuário → usuário responde → manifest re-invoca spec → spec processa respostas → revalida. Cada round-trip de clarificação adiciona 2-4 turns. O documento não quantifica isso como causa de lentidão.

5. **Falta de quantificação por skill**: O documento dá métricas agregadas (1402 linhas, 7 skills) sem breakdown por skill. Qual skill contribui mais para a lentidão? Spec (linhas: ~331)? Plan? Sem dados por skill, as otimizações são distribuídas uniformemente quando o gargalo pode ser concentrado.

6. **Falta de medição empírica**: "8-16 turns" é estimativa, não medição. Sem dados reais de features executadas (turns por fase, tempo por turno, taxa de rejeição de guardian), a análise é teórica e pode otimizar o problema errado.

---

## Riscos

| Risco | Severidade | Descrição |
|---|---|---|
| Single point of validation failure | 🔴 Alta | Se #1 + #4 implementados juntos, outcome guardian é o único validador independente. |
| Retrabalho em cascata | 🔴 Alta | Erro de spec detectado pós-execução custa 3-5x mais que detectado por guardian. |
| Classificação "pontual" como proxy de baixo risco | 🟡 Média | Feature pontual em código crítico é de alto risco independente do escopo. |
| Degradação silenciosa da qualidade do spec | 🟡 Média | Sem guardian, specs fracos (não-EARS, sem D#, contratos ambíguos) passam batido. |
| Discovery gap em ux/arch | 🟡 Média | Sem critério de escalação, ux/arch podem decidir com dados insuficientes. |
| Otimização prematura sem dados | 🟢 Baixa | Análise baseada em estimativas, não em medições reais de features executadas. |

---

## Sugestões

### S1: Manter guardian para spec (âncora)

Remover guardians de ux, arch e plan, mas **manter guardian para spec**. O spec é o artefato âncora do pipeline inteiro — erro aqui propaga para todas as fases seguintes. ux/arch são validados pelo plan (reconciliação). Plan não precisa de guardian se spec foi validado.

### S2: Fast-track com gate de risco, não só de escopo

Adicionar ao fast-track:
- `Changed contracts = none`
- Nenhuma `Validation surface` nova
- `Shared Contract = none`

Isso mantém fast-track para features triviais e exige guardian para features pontuais de alto risco.

### S3: Critério de escalação para discovery complementar

Adicionar ao batista-ux/SKILL.md e batista-arch/SKILL.md: "Se o Discovery Ledger da spec não contiver informação suficiente para uma decisão de design, registre `Open Questions` com `Q#`, faça discovery completo na dimensão afetada e continue."

### S4: Medir antes de otimizar

Antes de implementar qualquer recomendação, coletar dados reais de 3-5 features:
- Turns por fase
- Tempo por turno
- Taxa de rejeição de guardian (quantos guardians rejeitam e por quê)
- Maior contribuidor de latência (spec? guardians? clarification rounds?)

Sem dados, as otimizações podem mirar o alvo errado.

### S5: Especificar "complementary discovery" com extensão

No batista-ux/SKILL.md e batista-arch/SKILL.md, substituir "Discovery só complementar" por:
- "Parta do Discovery Ledger da spec (D# recebidos via manifest). Confirme aplicabilidade ao escopo de UX/arch."
- "Faça discovery adicional APENAS nas dimensões específicas de UX/arch não cobertas pelo spec."
- "Se o discovery complementar revelar lacuna no spec que afeta decisão de design, escale com Open Questions."

---

## Ordem revisada de implementação

Se as recomendações forem implementadas, a ordem sugerida (da menor para maior risco) é:

1. **#3 Boilerplate compartilhado** — risco baixo, ganho de manutenção imediato, sem impacto funcional.
2. **#2 Discovery único** — com critério de escalação (S3 + S5), risco médio-baixo.
3. **Coleta de dados** (S4) — antes de decidir sobre guardians.
4. **#4 Fast-track com gate de risco** (S2) — risco médio, ganho modesto.
5. **#1 Remover guardians** — aplicar só para ux/arch/plan, manter spec guardian (S1). Risco médio, maior ganho.

**Não recomendo remover spec guardian em nenhum cenário sem dados empíricos que provem que o outcome guardian cobre adequadamente os mesmos gaps.**

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Review cobre exatamente os 6 pontos solicitados (4 causas raiz, 4 recomendações, trade-offs, omissões). Nenhum escopo adicional foi introduzido. Nenhum arquivo de código/produto foi modificado — apenas o review de saída foi escrito."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "cat docs/performance-analysis-workflow.md | head -n 150",
      "result": "passed",
      "summary": "Lido o documento alvo completo para análise"
    },
    {
      "command": "read skills/{spec,manifest,loop,ux,arch,plan,execute}/SKILL.md",
      "result": "passed",
      "summary": "Lidos todos os 7 SKILL.md para validação cruzada das afirmações da análise"
    },
    {
      "command": "read references/PI_ADAPTATION.md, .memory/RULES_AND_DEFINITION.md",
      "result": "passed",
      "summary": "Contexto adicional de runtime e regras duráveis verificado"
    }
  ],
  "validationOutput": [
    "Todas as 4 causas raiz verificadas contra código-fonte real dos SKILL.md",
    "Causa #2 superestima sobreposição de discovery (D# vs U# vs A# têm escopos diferentes)",
    "Causa #4 subestima papel generativo do guardian (Questions/Critiques além da rubrica)",
    "Recomendação #1: alto risco, NÃO seguro como proposto — manter guardian para spec",
    "Recomendação #2: funciona com critério de escalação explícito para ux/arch",
    "Recomendação #4: parcialmente seguro — gate precisa incluir risco (contrato/persistência/superfície nova)",
    "Risco composto #1+#4 não analisado no documento original",
    "6 causas raiz ausentes identificadas (context reload, bottleneck sequencial, guardian re-run, clarification round-trip, falta de breakdown por skill, falta de medição empírica)"
  ],
  "residualRisks": [
    "Análise é baseada em revisão estática de SKILL.md, sem execução real de features para medição de latência",
    "Impacto real de remover guardians depende de taxa de rejeição histórica (não disponível)"
  ],
  "noStagedFiles": true,
  "diffSummary": "Nenhum diff de código. Apenas arquivo de review gerado em .pi-subagents/artifacts/outputs/215e4b3f/docs/review-deepseek-pro-v4.md",
  "reviewFindings": [
    "Alto risco: Recomendação #1 remove 4 guardians sem substituição adequada — outcome guardian não cobre validação interna de spec",
    "Médio risco: Recomendação #4 classifica 'pontual' como baixo risco, mas escopo ≠ risco",
    "Médio risco: Recomendação #2 não define critério de escalação para discovery complementar",
    "Omissão: Risco composto #1+#4 (single point of validation failure) não analisado",
    "Omissão: Falta de dados empíricos — estimativas sem medição real",
    "Sugestão: Manter guardian para spec (âncora), remover para ux/arch/plan",
    "Sugestão: Coletar dados de 3-5 features reais antes de decidir sobre guardians"
  ],
  "manualNotes": "Recomendo NÃO implementar #1 sem dados empíricos. Se houver urgência, implementar na ordem: #3 → #2 → coletar dados → #4 com gate de risco → #1 parcial (ux/arch/plan apenas)."
}
```