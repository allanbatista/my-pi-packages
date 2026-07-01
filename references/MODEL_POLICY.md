# Política de modelos por papel

Fonte da verdade para pinning de modelo no feature-workflow. Requer `pi-subagents` quando a delegação for via subagent; em delegação inline, o manager aplica a mesma política ao escolher modelo/effort do turno filho.

## Planejamento (herda sessão principal)

Skills e papéis de **autoria/planejamento** usam o **mesmo modelo e effort (thinking/reasoning) da sessão principal** — sem override.

| Skill / papel | Escopo |
|---|---|
| `/skill:loop` | manager de épico |
| `/skill:manifest` | manager de autoria |
| `/skill:spec`, `/skill:ux`, `/skill:arch`, `/skill:plan` | autoria de artefatos |
| Guardian de spec/ux/arch/plan | validação de artefato (fase de planejamento) |
| Outcome guardian do `loop` | validação de objetivo (fase de planejamento/coordenação) |

**Como aplicar (pi-subagents):** use `planner`, `oracle` ou `delegate` **sem** `agentOverrides.model` / `agentOverrides.thinking`. Não use o agente `reviewer` para guardians de planejamento — ele está pinado para validação de execução.

**Inline:** o manager não troca modelo; continua na sessão atual.

## Execução (modelos dedicados)

Papéis de **implementação e aceite** na `/skill:execute`:

| Papel | Modelo | Reasoning / thinking |
|---|---|---|
| **Worker** (implementação, correções, gate de fase) | `deepseek/deepseek-v4-flash` | **off** (sem reasoning) |
| **Validador** (aceite independente por task/fase) | `deepseek/deepseek-v4-flash` | **xhigh** |

O manager de execução **não** implementa nem valida — só coordena com esses papéis.

**Como aplicar (pi-subagents):** mapeie worker → agente `worker`; validador → agente `reviewer` (ou agente custom `workflow-validator`). Ver `examples/pi-subagents-settings.json`.

**Override por run (exemplo):**

```text
/run worker[model=deepseek/deepseek-v4-flash] "implementar task 1.1"
/run reviewer[model=deepseek/deepseek-v4-flash,thinking=xhigh] "validar task 1.1"
```

## Precedência

1. Override explícito no spawn/run (quando suportado)
2. `subagents.agentOverrides` em settings
3. Sessão principal (somente fase de planejamento)
4. `defaultModel` do Pi

## Verificação

```text
/subagents-models worker
/subagents-models reviewer
```