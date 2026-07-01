# Repository Guidelines

## Project Structure & Module Organization

Este repositório (`my-pi-packages`) é um **pi package** instalável com `pi install <path>` ou `pi -e <path>`. As skills do workflow de feature ficam em `skills/{skill-name}/SKILL.md`.

- `package.json`: manifesto do pi package (`name: my-pi-packages`, `keywords: ["pi-package"]`, `pi.skills`).
- `skills/{skill-name}/SKILL.md`: instruções principais de cada skill.
- `references/PI_ADAPTATION.md`: fallbacks de delegação quando Pi não oferece subagents.
- `references/MODEL_POLICY.md`: modelo/effort por papel (planejamento herda sessão; execução usa DeepSeek flash).
- `examples/pi-subagents-settings.json`: snippet para `~/.pi/agent/settings.json` ou `.pi/settings.json`.
- `.memory/RULES_AND_DEFINITION.md`: regras duráveis do workflow.

Não misture arquivos de uma skill com outra. Se criar uma nova skill, use um diretório próprio em `skills/{skill-name}/`.

## Entry Point & Invocation

O entry point do workflow é `/skill:loop` (controlador de resultado). Pipeline de autoria: `/skill:manifest` orquestra `spec` → (`ux` ∥ `arch`, condicional) → `plan`. Execução: `/skill:execute`.

| Skill | Invocação | Uso |
|---|---|---|
| loop | `/skill:loop` | Objetivo ponta a ponta, autopilot, decomposição, worktrees |
| manifest | `/skill:manifest` | Workflow completo (spec → ux ∥ arch → plan) |
| spec | `/skill:spec` | Especificação de produto, DoD, clarificações |
| ux | `/skill:ux` | Usabilidade e fluxos (quando há frontend) |
| arch | `/skill:arch` | Arquitetura e contratos (quando há backend) |
| plan | `/skill:plan` | Plano técnico, Impact Map, paralelismo |
| execute | `/skill:execute` | Coordenação de workers e validação |

## Build, Test, and Development Commands

```bash
# Validar estrutura e skills (stdout only)
./scripts/validate.sh

# Testes automatizados do pacote (estrutura + invocação Pi)
npm test

# Somente testes de invocação Pi (requer CLI pi)
npm run test:pi

# Experimentar sem instalar
pi -e /home/allanbatista/Workspaces/allanbatista/my-pi-packages

# Instalar no projeto (caminho absoluto ou relativo ao settings)
pi install /home/allanbatista/Workspaces/allanbatista/my-pi-packages
```

## Coding Style & Naming Conventions

Escreva documentação e instruções em pt-BR. Use en-US apenas para chaves técnicas, nomes de arquivos, identificadores e campos exigidos por manifestos.

Use Markdown conciso em `SKILL.md`, com frontmatter YAML contendo pelo menos `name` e `description`. Nomeie skills e diretórios em kebab-case ASCII.

## Testing Guidelines

Validação mínima para mudanças em skills:

- `package.json` parseia, `name` é `my-pi-packages` e contém `keywords: ["pi-package"]`.
- Frontmatter das skills contém `name` e `description`.
- `./scripts/validate.sh` passa sem erro (sem efeitos colaterais fora do workspace).
- `npx skills-ref validate` passa em cada skill.
- `npm run test:pi` confirma invocação real via `/skill:*` no Pi.
- Zero resíduos Codex (`$my-feature-workflow`, `.codex-plugin`, `agents/openai.yaml`).

## Agent-Specific Instructions

Antes de editar, leia este arquivo e preserve o menor diff seguro. Não gere scaffolding futuro sem necessidade. Se uma regra durável mudar, atualize `.memory/RULES_AND_DEFINITION.md`.

Em Pi sem `spawn_agent`/`fork_context`, siga `references/PI_ADAPTATION.md`: execute inline com isolamento de contexto e invoque skills filhas via `/skill:<name>` — não bloqueie só por indisponibilidade de subagent.

## Política de modelos (subagents)

| Fase | Papéis | Modelo |
|---|---|---|
| Planejamento | loop, manifest, spec, ux, arch, plan, guardians de artefato | **Igual à sessão principal** (modelo + effort) |
| Execução | worker | `deepseek/deepseek-v4-flash`, sem reasoning |
| Execução | validador | `deepseek/deepseek-v4-flash`, thinking **xhigh** |

Com `pi-subagents`, mescle `examples/pi-subagents-settings.json` no seu settings. Planejamento não deve usar override — só `worker` e `reviewer` (validador) ficam pinados.