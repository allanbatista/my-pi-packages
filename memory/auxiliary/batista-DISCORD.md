# Discord Messages

## Responsabilidade

Publicar e gerenciar mensagens e anexos do Discord via bot, em threads por sessão e canal, com identidade hierárquica.

## Entidades

- Threads: uma por (sessão, canal, agent); persistidas em `$DISCORD_AGENTS_STATE_DIR` (default `~/.local/state/discord-agent-messages`).
- Canais: `working`, `pull-requests`, `releases`, `geral`.

## Relações

- Consumida por `batista-ship-pr-to-deploy` para release notes em `releases`.
- Sessão resolvida por `PI_SESSION_ID`, `CODEX_THREAD_ID` ou equivalentes.

## Fluxo

`send`/`ask`/`get`/`edit`/`delete` via `scripts/discord_message.py`; identidade `--agent` + cadeia `--name`; `ask` com poll e polling de 15s até 24h.

## Fontes no código

- `skills/batista-discord-webhook-messages/SKILL.md`
- `skills/batista-discord-webhook-messages/scripts/discord_message.py`
- `skills/batista-discord-webhook-messages/scripts/test_discord_message.py`
