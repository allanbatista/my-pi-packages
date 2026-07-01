# Pi Runtime Adaptation

No Pi, **delegação inline é o padrão**. APIs Codex (`spawn_agent`, `fork_context`, model pinning) são opcionais — use-as só quando o runtime oferecer paridade.

## Delegação inline (padrão Pi)

1. **Contexto mínimo**: limite o contexto ativo a pedido, paths, `AGENTS.md`, feature dir e docs necessários.
2. **Skills filhas**: invoque `/skill:<name>` com prompt explícito contendo só o que um subagent receberia.
3. **Guardians**: passo separado na mesma sessão — leia artefato, aplique rubrica, reporte `approved`/`rejected` **sem editar arquivos** no papel de guardian.
4. **Paralelismo**: serialize batches quando paralelo indisponível; registre no artefato.
5. **Modelos**: ignore pinning (`gpt-5.*`, `reasoning_effort`) quando não suportado.

## Managers

| Skill | Delegação inline |
|---|---|
| `loop` | `/skill:manifest` → `/skill:execute` |
| `manifest` | `/skill:spec` → `/skill:ux` + `/skill:arch` → `/skill:plan` |
| `execute` | worker (implementa) → validador (aprova evidência), passos separados |

## Subagent opcional

Quando `spawn_agent` existir, pode substituir delegação inline mantendo as mesmas regras de contexto mínimo e papéis separados (worker ≠ validador ≠ guardian).

## O que NÃO fazer

- Não bloqueie só porque `spawn_agent` ou `fork_context` falhou.
- Não abandone o workflow; declare limitação na `Final Response`.