# Prompt Cache Isolation

## Responsabilidade

Adicionar uma chave de cache estável e exclusiva para cada sessão OMP/pi antes do envio de requests `openai-completions`.

## Entidades

- `PromptCacheIsolationExtension`: registra o hook `before_provider_request`.
- `sessionId`: identificador persistente da sessão usado como origem da chave.
- `prompt_cache_key`: campo de body enviado ao provider/proxy.
- `prompt-cache-isolation`: evento de log com a chave, provider, sessão e indicação de alteração do payload.
- `promptCacheIsolation.providers`: allowlist declarada em `.pi/settings.json` ou `.omp/settings.json`.
- `~/.pi/agent/settings.json` e `~/.omp/agent/settings.json`: allowlist global, depois dos settings do projeto.
- `PI_PROMPT_CACHE_ISOLATION_PROVIDERS`: fallback da allowlist quando nenhum arquivo de projeto define a seção.

## Relações

`ProjectSettings/GlobalSettings` → `providers` → `SessionManager.getSessionId()` → `getPromptCacheKey()` → `before_provider_request` → `prompt_cache_key` → proxy.

Requests que já possuem `prompt_cache_key` são preservados. O mecanismo não modifica headers HTTP e não expõe o `taskId` interno; a unidade de isolamento é a sessão do subagent.

## Fluxo

1. O Pi/OMP carrega `promptCacheIsolation.providers` do settings do projeto.
2. O Pi/OMP cria uma sessão para o agente principal ou subagent.
3. A extension recebe o payload final no hook `before_provider_request`.
4. Para um provider allowlisted com API `openai-completions`, deriva `omp-<sessionId>`.
5. Retorna uma cópia do payload com `prompt_cache_key`, sem mutar o objeto original.
6. Registra a chave no log sem inseri-la na prompt.
7. O proxy pode usar a chave para selecionar um conversation/cache shard próprio.

## Fontes no código

- `extensions/prompt-cache-isolation.js`
- `test/prompt-cache-isolation.test.mjs`
- `/home/allanbatista/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/types.ts`
- `/home/allanbatista/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/runner.ts`
