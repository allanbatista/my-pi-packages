# Repository Guidelines

## Project Structure & Module Organization

Este repositório (`my-pi-packages`) é um **pi package** instalável com `pi install <path>` ou `pi -e <path>`. As skills do workflow de feature ficam em `skills/{skill-name}/SKILL.md`.

- `package.json`: manifesto do pi package (`name`, `keywords`, `pi.skills`, `pi.subagents.agents`).
- `extensions/workflow-manager-guard.ts`: bloqueia escrita de produto e normaliza preflight/model/context/cwd dos managers durante `batista-loop`/`batista-manifest`/`batista-execute`.
- `skills/{skill-name}/SKILL.md`: instruções principais de cada skill.
- `skills/{skill-name}/scripts/`: scripts próprios de uma skill (ex.: `discord_message.py`).
- `agents/{agent-name}.md`: guardians read-only carregados pelo `pi-subagents`.
- `references/PI_ADAPTATION.md`: contrato entre slash commands, managers e a ferramenta `subagent`.
- `references/MODEL_POLICY.md`: modelo/effort por papel (planejamento herda sessão; execução usa DeepSeek flash).
- `examples/pi-subagents-settings.json`: snippet para `~/.pi/agent/settings.json` ou `.pi/settings.json`.
- `.memory/RULES_AND_DEFINITION.md`: regras duráveis do workflow.

Não misture arquivos de uma skill com outra. Se criar uma nova skill, use um diretório próprio em `skills/{skill-name}/`.

## Entry Point & Invocation

O entry point do workflow é `/skill:batista-loop` (controlador de resultado). Pipeline de autoria: `/skill:batista-manifest` orquestra `batista-spec` → (`batista-ux` ∥ `batista-arch`, condicional) → `batista-plan`. Execução: `/skill:batista-execute`.

| Skill | Invocação | Uso |
|---|---|---|
| batista-loop | `/skill:batista-loop` | Objetivo ponta a ponta, autopilot, decomposição, worktrees |
| batista-manifest | `/skill:batista-manifest` | Workflow completo (spec → ux ∥ arch → plan) |
| batista-spec | `/skill:batista-spec` | Especificação de produto, DoD, clarificações |
| batista-ux | `/skill:batista-ux` | Usabilidade e fluxos (quando há frontend) |
| batista-arch | `/skill:batista-arch` | Arquitetura e contratos (quando há backend) |
| batista-plan | `/skill:batista-plan` | Plano técnico, Impact Map, paralelismo |
| batista-execute | `/skill:batista-execute` | Coordenação de workers e validação |
| batista-entity-memory-playbook | `/skill:batista-entity-memory-playbook` | Memória técnica de entidades/componentes em `memory/<dominio>/` |
| batista-ship-pr-to-deploy | `/skill:batista-ship-pr-to-deploy` | Entrega ponta a ponta: commit → PR → CR → CI → merge → tag → deploy → release note |
| batista-discord-webhook-messages | `/skill:batista-discord-webhook-messages` | Mensagens Discord por sessão via bot (`scripts/discord_message.py`) |

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

## Coding Style & Naming Conventions

Escreva documentação e instruções em pt-BR. Use en-US apenas para chaves técnicas, nomes de arquivos, identificadores e campos exigidos por manifestos.

Use Markdown conciso em `SKILL.md`, com frontmatter YAML contendo pelo menos `name` e `description`. Nomeie skills e diretórios em kebab-case ASCII.

## Testing Guidelines

Validação mínima para mudanças em skills:

- `package.json` parseia, `name` é `my-pi-packages` e contém `keywords: ["pi-package"]`.
- Frontmatter das skills contém `name` e `description`.
- Agents declarados em `pi.subagents.agents` existem e validators possuem somente `read`, `grep`, `find` e `ls`.
- `./scripts/validate.sh` passa sem erro (sem efeitos colaterais fora do workspace).
- `npx skills-ref validate` passa em cada skill.
- `npm run test:pi` confirma invocação real via `/skill:*` no Pi.
- Zero resíduos Codex (`$my-feature-workflow`, `.codex-plugin`, `agents/openai.yaml`).

## Agent-Specific Instructions

Antes de editar, leia este arquivo e preserve o menor diff seguro. Não gere scaffolding futuro sem necessidade. Se uma regra durável mudar, atualize `.memory/RULES_AND_DEFINITION.md`.

`/skill:*` é entry point do usuário, não chamada entre skills. Managers permanecem na sessão raiz, carregam managers filhos com `read` e delegam folhas pela ferramenta `subagent`. Sem `pi-subagents`, bloqueie com instrução de instalação; não simule worker/guardian/validator inline.

## Política de modelos (subagents)

| Fase | Papéis | Modelo |
|---|---|---|
| Planejamento | loop, manifest, spec, ux, arch, plan, guardians de artefato | Modelo da sessão; effort efetivo do runtime |
| Execução | worker | `deepseek/deepseek-v4-flash`, sem reasoning |
| Execução | validador | `deepseek/deepseek-v4-flash`, thinking **xhigh** |

Mescle `examples/pi-subagents-settings.json` no seu settings quando quiser defaults persistentes. O workflow também envia overrides por chamada: `worker` e `workflow-validator` ficam pinados; planejamento usa `model: "inherit"`.
