# Política de modelos por papel

Referência normativa: `references/PI_ADAPTATION.md` (interface real da extensão v0.14.x). **Nenhum papel pina `model`/`thinking` no frontmatter**: o modelo indicado pelo usuário (modelo ativo da sessão raiz ou pedido explícito) sempre prevalece. A extensão pina o que está no frontmatter e ignora a chamada — por isso o frontmatter dos agent files deste package **não declara** `model`/`thinking`.

## Indicação default (quando disponível)

Sem indicação contrária do usuário, o padrão por papel é: **write code = low effort, validation = high effort**.

| Papel | subagent_type | Indicação default | Thinking |
|---|---|---|---|
| Worker | `worker` | `openai-codex/gpt-5.6-luna` | `low` (write code = low effort) |
| Validador | `workflow-validator` | `openai-codex/gpt-5.6-luna` | `high` (validation = high effort) |
| Autoria/guardian | `delegate` / `artifact-guardian` | herda a sessão raiz | — |

A indicação vive apenas em `references/MODEL_POLICY.md` (e como comentário no frontmatter dos agent files), nunca como pin.

## Precedência

1. **Modelo/thinking indicados pelo usuário** — pedido explícito (ex.: "use luna/max") ou modelo ativo da sessão raiz. O manager repassa `model`/`thinking` na chamada `Agent(...)` **somente** quando há pedido explícito; caso contrário omite e o child herda o modelo da sessão raiz (que é a indicação do usuário). O modelo ativo da sessão pode ser conferido via env `PI_*` do harness. Quando o usuário indica apenas o modelo, o thinking segue a indicação default do papel (worker `low`, validador `high`).
2. **Herança da sessão raiz** — quando a chamada omite `model`/`thinking` e o frontmatter não pina (default do workflow).
3. **Default global do Pi** — último recurso da extensão.

O frontmatter dos agent files nunca sobrescreve a chamada: ele não declara `model`/`thinking`. `model`/`thinking` passados na chamada valem para aquele dispatch; indisponível no runtime → registrar e seguir com herança (ou blocker quando o pedido for material).

## Verificação

- `/agents → Agent types` — lista os papéis com o modelo efetivo e flag `(unavailable, fallback: inherit)` quando um pin não resolve.
- `/scoped-models` (opcional, `scopeModels: true` em `subagents.json`) — valida modelo contra `enabledModels`.
- Conferência por arquivo: `~/.pi/agent/agents/{worker,workflow-validator}.md` (e `.pi/agents/` do projeto) — **não** devem conter `model:`/`thinking:`.
- **Deriva package ↔ instalado**: o frontmatter deste package é a fonte da verdade. `scripts/validate.sh` (check `agents-drift`) falha quando `model`/`thinking`/`tools`/`extensions` de um papel instalado divergem do package — inclusive pin reintroduzido no instalado (correção manual ou reinstalação parcial que ressuscita pins antigos).
