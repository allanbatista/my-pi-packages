# Subagents

## Responsabilidade

Definir a fronteira entre comandos humanos, managers raiz e children isolados, na interface real da extensão `@tintinweb/pi-subagents` (v0.14.x).

## Entidades

Ferramentas `Agent`, `get_subagent_result` e `steer_subagent`; agent types `delegate`, `artifact-guardian`, `worker` e `workflow-validator` (custom agents em `agents/`, instalados em `~/.pi/agent/agents/` ou `.pi/agents/`); comando `/agents`; settings `~/.pi/agent/subagents.json` + `.pi/subagents.json`.

## Relações

`/skill:*` inicia o workflow (input do usuário); `/agents` administra a extensão (menu humano); somente a ferramenta `Agent(...)` executa children. `model`/`thinking` **não são pinados** no frontmatter dos agent files (`MODEL_POLICY.md`): a indicação do usuário (sessão raiz ou pedido explícito repassado na chamada) prevalece; sem indicação, worker = default `openai-codex/gpt-5.6-luna` + `low`, workflow-validator = default `openai-codex/gpt-5.6-luna` + `high`; delegate/artifact-guardian herdam a sessão. Frontmatter suportado: `name`, `description`, `tools`, `extensions`, `skills`, `model`, `thinking`, `max_turns`, `prompt_mode`, `inherit_context`, `isolated`, `isolation`, `memory`, `disallowed_tools`, `enabled`, entre outros (ver `PI_ADAPTATION.md`). Deriva package ↔ instalado é detectada pelo check `agents-drift` do `scripts/validate.sh`.

## Fluxo

Preflight real (extensão ativa = tools presentes; papéis = arquivos em `~/.pi/agent/agents/` com frontmatter válido; guardians/validator com `tools: read, grep, find, ls` + `extensions: false`) → paths canônicos → **canary de runtime obrigatório** antes do primeiro dispatch real de um run/resume (cwd == root/worktree esperado, modelo/thinking efetivo == expectativa — indicação do usuário ou default da MODEL_POLICY —, conectividade; `max_turns` baixo, sem escrita; divergência = blocked com instrução de reiniciar o Pi no diretório correto) → dispatch `Agent({ subagent_type, prompt, description, max_turns })` com contexto mínimo (child herda o cwd da sessão raiz; `prompt_mode: replace` + `skills: false` + sem `inherit_context` = contexto fresco; `model`/`thinking` na chamada somente quando o usuário indicar explicitamente) → Delegation Result → releitura do artefato. Referências entre skills resolvem a partir do `SKILL.md` do package, nunca do epic dir/cwd; falha de resolução bloqueia em vez de simular a rotina. Background: `run_in_background: true` → `agent_id` → `get_subagent_result({ agent_id, wait: true })`. Worktree isolation (`isolation: "worktree"`) apenas para workers paralelos em features; schedule/RPC são capacidades da extensão fora do fluxo dos managers.

## Fontes no código

- `agents/artifact-guardian.md`
- `agents/workflow-validator.md`
- `agents/worker.md`
- `agents/delegate.md`
- `references/PI_ADAPTATION.md`
- `references/WORKFLOW_COMMON.md`
- `references/MODEL_POLICY.md`
- `package.json`
