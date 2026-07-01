# Projeto de pi package e skills

Este pi package contém skills de workflow de feature para Pi. Trate `skills/{skill-name}/SKILL.md` como unidades instaláveis via `pi install` ou `pi -e`.

# Feature Workflow revisa inputs existentes

Quando qualquer skill do feature-workflow receber como input um diretório de feature ou um arquivo específico (`manifest.md`, `spec.md` ou `plan.md`), deve tratar a tarefa como revisão: ler os arquivos existentes da feature, checar pendências, dúvidas, blockers, divergências e evidência faltante, pedir clarificação quando necessário e refinar/corrigir o documento aplicável antes de marcar spec, plan ou manifest como completo/pronto.

# Feature Workflow execução coordenada

Execução de feature no feature-workflow deve usar `/skill:execute`: a sessão principal atua como manager, pode atualizar apenas documentos de workflow/status/evidência, delega implementação a subagents workers e delega aceite a um subagent validador independente. O manager não implementa código da feature nem declara sozinho que a implementação está correta.

# Feature Workflow skills não implementam produto

As skills `/skill:manifest`, `/skill:spec`, `/skill:ux`, `/skill:arch` e `/skill:plan` só podem criar ou refinar documentos de workflow dentro da pasta da feature. Mesmo quando o usuário disser "corrija", "implemente" ou "execute", essas skills não devem editar código de produto, testes, configs, migrations ou arquivos fora da feature; devem preparar/refinar spec/plan/manifest e encaminhar execução para `/skill:execute`.

# Feature Workflow spec classifica intenção

A skill `/skill:spec` deve começar refletindo e registrando a intenção real do usuário: se o pedido é uma alteração pontual/localizada em parte do sistema ou uma feature ponta a ponta. Se essa classificação mudar escopo, validação ou contrato, deve pedir clarificação antes de marcar a spec como pronta.

# Feature Workflow spec faz discovery rastreável

A skill `/skill:spec` só pode marcar `Status: ready` depois de fazer discovery como método (percorrer dimensões explícitas — contratos/APIs, schemas/persistência, rotas/handlers, consumers/jobs, configs/flags, testes, dependências externas, telemetria/logs, owners — e traçar pelo menos um fluxo atual ponta a ponta); registrar `Discovery Ledger` com IDs (`D#`); rastrear necessidade -> requisito -> critério de aceite -> superfície de validação, com cada requisito em forma **EARS** e cada critério de aceite em **Dado/Quando/Então** (obrigatório; o guardian rejeita desvio de forma); ancorar cada fato em um `D#` com evidência ou decisão registrada; e resolver perguntas que mudem escopo, contrato, persistência, UX, rollout ou validação.

# Feature Workflow clarificação bounded

A skill `/skill:spec` levanta clarificações materiais varrendo a taxonomia de ambiguidade (escopo funcional, modelo de dados, fluxo/UX, não-funcional, integração/dependências, edge cases/falhas, restrições/tradeoffs, contrato, persistência, rollout, terminologia, sinais de conclusão/DoD), priorizadas por (Impacto × Incerteza), no máximo 5 por rodada e com opção recomendada justificada. Em modo standalone, pergunta ao usuário em lote e espera; em modo orchestrated, preenche `Clarifications Needed` (com IDs `C#`), seta `Status: blocked` e devolve o controle, e o manager relé as perguntas ao usuário e re-invoca a spec com as respostas (`C#`). Dúvida trivial vira suposição explícita, não pergunta; nunca marque `ready` com clarificações abertas.

# Feature Workflow sem achismo

Todas as skills do feature-workflow devem investigar antes de concluir, confirmar fatos com evidência concreta e registrar a fonte da evidência. Afirmações não verificadas devem virar `pending`, blocker ou pergunta ao usuário; nunca devem ser tratadas como fato.

# Feature Workflow resumo final

Ao finalizar `/skill:spec`, `/skill:plan` ou `/skill:manifest`, o agente deve responder ao usuário com um resumo curto do que foi especificado/planejado, o que será feito, pendências e evidências usadas. Ao finalizar `/skill:execute`, deve responder com summary do que foi executado, falhou, ficou pendente, como validar e próximo passo.

# Feature Workflow modelo dos subagents

A skill `/skill:execute` deve criar todos os subagents com `model: gpt-5.4-mini` e `reasoning_effort: high`, incluindo workers de implementação, validadores e correções.

# Feature Workflow paralelismo

A skill `/skill:plan` deve produzir planos paralelizáveis quando possível, decompondo fases/tasks em DAG, batches paralelos, write sets disjuntos, dependências e pontos de sincronização. A skill `/skill:execute` deve executar cada batch paralelo fazendo spawn de todos os workers independentes antes de aguardar resultados; não deve serializar tasks independentes por conveniência.

# Feature Workflow Impact Map

A skill `/skill:plan` deve produzir um `Impact Map` obrigatório antes de fases/tasks, listando superfícies afetadas, evidência, motivo, arquivos/owners, necessidade de mudança, validação e riscos. Nenhum plano deve ficar executável sem Impact Map completo, e cada task/fase deve nascer de uma superfície mapeada.

# Feature Workflow isolamento por subagent

Quando uma skill do feature-workflow chamar outra skill ou delegar execução/validação, deve usar subagent isolado com `fork_context: false` e contexto mínimo explícito. O manager não deve compartilhar o histórico completo da sessão; deve passar apenas pedido, paths, documentos da feature, DoD e evidências necessárias.

# Feature Workflow entry point e pipeline

O entry point do pacote é `/skill:loop` (controlador de resultado). Autoria: `/skill:manifest` orquestra `spec` → (`ux` ∥ `arch`, condicional) → `plan`. Execução: `/skill:execute`. O gate de solução usa `Validation surfaces` da spec com precedência sobre `Intent Classification` (intent só reduz solução com `pontual/localizada` + `somente fluxo afetado` + subconjunto mínimo sem `Shared Contract` pendente). `not-applicable` no manifesto satisfaz o gate; `missing` após solução é blocker.

# Feature Workflow Shared Contract

Antes de spawn paralelo `ux`∥`arch`, a spec deve ter `Shared Contract` = `closed` ou `none`. Contrato compartilhado (payloads, erros, sequência) não pode ficar `pending` com `Status: ready`.

# Feature Workflow guardian de artefatos

As etapas `spec`, `ux`, `arch` e `plan` só concluem com guardian independente `approved`. Guardians usam rubrica testável; qualquer `fail` força rejeição. O plan reconcilia `ux`↔`arch`; conflitos não resolvíveis escalam via `Escalation` ao manifest — o `plan` não edita `spec`/`ux`/`arch`. O `loop` usa outcome guardian para `converged`.

# Feature Workflow loop e anti-thrash

O `loop` mantém `Iteration budget` (default 5) e `Iterations used`. Mesmo `gap`+`causa` 2× no Convergence Ledger → `blocked`. Três iterações sem evidência nova → `ceiling`. Checkpoint obrigatório em `loop.md` antes de delegar.

# Feature Workflow memória e checkpoint

Fonte da verdade é arquivo, não contexto. Write-before-forget: cada manager grava `Updated:`, resume point e status antes de spawn ou de ceder turno. Compactar = ponteiro (últimos 10 do ledger); resumo nunca faz upgrade de status. Memória em 3 escalas: projeto (`AGENTS.md`, skills, `docs/adr`), feature (`.features/`), loop (`loop.md`).

# Feature Workflow skill extraction

Extração de skill project-local (≥2–3 repetições) roda somente no worktree principal, após merge, uma por vez. Write set: `{project}/skills/{skill-name}/`. Nunca em paralelo com worktrees de sub-feature.

# Feature Workflow guardian de spec e plan (legado)

As etapas `/skill:spec` e `/skill:plan` só podem concluir depois de um subagent guardian independente aprovar o artefato. O guardian não edita arquivos; valida contra uma rubrica testável (na spec: requisitos em EARS, aceites em Dado/Quando/Então, todo fato ancorado em `D#` com evidência, intenção justificada, taxonomia coberta, contrato/persistência/validação/fora-de-escopo fechados, `Shared Contract` fechado) e qualquer item `fail` força rejeição. Se rejeitar, deve devolver perguntas, críticas e mudanças obrigatórias, e a skill deve corrigir ou bloquear antes de tentar nova validação.

# Feature Workflow definição de pronto e testes

No feature-workflow, pronto significa validação prática com evidência de funcionamento, não leitura de código. Workers podem executar testes automáticos focados no escopo da task; validadores são guardiões da entrega e não executam testes automáticos. Suítes amplas/finais devem ser reservadas para fechamento de fase ou exigência explícita do plano.