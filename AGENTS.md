# Repository Guidelines

## Project Structure & Module Organization

Este repositório é um **pi package** instalável com `pi install ./path` ou `pi -e ./path`. As skills do workflow de feature ficam em `skills/{skill-name}/SKILL.md`.

- `package.json`: manifesto do pi package (`keywords: ["pi-package"]`, `pi.skills`).
- `skills/{skill-name}/SKILL.md`: instruções principais de cada skill.
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
# Validar estrutura e skills
./scripts/validate.sh

# Testes automatizados do pacote
npm test

# Experimentar sem instalar
pi -e /absolute/path/to/my-pi-packages

# Instalar no projeto
pi install ./my-pi-packages
```

## Coding Style & Naming Conventions

Escreva documentação e instruções em pt-BR. Use en-US apenas para chaves técnicas, nomes de arquivos, identificadores e campos exigidos por manifestos.

Use Markdown conciso em `SKILL.md`, com frontmatter YAML contendo pelo menos `name` e `description`. Nomeie skills e diretórios em kebab-case ASCII.

## Testing Guidelines

Validação mínima para mudanças em skills:

- `package.json` parseia e contém `keywords: ["pi-package"]`.
- Frontmatter das skills contém `name` e `description`.
- `./scripts/validate.sh` passa sem erro.
- `npx skills-ref validate` passa em cada skill.
- Zero resíduos Codex (`$my-feature-workflow`, `.codex-plugin`, `agents/openai.yaml`).

## Agent-Specific Instructions

Antes de editar, leia este arquivo e preserve o menor diff seguro. Não gere scaffolding futuro sem necessidade. Se uma regra durável mudar, atualize `.memory/RULES_AND_DEFINITION.md`.

As skills assumem subagents quando disponíveis; em Pi sem paridade de `fork_context`/model pinning, siga os fallbacks explícitos nas skills (registrar blocker, declarar limitação na resposta final).