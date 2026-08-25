# my-pi-packages

Pacote do Pi com o workflow de features (`batista-*`): autoria (spec → ux ∥ arch → plan → validation), execução com workers e validadores independentes, memória técnica de entidades, entrega ponta a ponta (commit → deploy), incidentes em produção via `/skill:batista-incident` (CloudWatch → investigação → correção → deploy → monitoramento), busca web via OpenRouter e mensagens Discord.

## Instalação

```bash
# Instalar no projeto (caminho absoluto ou relativo ao settings)
pi install /home/allanbatista/Workspaces/allanbatista/my-pi-packages

# Experimentar sem instalar
pi -e /home/allanbatista/Workspaces/allanbatista/my-pi-packages
```

## Dependências

### Extensões do Pi (runtime)

| Extensão | Obrigatória | Uso |
|---|---|---|
| [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) | Sim | Extensão que dá agents autônomos ao Pi. Fornece as tools `Agent` (spawn), `get_subagent_result` (aguardar/ler resultado de background) e `steer_subagent` (redirecionar em execução), o comando `/agents` (menu de gestão) e o mecanismo de **custom agents** (`.pi/agents/`, `.agents/agents/`, `~/.pi/agent/agents/`) usado por todos os managers (`batista-loop`, `batista-manifest`, `batista-execute`) e pelo `batista-ship-pr-to-deploy`. Instale com `pi install npm:@tintinweb/pi-subagents`. Sintaxe e capacidades completas: `references/PI_ADAPTATION.md`. |

> Nota: existe um pacote npm distinto e não escopado chamado `pi-subagents`; o workflow deste pacote usa exclusivamente `@tintinweb/pi-subagents`. Sem a extensão, os managers gravam `Status: blocked` e instruem a instalação — nunca simulam guardian/worker/validador inline (ver `references/PI_ADAPTATION.md`).

### Papéis do workflow (custom agents)

Os papéis usados pelos managers são custom agents definidos em `agents/` deste pacote. A extensão não lê `pi.subagents.agents` de packages nesta versão — **instale os papéis copiando para o runtime**:

```bash
mkdir -p ~/.pi/agent/agents
cp agents/*.md ~/.pi/agent/agents/
# ou por projeto: cp agents/*.md <projeto>/.pi/agents/
```

| Papel | `subagent_type` | Tools | Modelo (frontmatter) |
|---|---|---|---|
| `delegate` | autor de spec/ux/arch/plan/validation | read, bash, edit, write, grep, find, ls | herda a sessão |
| `worker` | implementação | read, bash, edit, write, grep, find, ls | sem pin; default `openai-codex/gpt-5.6-luna`, thinking `low` |
| `workflow-validator` | validação de execução | read, grep, find, ls (read-only) | sem pin; default `openai-codex/gpt-5.6-luna`, thinking `high` |
| `artifact-guardian` | guardian de artefato/outcome | read, grep, find, ls (read-only) | herda a sessão |

### Ferramentas de sistema

| Ferramenta | Uso |
|---|---|
| CLI Pi | runtime do pacote (skills, agents, extensões) |
| `gh` (GitHub CLI) | `batista-ship-pr-to-deploy`: PR, code review, CI, merge, tags e release notes |
| `python3` + `rtk` | scripts auxiliares das skills (`discord_message.py`, `websearch.py`) via `rtk proxy` |

### Variáveis de ambiente (segredos)

| Variável | Skill |
|---|---|
| `OPENROUTER_API_KEY` | `batista-websearch` (OpenRouter Web Search Plugin) |
| `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT` | `batista-discord-webhook-messages` |
| `DISCORD_APP_MY_MY_DEV_BOT_APP_ID` | `batista-discord-webhook-messages` |
| `DISCORD_APP_MY_MY_DEV_BOT_PUBBLIC_KEY` | `batista-discord-webhook-messages` |
| `DISCORD_APP_MY_MY_DEV_BOT_WEBHOOK_TOKEN` | `batista-discord-webhook-messages` |

### Desenvolvimento

- `node`/`npm`: testes (`npm test`, `npm run test:pi`, `npm run test:e2e`).
- `npx skills-ref`: validação de cada skill, executada por `scripts/validate.sh`.

## Extensões

- `extensions/`: diretório convencional de extensões do Pi (carrega arquivos `.ts`/`.js`).
- `extensions/prompt-cache-isolation.js`: adiciona `prompt_cache_key` por sessão ao body de requests `openai-completions` dos providers configurados. Não há provider implícito; configure-os em `promptCacheIsolation.providers`.
- `extensions/agent-metadata.js`: adiciona `_agent_metadata` a cada payload de provider, compatível com Pi e OMP. Cada item tem `{key, value}` e inclui sessão, sessão pai (se subagent), papel do agente (`main` ou `sub`), título/nome da sessão, agente, versão, sistema operacional, hostname, timezone, request e modelo.

Instale o pacote para que Pi/OMP carreguem as extensions declaradas em `pi.extensions` e `omp.extensions`:

```bash
pi install /home/allanbatista/Workspaces/allanbatista/my-pi-packages
```

Configure os providers no projeto em `.pi/settings.json` (Pi) ou `.omp/settings.json` (OMP), ou globalmente em `~/.pi/agent/settings.json` e `~/.omp/agent/settings.json`:

```json
{
  "promptCacheIsolation": {
    "providers": ["batista", "antigravity"]
  }
}
```

Use `"enabled": false` para desativar no settings de maior prioridade. A precedência é projeto Pi → projeto OMP → global Pi → global OMP → `PI_PROMPT_CACHE_ISOLATION_PROVIDERS`.

Para um teste isolado, use `pi --extension` ou `omp --extension` com o arquivo da extension.

A chave é baseada no `sessionId` do Pi, portanto cada subagent recebe uma chave própria desde o primeiro request e a conserva nos turnos seguintes. Cada request elegível também registra `provider`, `sessionId`, `promptCacheKey` e `applied` no log do OMP (`~/.omp/logs/omp.*.log`). A extension altera somente `body.prompt_cache_key`; ela não adiciona headers HTTP como `x-session-id`. O workflow continua dependendo da extensão externa `@tintinweb/pi-subagents` (tools `Agent`/`get_subagent_result`/`steer_subagent`, comando `/agents`) e dos papéis custom deste pacote em `agents/` (instalados em `~/.pi/agent/agents/` ou `.pi/agents/`). Settings operacionais da extensão: `examples/subagents.json` para `~/.pi/agent/subagents.json` (global) ou `.pi/subagents.json` (projeto).

## Skills

| Skill | Invocação | Uso |
|---|---|---|
| batista-loop | `/skill:batista-loop` | Objetivo ponta a ponta, autopilot, decomposição, worktrees |
| batista-manifest | `/skill:batista-manifest` | Workflow completo (spec → ux ∥ arch → plan) |
| batista-spec | `/skill:batista-spec` | Especificação de produto, DoD, clarificações |
| batista-ux | `/skill:batista-ux` | Usabilidade e fluxos (quando há frontend) |
| batista-arch | `/skill:batista-arch` | Arquitetura e contratos (quando há backend) |
| batista-plan | `/skill:batista-plan` | Plano técnico, Impact Map, paralelismo |
| batista-validation | `/skill:batista-validation` | Plano de validação e progresso (`validation.md`) — formula o Validation Plan antes de validar |
| batista-execute | `/skill:batista-execute` | Coordenação de workers e validação |
| batista-memory | `/skill:batista-memory` | Memória técnica de entidades/componentes em `memory/<dominio>/` |
| batista-ship-pr-to-deploy | `/skill:batista-ship-pr-to-deploy` | Entrega ponta a ponta: commit → PR → CR → CI → merge → tag → deploy → release note |
| batista-discord-webhook-messages | `/skill:batista-discord-webhook-messages` | Mensagens Discord por sessão via bot (`scripts/discord_message.py`) |
| batista-websearch | `/skill:batista-websearch` | Busca web com respostas fundamentadas via OpenRouter Web Search Plugin (`scripts/websearch.py`) |
| batista-worktree | `/skill:batista-worktree` | Orquestração de Git worktrees isolados com SQLite (`scripts/wt.sh`) |
| batista-incident | `/skill:batista-incident` | Incidente em produção — CloudWatch, investigação, correção, deploy, monitoramento |

## Validação

O pipeline valida cada feature com evidências via subagents (`worker` produz evidência, `workflow-validator` confere item a item), com o plano formulado **antes** de validar. A skill `batista-validation` (`/skill:batista-validation`) cria `validation.md` na feature, lado a lado com `spec.md`/`plan.md`, com o `Validation Plan` (itens `V#`, método/evidência esperada) e o `Validation Progress` (status pass/fail/pending + evidência por item, conferido pelo `workflow-validator`).

```bash
./scripts/validate.sh   # estrutura, skills-ref, resíduos Codex
npm test                # estrutura + invocação Pi (modelo confiável)
npm run test:pi         # canários de invocação real via /skill:*
npm run test:e2e        # E2E real do loop (lento)
```
