# Política de modelos por papel

Referência normativa: `references/PI_ADAPTATION.md` (interface real da extensão v0.14.x). **A política de modelo e thinking por papel vive no frontmatter dos agent files** (`agents/*.md`), que é autoritativo na extensão — a chamada `Agent(...)` não sobrescreve `model`/`thinking` pinados no arquivo.

## Planejamento

Autoria (`batista-spec`, `batista-ux`, `batista-arch`, `batista-plan`) usa `subagent_type: "delegate"`; guardians de artefato e outcome usam `subagent_type: "artifact-guardian"`. Ambos **não pinam modelo** no frontmatter: herdam o modelo ativo da sessão raiz (`model: "inherit"`). A extensão não expõe o thinking ativo como parâmetro de herança; o effort segue a configuração efetiva da sessão — verifique com `/agents → Agent types` quando paridade estrita de effort for requisito.

## Execução

| Papel | subagent_type | Modelo (frontmatter) | Thinking (frontmatter) |
|---|---|---|---|
| Worker | `worker` | `deepseek/deepseek-v4-flash` | `off` |
| Validador | `workflow-validator` | `deepseek/deepseek-v4-flash` | `xhigh` |

O frontmatter dos agent files garante a política mesmo quando a chamada omite `model`/`thinking` (padrão do workflow):

```yaml
# agents/worker.md
model: deepseek/deepseek-v4-flash
thinking: off
```

O manager não implementa nem valida. Worker e validador são children distintos; o validador possui somente `read`, `grep`, `find` e `ls`.

## Precedência

1. Frontmatter do agent file (`model`/`thinking` pinados — autoritativo, não sobrescrevível por chamada)
2. Parâmetro `model`/`thinking` da chamada `Agent(...)` (apenas quando o frontmatter não pina)
3. Modelo herdado da sessão raiz
4. Default global do Pi

## Verificação

- `/agents → Agent types` — lista os papéis com o modelo efetivo e flag `(unavailable, fallback: inherit)` quando um pin não resolve.
- `/scoped-models` (opcional, `scopeModels: true` em `subagents.json`) — valida modelo contra `enabledModels`; pin de frontmatter fora do escopo roda com aviso (frontmatter é autoritativo).
- Conferência por arquivo: `~/.pi/agent/agents/{worker,workflow-validator}.md` (e `.pi/agents/` do projeto).
