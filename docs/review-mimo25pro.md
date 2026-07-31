# Review: performance-analysis-workflow.md

## Status: **APROVADO COM RESSALVAS**

---

## Achados

### 1. As 4 causas raiz estão corretas?

**Sim**, as 4 causas estão corretas e evidenciadas no código. Detalhe por evidência:

| Causa | Verificada | Evidência |
|---|---|---|
| Guardians inflam turn count | ✅ | spec, ux, arch e plan têm seção `Artifact Guardian` separada com rubrica que replica o conteúdo dos `Readiness Gates`. Cada guardian é um passo extra: recebe contexto mínimo, lê artefato, aplica checklist, gera resposta. |
| Tripla Discovery | ✅ | spec tem `Discovery Ledger` (D#), ux tem `Usability Ledger` (U#), arch tem `Architecture Ledger` (A#). Todos percorrem a mesma codebase com `Graphify`. |
| Boilerplate duplicado (~200 linhas) | ✅ | `Pi Runtime` (7×), `Delegação` (7×), `Context Isolation` (7×) têm texto quase idêntico. `State & Memory` (em skills que têm) também. 7 skills × ~25-30 linhas ≈ 200 linhas. |
| Guardians vs self-check redundante | ✅ | O `Spec Readiness Gates` cobre exatamente EARS, Dado/Quando/Então, D#, Clarifications e Shared Contract. A rubrica do guardian cobre as mesmas 6-7 validações. |

**Nota sobre tripla Discovery**: a análise afirma que a "base factual" é a mesma, mas os ledgers não são realmente sobre a mesma coisa. spec registra D# (fatos do produto e codebase), ux registra U# (fluxos de uso, estados, componentes existentes, baseline a11y), arch registra A# (componentes técnicos, schema, contratos). O overlap real é a **leitura inicial do codebase** — o scan é parecido, mas a análise diverge. A análise trata isso como inteiramente redundante; na prática, ux precisa ver rotas/telas/componentes e arch precisa ver schema/contratos/infra que a spec não registra em detalhe.

### 2. Recomendação #1 (self-check substitui guardian): seguro?

**Não completamente.** A análise subestima três riscos:

**Risco 1 — Viés de confirmação na skill**. A skill escreveu o artefato; ela vai preencher os `Readiness Gates` com a mesma leitura. O valor do guardian é ser um "segundo par de olhos" com contexto mínimo e sem viés de autoria. Quando a skill comete um erro sutil (ex.: requisito quase EARS mas não é, Shared Contract com campo "pendente" que a skill esqueceu), o self-check tende a passar.

**Risco 2 — O outcome guardian não substitui o preventivo**. A análise diz: "1 guardian corretivo no fim em vez de 4 preventivos no meio." Isso é verdade para features simples. Para features complexas (multi-batch, paralelas), o outcome guardian só encontra o gap no final — quando já se gastaram N turns de execução errada. O guardian preventivo custa 1-2 turns; o corretivo custa a iteração inteira.

**Risco 3 — Falta iteração budget no manifesto**. O loop tem iteration budget. O manifesto não tem. Se a spec erra e a ux/arch/plan herdam o erro, o manifesto vai iterar spec→ux/arch→plan até corrigir, sem limite definido.

### 3. Recomendação #2 (discovery único): spec como discovery principal funciona?

**Parcialmente.** A spec faz discovery do produto — o que existe, o que está documentado, o que falta. Isso alimenta bem ux e arch no nível dos requisitos. Mas:

- spec não registra **rotas/telas existentes** com detalhe que ux precisa (componentes reusáveis, estados, baseline a11y)
- spec não registra **schema/contratos/infra** com detalhe que arch precisa (migração, failure modes, non-functionals)

O Discovery único funciona para a **leitura inicial do codebase** — a parte do scan é redundante. Mas a análise descoberta precisa". Se a spec não registrou algo que ux/arch precisam, eles precisam re-ler a codebase. O ganho real não é "espec faz tudo"; é "ux/arch não repetem o scan da spec, só complementam".

### 4. Recomendação #4 (fast-track): features pontuais sem guardian são seguras?

**Seguras o suficiente.** O Solution Gate já existe no manifest:

```
| Fix pontual (intent + coverage ok, sem shared contract) | not-applicable | not-applicable → direto ao plan |
```

Se a spec pode ser `not-applicable` para ux/arch, e o plan já é autovalidado pelos seus Readiness Gates, pular guardian é consistente. Mas o **guardian da spec permanece necessário** — mesmo features pontuais precisam de requisitos EARS corretos e contrato fechado. O risco de pular o guardian do plan é menor (plan derivado de spec válida), mas o guardian da spec não deve ser pulado.

### 5. Trade-offs: riscos subestimados?

**Sim, dois riscos subestimados:**

1. **Guardians como pedagogia**. Os guardians foram desenhados para "segunda opinião", mas também servem como **gatilho de correção imediata** — a skill corrigir o artefato antes de avançar. Sem o guardian, a correção só acontece no outcome guardian ou numa iteração do manifesto, que é mais cara.

2. **Custo de contexto acumulado na skill sem guardian**. Quando uma skill faz self-check, ela acumula mais contexto (rubrica + checklist + resposta). Em LLMs, isso pode aumentar o custo de tokens tanto quanto o guardian separado faz, só que num único turn longo em vez de dois turns curtos. A análise assume que turns curtos são o gargalo; em modelos como DeepSeek flash, turns longos com mais contexto podem ser mais lentos que dois turns curtos.

---

## Riscos

| Risco | Severidade | Mitigação sugerida |
|---|---|---|
| Autovalidação da skill (viés de confirmação) | **Médio** | Manter guardian como passo opcional via flag `guardian: required|optional|skip` no manifest, com `required` como default para features fullstack |
| Outcome guardian como único checkpoint para features complexas | **Médio** | Manter guardian preventivo para spec e plan (maior impacto), pular para ux/arch quando intent é pontual/localizada |
| Discovery único herda gap do spec | **Baixo** | Documentar explicitamente que ux/arch fazem discovery complementar, não zero. Não remover as seções de discovery, apenas simplificar a parte de scan do codebase |
| Manifest sem iteration budget | **Baixo** | Definir `Manifest iteration budget: 3` (spec reinvocations) antes de `Status: blocked` |

---

## Sugestões

### S1 — Manter guardian opcional, não removê-lo
Em vez de remover guardians, tornar opcional por flag no manifest:
```
Guardian mode: required | skip
```
- `required` (default): guardians rodam como hoje
- `skip`: self-check assume (para fast-track, intent pontual, hotfix)

### S2 — Discovery não é duplicado, é complementar
Renomear recomendação #2 para: "Discovery único no spec como base, complementar em ux/arch". O scan inicial vai pro spec; ux e arch registram só U#/A# que a spec não cobriu. Isso preserva a utilidade dos ledgers sem o scan triplo.

### S3 — Adicionar iteration budget ao manifest
```
Manifest iteration budget: 3
Manifest iterations used: {0}
```
Se o manifesto precisar re-invocar spec 3+ vezes, force blocker em vez de loop.

### S4 — Boilerplate: WORKFLOW_COMMON.md é baixo risco, implementar primeiro
É a recomendação menos controversa. Muda zero comportamento, remove 200 linhas duplicadas. Não depende das outras recomendações. Comece aqui.

### S5 — Merge causas raiz 1 e 4
As causas "guardians inflam turn count" e "guardians vs self-check redundante" são a mesma causa. A redundância é o motivo de inflação. Unificar simplifica a narrativa.

---

## Ordem revisada de implementação

| Ordem | Recomendação | Risco | Ganho | Dependência |
|---|---|---|---|---|
| 1 | Boilerplate compartilhado (S4) | Baixo | -200 linhas, manutenção centralizada | Nenhuma |
| 2 | Guardian opcional via flag (S1) | Médio | -4 a -8 turns quando `skip` | Nenhuma |
| 3 | Discovery complementar (S2) | Baixo | -1 a -2 traces redundantes | Nenhuma |
| 4 | Iteration budget no manifest (S3) | Baixo | Previne loop infinito de spec | Nenhuma |

**Por que esta ordem**: boilerplate é pura manutenção, zero risco. Guardian opcional é o maior ganho com risco mitigável. Discovery complementar depende de a spec estar confiável (reforçado pelo guardian opcional que pode ser `required`). Iteration budget é preventivo e rápido.

---

## Omissões não identificadas na análise

1. **Custo de re-leitura de artefatos após bloqueios**. Quando o manifest re-invoca spec com respostas do usuário, a spec re-lê todos os artefatos. Isso é indistinguível da tripla discovery para o caso de bloqueios. A análise não cobre este custo.

2. **DeepSeek flash não tem reasoning nativo**. Workers usam `deepseek/deepseek-v4-flash` sem reasoning; validadores usam thinking `xhigh`. A análise assume que turns curtos são baratos, mas workers sem reasoning podem precisar de mais tentativas (correção), inflando o real turn count do execute. A análise só olha a fase de autoria, não a de execução.

3. **Falta de rollback de guardian**. Se guardians forem removidos e o outcome guardian rejeitar consistentemente, não há caminho de volta documentado. A análise deveria propor um flag (como S1) em vez de remoção permanente.
