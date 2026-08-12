# Repository Guidelines

## Project Structure & Module Organization

Este repositório (`my-pi-packages`) é um **pi package** instalável com `pi install <path>` ou `pi -e <path>`. As skills do workflow de feature ficam em `skills/{skill-name}/SKILL.md`.

- `package.json`: manifesto do pi package (`name`, `keywords`, `pi.skills`, `pi.subagents.agents`).
- `extensions/`: diretório de extensões do Pi (reservado; atualmente sem extensões — ver `README.md`).
- `skills/{skill-name}/SKILL.md`: instruções principais de cada skill.
- `skills/{skill-name}/scripts/`: scripts próprios de uma skill (ex.: `discord_message.py`).
- `agents/{agent-name}.md`: papéis do workflow carregados pela extensão `@tintinweb/pi-subagents` (guardians/validator read-only; worker/delegate com escrita).
- `references/PI_ADAPTATION.md`: contrato entre slash commands, managers e a ferramenta `Agent` da extensão.
- `references/MODEL_POLICY.md`: modelo/effort por papel (planejamento herda sessão; execução usa `openai-codex/gpt-5.6-luna` + `max`).
- `examples/subagents.json`: settings operacionais da extensão para `~/.pi/agent/subagents.json` ou `.pi/subagents.json`.
- `.memory/RULES_AND_DEFINITION.md`: regras duráveis do workflow.

Não misture arquivos de uma skill com outra. Se criar uma nova skill, use um diretório próprio em `skills/{skill-name}/`.

## Entry Point & Invocation

O entry point do workflow é `/skill:batista-loop` (controlador de resultado). Pipeline de autoria: `/skill:batista-manifest` orquestra `batista-spec` → (`batista-ux` ∥ `batista-arch`, condicional) → `batista-plan` → `batista-validation`. Execução: `/skill:batista-execute`. Incidentes em produção: `/skill:batista-incident`.

| Skill | Invocação | Uso |
|---|---|---|
| batista-loop | `/skill:batista-loop` | Objetivo ponta a ponta, autopilot, decomposição, worktrees |
| batista-manifest | `/skill:batista-manifest` | Workflow completo (spec → ux ∥ arch → plan) |
| batista-spec | `/skill:batista-spec` | Especificação de produto, DoD, clarificações |
| batista-ux | `/skill:batista-ux` | Usabilidade e fluxos (quando há frontend) |
| batista-arch | `/skill:batista-arch` | Arquitetura e contratos (quando há backend) |
| batista-plan | `/skill:batista-plan` | Plano técnico, Impact Map, paralelismo |
| batista-validation | `/skill:batista-validation` | Plano de validação (validation.md): o que validar/testar, evidências e progresso |
| batista-execute | `/skill:batista-execute` | Coordenação de workers e validação |
| batista-incident | `/skill:batista-incident` | Incidente em produção: CloudWatch → investigação → correção → deploy → monitoramento |
| batista-memory | `/skill:batista-memory` | Memória técnica de entidades/componentes em `memory/<dominio>/` |
| batista-ship-pr-to-deploy | `/skill:batista-ship-pr-to-deploy` | Entrega ponta a ponta: commit → PR → CR → CI → merge → tag → deploy → release note |
| batista-discord-webhook-messages | `/skill:batista-discord-webhook-messages` | Mensagens Discord por sessão via bot (`scripts/discord_message.py`) |
| batista-websearch | `/skill:batista-websearch` | Busca web com respostas fundamentadas via OpenRouter Web Search Plugin (`scripts/websearch.py`) |

## Build, Test, and Development Commands

```bash
# Validar estrutura e skills (stdout only)
./scripts/validate.sh

# Testes automatizados do pacote (estrutura + invocação Pi)
npm test

# Somente testes de invocação Pi (requer CLI pi)
npm run test:pi

# E2E real e demorado: loop retoma, executa, valida e converge
npm run test:e2e

# Experimentar sem instalar
pi -e /home/allanbatista/Workspaces/allanbatista/my-pi-packages

# Instalar no projeto (caminho absoluto ou relativo ao settings)
pi install /home/allanbatista/Workspaces/allanbatista/my-pi-packages
```

`npm test` não executa modelos com escrita por padrão. `test:pi`/`test:e2e` são canários explícitos para modelo confiável e ainda usam o filesystem do host; rode-os em container descartável quando precisar testar modelo não confiável.

Mudanças em skills usam o `validation.md` da feature como fonte do que validar/testar e do progresso (Validation Plan/Progress).

## Coding Style & Naming Conventions

Escreva documentação e instruções em pt-BR. Use en-US apenas para chaves técnicas, nomes de arquivos, identificadores e campos exigidos por manifestos.

Use Markdown conciso em `SKILL.md`, com frontmatter YAML contendo pelo menos `name` e `description`. Nomeie skills e diretórios em kebab-case ASCII.

## Testing Guidelines

Validação mínima para mudanças em skills (fonte: `validation.md` da feature — Validation Plan/Progress):

- `package.json` parseia, `name` é `my-pi-packages` e contém `keywords: ["pi-package"]`.
- Frontmatter das skills contém `name` e `description`.
- Agents declarados em `pi.subagents.agents` existem e validators possuem somente `read`, `grep`, `find` e `ls`.
- `./scripts/validate.sh` passa sem erro (sem efeitos colaterais fora do workspace).
- `npx skills-ref validate` passa em cada skill.
- `npm run test:pi` confirma invocação real via `/skill:*` no Pi.
- Zero resíduos Codex (`$my-feature-workflow`, `.codex-plugin`, `agents/openai.yaml`).

## Agent-Specific Instructions

Antes de editar, leia este arquivo e preserve o menor diff seguro. Não gere scaffolding futuro sem necessidade. Se uma regra durável mudar, atualize `.memory/RULES_AND_DEFINITION.md`.

`/skill:*` é entry point do usuário, não chamada entre skills. Managers permanecem na sessão raiz, carregam managers filhos com `read` e delegam folhas pela ferramenta `Agent` (extensão `@tintinweb/pi-subagents`; sintaxe em `references/PI_ADAPTATION.md`). Sem a extensão, bloqueie com instrução de instalação; não simule worker/guardian/validator inline.

## Política de modelos (subagents)

| Fase | Papéis | Modelo |
|---|---|---|
| Planejamento | loop, manifest, spec, ux, arch, plan, batista-validation, incident, guardians de artefato | Modelo da sessão; effort efetivo do runtime |
| Execução | worker | Sem pin — herda sessão/chamada; default indicado `openai-codex/gpt-5.6-luna` + effort **low** (write code = low effort) |
| Execução | validador | Sem pin — herda sessão/chamada; default indicado `openai-codex/gpt-5.6-luna` + effort **high** (validation = high effort) |

A política **não pina** `model`/`thinking` no frontmatter (autoritativo na extensão): o modelo indicado pelo usuário (sessão raiz ou pedido explícito repassado na chamada `Agent(...)`) sempre prevalece; sem indicação, aplica-se a indicação default acima (vive em `references/MODEL_POLICY.md`). `scripts/validate.sh` (check `agents-drift`) falha se um pin for reintroduzido no package ou no instalado. Planejamento (`delegate`, `artifact-guardian`) herda o modelo da sessão. Settings operacionais da extensão: mescle `examples/subagents.json` em `~/.pi/agent/subagents.json` ou `.pi/subagents.json` quando quiser defaults persistentes.
