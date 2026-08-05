---
name: batista-websearch
description: "Buscar informações atuais na web com respostas fundamentadas e citações via OpenRouter Web Search Plugin (chat completions), com modelo default `~deepseek/deepseek-v4-flash-latest`. Use como `/skill:batista-websearch` quando o usuário pedir pesquisa, busca, notícias, documentação atual, preços, eventos, verificação de fatos ou qualquer informação que o conhecimento do modelo não cobre com segurança."
---

# Web Search via OpenRouter

Usar somente `scripts/websearch.py` (caminho relativo a esta pasta de skill: `skills/batista-websearch/scripts/websearch.py`). Exigir `OPENROUTER_API_KEY`; tratar como segredo e nunca exibi-la.

| Variável | Uso |
| --- | --- |
| `OPENROUTER_API_KEY` | autenticar as chamadas REST ao OpenRouter |

## Buscar

```bash
set -a; source /home/allanbatista/.secrets; set +a
rtk proxy python3 skills/batista-websearch/scripts/websearch.py --query "última versão estável do Node.js"
```

O modelo default é `~deepseek/deepseek-v4-flash-latest` (balanceamento de provedores do OpenRouter). Sobrescrever com `--model` quando outro modelo for necessário.

## Opções

| Opção | Default | Descrição |
| --- | --- | --- |
| `--query` | obrigatória | pergunta ou termo da busca; incluir contexto e data quando relevantes |
| `--model` | `~deepseek/deepseek-v4-flash-latest` | modelo que responde com os resultados |
| `--engine` | auto | `exa`, `native`, `firecrawl`, `parallel` ou `perplexity`; sem flag, usa native quando o modelo suporta, senão Exa |
| `--max-results` | `5` | máximo de resultados (1–10) |
| `--include-domain` | — | restringe a domínios (repetível; suporta `*.substack.com` e path `openai.com/blog`) |
| `--exclude-domain` | — | exclui domínios (repetível) |
| `--json` | — | imprime o resultado completo em JSON (content + citações com `url`, `title`, `content`) |

```bash
rtk proxy python3 skills/batista-websearch/scripts/websearch.py \
  --query "anúncios recentes do React 19" \
  --max-results 3 --include-domain react.dev --include-domain github.com

rtk proxy python3 skills/batista-websearch/scripts/websearch.py \
  --query "preço do OpenRouter exa por request" --engine exa --json
```

## Preço

- **Exa** (default para modelos sem native search, incluindo o default DeepSeek): `$0.005` por request, com até 10 resultados; resultado adicional `$0.001` cada.
- **Parallel**: `$0.001` por request (até 10 resultados).
- **Perplexity**: `$0.005` por request.
- **Native**: pass-through do provedor (varia por modelo).
- **Firecrawl**: BYOK, cobra créditos Firecrawl.

Usar `--max-results` baixo (1–3) quando só a resposta objetiva importa; reservar 5+ para pesquisa.

## Regras

- Responder ao usuário usando somente o conteúdo das citações retornadas (`url`, `title`, `content`); nunca inventar URLs nem fatos. No modo texto, o script já lista as fontes; conferir o `content` de cada citação antes de afirmar algo.
- Citar fontes com links markdown nomeados pelo domínio, exemplo: `[nodejs.org](https://nodejs.org)`.
- Se os resultados não responderem à pergunta, dizer explicitamente o que não foi encontrado e sugerir nova query com outros termos ou domínios.
- Incluir data e recorte na `--query` quando a informação for sensível a tempo (notícias, preços, versões, eventos).
- Nunca exibir `OPENROUTER_API_KEY` em comando, log, output ou conversa; erros HTTP já vêm sem segredo no detalhe.
- Erro da API é bloqueio: reportar status HTTP e detalhe retornado; não contornar com achismo.
- Limite `--max-results` a 1–10 (validação do script).

Fonte: https://openrouter.ai/docs/guides/features/plugins/web-search
