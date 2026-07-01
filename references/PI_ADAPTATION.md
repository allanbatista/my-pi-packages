# Pi Runtime Adaptation

Este pacote foi portado do Codex para Pi. As skills descrevem delegação via `spawn_agent`, `fork_context: false` e model pinning herdados do Codex — use-as quando o runtime Pi oferecer paridade. Quando não oferecer, **não bloqueie o workflow**: degrade graciosamente conforme abaixo.

## Delegação sem subagent

1. **Execução inline com isolamento**: na mesma sessão, limite o contexto ativo a pedido, paths, `AGENTS.md`, feature dir e docs necessários. Não herde transcripts irrelevantes.
2. **Skills filhas**: invoque via `/skill:<name>` com prompt explícito contendo só o contexto mínimo que um subagent receberia.
3. **Guardians**: rode como passo separado na mesma sessão — leia o artefato, aplique a rubrica da skill, reporte `approved`/`rejected` sem editar arquivos no papel de guardian.
4. **Paralelismo**: sem subagents paralelos, serialize batches verificando write sets disjuntos; registre no artefato que o batch foi serializado por limitação de runtime.
5. **Modelos**: ignore pinning (`gpt-5.*`, `reasoning_effort`) quando não suportado; use o modelo disponível no Pi.

## Managers (`loop`, `manifest`, `execute`)

- `loop` → invoque `/skill:manifest` e `/skill:execute` inline quando `spawn_agent` não existir.
- `manifest` → invoque `/skill:spec`, `/skill:ux`, `/skill:arch`, `/skill:plan` inline; serialize `ux`∥`arch` se paralelo indisponível.
- `execute` → implemente e valide inline em passos separados (worker depois validador), sem compartilhar raciocínio entre os papéis.

## O que NÃO fazer

- Não registre blocker só porque `spawn_agent` ou `fork_context` falhou — tente fallback inline primeiro.
- Não abandone o workflow; declare a limitação na resposta final (`Final Response`).