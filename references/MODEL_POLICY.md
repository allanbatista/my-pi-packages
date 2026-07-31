# Política de modelos por papel

## Planejamento

Autoria (`spec`, `ux`, `arch`, `plan`) usa `delegate` com `model: "inherit"`. Guardians de artefato e outcome usam `artifact-guardian` com `model: "inherit"`. Ambos usam `context: "fresh"`.

`model: "inherit"` fixa o modelo ativo da sessão no child. O `pi-subagents` atual não expõe o thinking ativo como parâmetro por chamada; portanto o effort segue a configuração efetiva do agente/runtime. Verifique com `/subagents-models` quando paridade estrita de effort for requisito.

## Execução

| Papel | Agent | Modelo por chamada |
|---|---|---|
| Worker | `worker` | `deepseek/deepseek-v4-flash:off` |
| Validador | `workflow-validator` | `deepseek/deepseek-v4-flash:xhigh` |

Use os overrides por chamada para que a política funcione mesmo quando o snippet de settings não foi mesclado:

```text
subagent({ agent: "worker", model: "deepseek/deepseek-v4-flash:off", context: "fresh", cwd: "{project-root}", task: "..." })
subagent({ agent: "workflow-validator", model: "deepseek/deepseek-v4-flash:xhigh", context: "fresh", cwd: "{project-root}", task: "..." })
```

O manager não implementa nem valida. Worker e validador são children distintos; o validador possui somente `read`, `grep`, `find` e `ls`.

## Precedência

1. `model` explícito na chamada
2. `subagents.agentOverrides` em settings
3. Modelo herdado da sessão
4. Default global do Pi

## Verificação

```text
/subagents-models worker
/subagents-models workflow-validator
```
