# Ship PR to Deploy

## Responsabilidade

Publicar mudanças locais até o deploy: PR, CR independente, CI, merge, tag de versão e release note.

## Entidades

- `head_sha`, `reviewed_sha`, `green_sha`: SHAs de gate do loop de entrega.
- Tag de versão SemVer (`v*`) no SHA do merge.

## Relações

- Delega CR ao agent builtin `reviewer` (read-only, `context: fresh`) via ferramenta `subagent`.
- Publica release note via `skills/batista-discord-webhook-messages/scripts/discord_message.py` no canal `releases`.

## Fluxo

1. Preparar e publicar → 2. CR com subagente → 3. corrigir/responder threads → 4. monitorar CI → 5. merge (SHA único revisado e verde) → 6. tag → 7. deploy → 8. release note. Novo commit volta à etapa 2.

## Fontes no código

- `skills/batista-ship-pr-to-deploy/SKILL.md`
