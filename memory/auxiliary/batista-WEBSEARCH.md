# Web Search

## Responsabilidade

Buscar informações atuais na web com respostas fundamentadas e citações via OpenRouter Web Search Plugin (chat completions).

## Entidades

- Credencial `OPENROUTER_API_KEY` (autenticação REST).
- Modelo default `~deepseek/deepseek-v4-flash-latest` (balanceamento de provedores).
- Plugin `web` com `engine` (exa/native/firecrawl/parallel/perplexity), `max_results`, `include_domains`, `exclude_domains`.
- Resultados padronizados em `message.annotations[].url_citation` (`url`, `title`, `content`).

## Relações

Skill auxiliar independente do feature workflow; qualquer skill/agente usa para informação fora do conhecimento do modelo. Consome a API REST do OpenRouter.

## Fontes no código

- `skills/batista-websearch/SKILL.md`
- `skills/batista-websearch/scripts/websearch.py`
