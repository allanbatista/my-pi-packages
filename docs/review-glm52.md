# Review — docs/performance-analysis-workflow.md

## Status

**Aprovado com ressalvas.** As 4 causas raiz são majoritariamente corretas, mas 2 delas (Causa 2 e Causa 4) superestimam a redundância e subestimam o valor da independência do guardian. As recomendações #1 e #2 são viáveis, porém com riscos maiores que o documento admite; #3 é seguro; #4 não é seguro como proposto. Há omissões relevantes (loops de guardian sem borne, custo de contexto por turno, manifest como gargalo serial, round-trips de clarificação).

---

## Achados

### 1. As 4 causas raiz — avaliação por item

**Causa 1 — Guardians inflam turn count: CORRETA.**
Evidência: cada skill de autoria tem um passo explícito de guardian como etapa separada do workflow (`spec/SKILL.md:43`, `ux/SKILL.md:47`, `arch/SKILL.md:49`, `plan/SKILL.md:44`), e o `manifest` confirma aprovação entre cada delegação (`manifest/SKILL.md:39-44`). O guardian é de fato um passo com seu próprio carregamento de contexto. Maior impacto confirmado.

**Causa 2 — Tripla Discovery: PARCIALMENTE CORRETA (exagerada).**
Evidência: existem três ledgers distintos com focos diferentes — `Discovery Ledger` (D#, fatos de produto/escopo, `spec/SKILL.md:83`), `Usability Ledger` (U#, telas/fluxos/estados/a11y, `ux/SKILL.md:43`), `Architecture Ledger` (A#, componentes/schemas/integrações/jobs, `arch/SKILL.md:43`). A afirmação "os mesmos arquivos são lidos 3 vezes por 3 skills com propósitos sobrepostos" é imprecisa: a sobreposição é parcial (todos varrem o codebase), mas o *produto* de cada discovery é diferente. A Causa 2 deveria ser "discovery com sobreposição parcial de leitura", não "tripla discovery idêntica".

**Causa 3 — Boilerplate duplicado (~200 linhas): PLAUUSÍVEL, não verificado linha-a-linha.**
As seções `Context Isolation`, `State & Memory`, `Checkpoint` e `Final Response` aparecem com conteúdo quase idêntico em spec/ux/arch/plan/loop/manifest (verificada a presença). A estimativa de ~200 linhas (14%) é razoável mas não foi medida; recomendo confirmar com `diff` entre skills antes de aceitar o número como fato.

**Causa 4 — Guardians vs self-check redundante: CORRETA EM FORMA, SUBESTIMA A INDEPENDÊNCIA.**
Evidência: `Spec Readiness Gates` (`spec/SKILL.md:151`) e `Artifact Guardian` rubric (`spec/SKILL.md:181`) cobrem o mesmo checklist (EARS, Dado/Quando/Então, D#, Shared Contract). A redundância de *itens* é real. **Porém**: Readiness Gates são preenchidos pelo próprio autor (mesmo contexto, mesmo viés de confirmação); o guardian é uma passagem independente (contexto mínimo carregado separadamente, `spec/SKILL.md:173`). O documento trata as duas como equivalentes e ignora que self-check do autor é estruturalmente mais fraco que revisão independente.

### 2. Recomendação #1 — self-check substitui guardian: **CONDICIONALMENTE SEGURO**

- **Seguro para**: consistência cross-artefato (o `manifest` já reconcilia via Solution Gate/Shared Contract) e validação E2E (o `loop` mantém outcome guardian).
- **Não seguro para**: detecção precoce de defeitos de *forma* (EARS mal-formado, aceite sem superfície de validação, D# sem evidência). O outcome guardian do `loop` valida o **resultado**, não a forma do artefato (`loop/SKILL.md:135`: "não valida task a task"). Um spec mal-formado passa, é planejado, executado, e só falha no outcome — detecção tardia cara.
- **Risco não modelado**: viés de confirmação do autor preenchendo seu próprio checklist. O ganho de turnos (-4 a -8) é otimista porque parte da função do guardian é capturar retrabalho que, se removido, vira retrabalho mais caro downstream.

### 3. Recomendação #2 — discovery único no spec: **NÃO FUNCIONA COMO PROPOSTO**

- A spec tem regra explícita: "Mantenha o conteúdo sem detalhes técnicos de implementação" (`spec/SKILL.md:199`). Um discovery único abrangendo UI (telas, componentes, estados) e backend (schemas, jobs, integrações) ou (a) viola esta regra, ou (b) deixa ux/arch ainda precisando de seu próprio discovery.
- A cláusula "discovery complementar" reconhece o problema, mas reduz o ganho real (não são mais -2 traces; é ~-1 a -1.5).
- **Risco novo**: spec vira single point of failure — toda skill downstream depende da completude do discovery da spec. Se a spec errar um fato de backend, arch herda o gap e pode não re-descobrir (pois discovery passa a ser "só complementar"). Aumenta risco em vez de reduzir.

### 4. Recomendação #4 — fast-track sem guardians: **NÃO SEGURO COMO PROPOSTO**

- `Intent Classification` é auto-classificada pelo autor da spec (`spec/SKILL.md:37`, passo 6). Sem guardian de spec, a classificação "pontual/localizada" fica sem checagem independente. Uma feature mal-classificada como pontual pula guardians que precisaria — buraco de confiança auto-referencial.
- O outcome guardian do loop captura o resultado, mas para um fix pequeno o custo de uma iteração de outcome falho pode exceder o custo de um spec guardian rápido.
- **Condição mínima para ser seguro**: manter pelo menos o guardian de spec (que valida a Intent Classification) ou ter o `manifest` checando explicitamente a classificação antes de liberar fast-track.

### 5. Trade-offs — riscos subestimados

| Decisão | Risco subestimado no doc |
|---|---|
| Remover guardians de artefato | "Mitigado pelo outcome guardian" — outcome valida **resultado**, não **forma**; custo de detecção tardia não modelado. |
| Discovery único | "Mitigado por discovery complementar" — sem mecanismo que obrigue o complementar a rodar; vira opcional e é pulado quando há pressa. |
| Fast-track sem guardians | Self-classificação de intent sem check independente; nada impede misclassification. |
| (geral) | Estimativas de turn savings (-4 a -8, -2 a -3) são *assertivas*, não medidas. Sem baseline de turn count real por feature, o ganho é especulativo. |

### 6. Omissões — causas raiz não identificadas

1. **Loops de guardian sem borne de iteração.** `repita até approved` (`spec/SKILL.md:43`, `arch/SKILL.md:49`) não tem teto de iterações. Um guardian flaky ou rubrica ambígua pode inflar turns bem além de "1-2 por skill". Não está nas 4 causas.
2. **Custo de contexto por turno, não só contagem.** Cada guardian recarrega AGENTS.md + spec + evidências (`spec/SKILL.md:173`). O doc conta turns mas ignora tokens/custo de contexto por turno — que é onde modelos flash sentem.
3. **`manifest` como gargalo serial.** Passos 8-14 do manifest (`manifest/SKILL.md:39-44`) são handoffs sequenciais spec→guardian→solution→guardian→plan→guardian com confirmações entre cada. Mesmo sem guardians, a serialização do manifest adiciona turnos não contabilizados.
4. **Round-trips de clarificação.** `Clarification Protocol` orchestrated (`spec/SKILL.md:222`) re-invoca a spec por lote de até 5 perguntas; múltiplos lotes = múltiplos turnos. Não contado.
5. **Discovery obrigatório "pelo menos um fluxo ponta a ponta"** (`spec/SKILL.md:36`) é caro por feature e não é sinalizado como fonte de lentidão.

---

## Riscos

- **R1 (alto):** Remoção total de guardians de artefato desloca detecção de defeitos de forma para o outcome guardian, que não os valida. Custo de retrabalho downstream não modelado.
- **R2 (alto):** Discovery único no spec cria single point of failure e viola a regra "spec sem detalhe técnico".
- **R3 (médio):** Fast-track baseado em self-classificação de intent, sem check independente, permite misclassification que pula guardians necessários.
- **R4 (médio):** Estimativas de ganho não medidas; risco de otimizar o errado se a causa real de lentidão for loops de guardian sem borne ou clarificação (omitidos).
- **R5 (baixo):** Boilerplate compartilhado — risco baixo, recomendar prosseguir.

---

## Sugestões

1. **Rec #1 — não remover cegamente; condicionar.** Mantenha self-check como gate primário, mas preserve guardian para spec (valida forma + Intent Classification) e plan (valida aderência spec→tasks). Remova guardians de ux/arch (onde a sobreposição com Readiness Gates é maior e o manifest reconcilia). Ganho menor (-2 a -4) mas seguro.
2. **Rec #2 — reformular.** Em vez de "spec faz discovery único", crie um `Discovery Ledger` compartilhado injetado pelo manifest com fatos *comuns* (contratos, schemas, rotas), e mantenha ledgers específicos de ux/arch para o que é específico. Reduz sobreposição sem criar SPOF nem violar regras da spec.
3. **Rec #3 — prosseguir.** Valide o count de ~200 linhas com `diff` real antes de citar como métrica.
4. **Rec #4 — só seguro com check de Intent Classification.** Mantenha guardian de spec (ou check explícito do manifest) para validar a classificação antes de liberar fast-track. Sem isso, não recomendado.
5. **Adicionar à análise:** borne de iteração de guardian (ex.: máx 2 loops, depois escala para usuário), custo de contexto por turno, e serialização do manifest como causas candidatas.
6. **Medir antes de otimizar:** coletar turn count real de 2-3 features completas antes de aceitar as estimativas de ganho.

---

## Ordem revisada (prioridade de ação)

1. **Rec #3** (boilerplate) — seguro, baixo risco, prosseguir independente.
2. **Adicionar borne de iteração aos guardians** (omissão #1) — fix simples, reduz risco de loop sem borne, independente das outras recomendações.
3. **Rec #1 ajustada** — self-check como gate primário + guardian retido para spec e plan; removido para ux/arch. Ganho seguro.
4. **Rec #2 ajustada** — discovery compartilhado de fatos comuns via manifest, ledgers específicos preservados. Evita SPOF.
5. **Rec #4 condicional** — só após #3 (guardian de spec valida Intent Classification) ou com check explícito do manifest.
6. **Medir turn count real** antes de afirmar ganhos quantitativos.
