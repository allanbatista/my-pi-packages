# Análise de performance do feature-workflow

> **Revisado por 3 modelos (GLM 5.2, DeepSeek Pro V4, Mimo 2.5 Pro) em 2026-07-06.**
> Reviews completos: `docs/review-glm52.md`, `docs/review-deepseek-pro-v4.md`, `docs/review-mimo25pro.md`

## Contexto

O workflow de feature (`loop → manifest → spec → ux ∥ arch → plan → execute`) está estável e funcional, mas é mais lento do que deveria. Esta análise identifica causas raiz e propõe simplificações.

## Métricas

| Métrica | Valor |
|---|---|
| Total de skills | 7 (loop, manifest, spec, ux, arch, plan, execute) |
| Linhas totais nos SKILL.md | 1402 |
| Linhas de boilerplate duplicado | ~200 (14%) entre as 7 skills |
| Guardians de artefato | 4 (spec, ux, arch, plan) |
| Validadores de execução | 1 por task no execute |
| Outcome guardian | 1 por feature no loop |

## Causas raiz da lentidão

### Causa 1: Guardians de artefato inflam turn count (✅ confirmada por todos os revisores)

Cada skill de autoria (spec, ux, arch, plan) roda um guardian independente que carrega contexto, lê o artefato, aplica rubrica e redige resposta. Para uma feature fullstack:

| Etapa | Turns com guardian |
|---|---|
| spec | 2-4 (escreve → guardian → fix → guardian → approved) |
| ux | 2-4 |
| arch | 2-4 |
| plan | 2-4 |
| **Subtotal autoria** | **8-16 turns** |
| execute | 1 manager + N workers + N validators |
| outcome guardian | 1 |

> **Nota**: estimativas teóricas baseadas na estrutura dos SKILL.md. Dados empíricos de 3-5 features reais são necessários para confirmar.

### Causa 2: Guardians vs self-check redundante (✅ confirmada)

Cada template de artefato já contém `Readiness Gates` — checklist que cobre a mesma rubrica do guardian. O guardian repete a verificação que a própria skill pode fazer.

**Porém**: o guardian tem papel **generativo** que o self-check não cobre — o guardian produz `Questions`, `Critiques` e `Required changes` que vão além da checklist binária. Self-check do autor não tem distância crítica para gerar esses insights.

**Revisores**: GLM 5.2 e Mimo 2.5 Pro apontaram que essa é essencialmente a mesma causa que #1 (a redundância é o mecanismo da inflação). Unificar como facetas da mesma causa raiz.

### Causa 3: Boilerplate duplicado (~200 linhas) (✅ confirmada por todos)

Seções `Pi Runtime`, `Delegação`, `Context Isolation` e `State & Memory` repetidas nas 7 skills. Dificulta manutenção e infla contexto.

### Causa 4: Descoberta sobreposta entre spec, ux e arch (⚠️ parcialmente — superestimada na análise original)

**Análise original**: spec, ux e arch varrem o mesmo codebase 3 vezes.

**Revisão**: os 3 revisores apontaram que os Ledgers têm escopos diferentes:
- spec (`D#`): fatos do produto, contratos, APIs, schemas
- ux (`U#`): fluxos de uso, telas, estados, baseline de acessibilidade
- arch (`A#`): componentes técnicos, integrações, modelo de dados, infra

A sobreposição real está na leitura de arquivos-base (AGENTS.md, estrutura do repo, spec.md), não nas descobertas especializadas. O ganho de unificar discovery é menor do que a análise original sugeriu.

**DeepSeek Pro V4**: "Superestima redundância ao não distinguir entre leitura base e discovery especializado."

### Causas adicionais identificadas pelos revisores (não estavam na análise original)

| Causa | Fonte | Descrição |
|---|---|---|
| Guardian re-run amplification | DeepSeek | Quando guardian rejeita com 1 item `fail`, skill corrige e re-roda guardian do zero. Ciclo fix+revalidate = 2-3 turns extras por rejeição |
| Clarification round-trip overhead | DeepSeek | Modo orchestrated: spec→blocked→manifest→usuário→manifest→spec = 2-4 turns por round-trip |
| Manifest como bottleneck sequencial | DeepSeek | Manifest serializa spec→ux∥arch→plan com gate após cada etapa |
| Context reload por turno | DeepSeek | Cada guardian e cada skill filha recarrega contexto do zero |
| Falta de medição empírica | Todos | Estimativas de turn count são teóricas, sem baseline real |
| Custo de turnos longos vs curtos | Mimo | Self-check acumula mais contexto em 1 turn; 2 turns curtos podem ser mais rápidos que 1 turn longo em modelos flash |

---

## Recomendações (revisadas)

### Recomendação 1: Manter guardian para spec; tornar ux/arch/plan opcionais

**Consenso dos 3 revisores**: remover TODOS os guardians é arriscado demais.

**Por que spec é âncora**: spec define o contrato de produto. Erro aqui propaga para ux, arch, plan e execute. Corrigir pós-execução custa 3-5× mais que detectar no guardian preventivo.

**Por que ux/arch/plan podem ser opcionais**: se spec passou pelo guardian, ux e arch derivam da spec como contrato âncora. Plan reconcilia ux↔arch e já é validado pelo manifest (Solution Gate). Plan não precisa de guardian se spec foi validada.

**Mecanismo**: flag `guardian` no manifest: `required` (default) | `skip`. Para features fullstack ou que tocam contrato/persistência/superfície nova, `required`. Para features pontuais sem contrato novo, `skip`.

**Arquivos afetados**: batista-manifest/SKILL.md (flag), batista-spec/SKILL.md (guardian permanece), batista-ux/SKILL.md, batista-arch/SKILL.md, batista-plan/SKILL.md (guardian condicional).

### Recomendação 2: Discovery complementar (renomeado de "Discovery único")

**Revisão**: os Ledgers (D#, U#, A#) não são redundantes — são complementares com escopos diferentes.

**O que muda**: spec faz `Discovery Ledger` do produto (contratos, APIs, schemas, rotas). Manifest injeta `D#` como contexto para ux e arch. ux e arch **partem** do ledger da spec e fazem discovery adicional **apenas** nas dimensões não cobertas (UX: telas, fluxos, a11y; Arch: schema, failure modes, integrações).

**Gate de escalação**: se ux/arch encontrarem lacuna no spec que afeta decisão de design, registram `Open Questions` e escalam — não operam com descoberta insuficiente.

**Arquivos afetados**: batista-manifest/SKILL.md (passa D# no contexto), batista-ux/SKILL.md e batista-arch/SKILL.md (discovery complementar com gate de escalação).

### Recomendação 3: Boilerplate compartilhado (sem alterações — risco mínimo, implementar primeiro)

Criar `references/WORKFLOW_COMMON.md`. Cada SKILL.md referencia com 1 linha.

**Consenso**: recomendação menos controversa, zero impacto no comportamento, ganho imediato de manutenção. Deve ser implementada primeiro.

### Recomendação 4: Fast-track com gate de risco, não só de escopo

**Revisão**: "Pontual" mede escopo, não risco. Feature pontual em handler de pagamento é localizada mas crítica.

**Gate revisado** — fast-track (pular ux/arch + guardians opcionais) exige TODOS:
- `Intent Classification = pontual/localizada`
- `Coverage expectation = somente fluxo afetado`
- `Changed contracts = none`
- Nenhuma `Validation surface` nova
- `Shared Contract = none`

**O que NÃO pula**: guardian da spec (sempre required quando há contrato ou superfície nova).

**Arquivos afetados**: batista-manifest/SKILL.md (Solution Gate com critérios de risco).

### Recomendação 5 (nova): Iteration budget no manifest

**Fonte**: Mimo 2.5 Pro. O loop tem iteration budget (5); o manifest não tem. Se spec erra e ux/arch/plan herdam o erro, o manifesto pode iterar spec→ux/arch→plan indefinidamente.

Adicionar `Manifest iteration budget: 3` ao `manifest.md`. Se o manifesto precisar re-invocar spec 3+ vezes, força blocker.

**Arquivos afetados**: batista-manifest/SKILL.md, manifest.md template.

---

## Ordem de implementação (revisada)

| Ordem | Recomendação | Risco | Ganho | Dependência |
|---|---|---|---|---|
| 1 | Boilerplate compartilhado (#3) | Baixo | -200 linhas, manutenção centralizada | Nenhuma |
| 2 | Iteration budget no manifest (#5) | Baixo | Previne loop infinito de spec | Nenhuma |
| 3 | Discovery complementar (#2) | Baixo | -1 a -2 traces redundantes | Nenhuma |
| 4 | Guardian condicional — spec sempre, ux/arch/plan opcionais (#1) | Médio | -3 a -6 turns (ux/arch/plan guardians) | Discovery complementar (#2) |
| 5 | Fast-track com gate de risco (#4) | Médio | -2 a -3 turns em features simples | Guardian condicional (#1) |
| 6 | Coletar dados empíricos de 3-5 features | — | Confirma ou refuta estimativas teóricas | Após #1-#5 |

---

## O que NÃO deve ser simplificado

| Componente | Razão | Consenso dos revisores |
|---|---|---|
| Guardian da spec | Artefato âncora; erro aqui propaga para todo pipeline | ✅ Unânime |
| Worker/validador do execute | Implementação ≠ validação; separação essencial | ✅ Unânime |
| Outcome guardian do loop | Única validação E2E; substitui guardians intermediários | ✅ Unânime |
| Decomposition & anti-thrash do loop | Necessário para features multi-worktree | ✅ Unânime |
| Write-before-forget & checkpoints | Essencial para retomada entre sessões | ✅ Unânime |
| Clarification protocol (standalone vs orchestrated) | Necessário para isolamento de contexto | ✅ Unânime |

---

## Trade-offs (revisados)

| Decisão | Ganho | Risco | Gravidade |
|---|---|---|---|
| Guardian condicional (spec sempre, ux/arch/plan opcionais) | -3 a -6 turns/feature | ux/arch/plan menos revisados; mitigado pelo manifest (Solution Gate) | Média |
| Discovery complementar | -1 a -2 traces redundantes | ux/arch podem herdar gap do spec; mitigado por gate de escalação | Baixa |
| Boilerplate compartilhado | -200 linhas, manutenção centralizada | Arquivo extra | Mínima |
| Fast-track com gate de risco | -2 a -3 turns/feature simples | "Pontual" não mede risco; mitigado por contrato/superfície nova como gate adicional | Média |
| Iteration budget no manifest | Previne loops infinitos | Nenhum | Mínima |

### Risco composto (identificado pelo DeepSeek Pro V4)

Se guardian condicional + fast-track forem aplicados juntos **sem** manter guardian para spec, o outcome guardian do loop se torna o **único ponto de validação independente** no pipeline inteiro. O documento original não analisava esse risco. Com a revisão (guardian da spec sempre `required`), o risco composto é mitigado.

---

## Pendências

- [ ] Coletar dados empíricos de 3-5 features reais (turns por fase, taxa de rejeição de guardian, maior contribuidor de latência)
- [ ] Validar modelo de flag `guardian: required|skip` no manifest com uma feature real
- [ ] Testar gate de risco do fast-track com feature pontual de alto risco (ex: handler de pagamento)