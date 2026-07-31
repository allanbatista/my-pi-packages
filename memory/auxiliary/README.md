# Auxiliary Skills

## Responsabilidade

Skills auxiliares do package fora do feature workflow: memória de entidades, entrega de PR até o deploy e mensagens Discord por sessão.

## Componentes

- [ENTITY_MEMORY.md](./batista-ENTITY_MEMORY.md): playbook de memória técnica em `memory/<dominio>/`.
- [SHIP_PR_TO_DEPLOY.md](./batista-SHIP_PR_TO_DEPLOY.md): entrega ponta a ponta (commit → PR → CR → CI → merge → tag → deploy → release).
- [DISCORD.md](./batista-DISCORD.md): mensagens Discord via bot, por sessão e canal.

## Relações

```mermaid
flowchart LR
  Ship --> Discord
  Ship --> Reviewer
  EntityMemory --> memoryDir[(memory/&lt;dominio&gt;/)]
```

## Fontes no código

- `skills/batista-entity-memory-playbook/SKILL.md`
- `skills/batista-ship-pr-to-deploy/SKILL.md`
- `skills/batista-discord-webhook-messages/SKILL.md`
- `skills/batista-discord-webhook-messages/scripts/discord_message.py`
