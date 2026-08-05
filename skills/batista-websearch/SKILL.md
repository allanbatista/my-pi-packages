---
name: batista-websearch
description: "Search current information on the web with sourced answers and citations via OpenRouter Web Search Plugin (chat completions), default model `~deepseek/deepseek-v4-flash-latest`. Use as `/skill:batista-websearch` when the user asks for search, research, news, current documentation, prices, events, fact-checking, or any information the model's knowledge cannot cover safely."
---

# Web Search via OpenRouter

Use only `scripts/websearch.py` (relative to this skill folder: `skills/batista-websearch/scripts/websearch.py`). Requires `OPENROUTER_API_KEY`; treat as secret, never display it.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | authenticates REST calls to OpenRouter |

## Search

```bash
set -a; source /home/allanbatista/.secrets; set +a
rtk proxy python3 skills/batista-websearch/scripts/websearch.py --query "latest stable Node.js version"
```

Default model: `~deepseek/deepseek-v4-flash-latest` (OpenRouter provider balancing). Override with `--model` when needed.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--query` | required | search question/term; include context and date when relevant |
| `--model` | `~deepseek/deepseek-v4-flash-latest` | model that answers from the results |
| `--engine` | auto | `exa`, `native`, `firecrawl`, `parallel` or `perplexity`; without flag, uses native when the model supports it, else Exa |
| `--max-results` | `5` | max results (1–10) |
| `--include-domain` | — | restrict to domains (repeatable; supports `*.substack.com` and path `openai.com/blog`) |
| `--exclude-domain` | — | exclude domains (repeatable) |
| `--json` | — | print full result as JSON (content + citations with `url`, `title`, `content`) |

```bash
rtk proxy python3 skills/batista-websearch/scripts/websearch.py \
  --query "recent React 19 announcements" \
  --max-results 3 --include-domain react.dev --include-domain github.com

rtk proxy python3 skills/batista-websearch/scripts/websearch.py \
  --query "OpenRouter exa price per request" --engine exa --json
```

## Pricing

- **Exa** (default for models without native search, including the default DeepSeek): `$0.005` per request, up to 10 results; extra result `$0.001` each.
- **Parallel**: `$0.001` per request (up to 10 results).
- **Perplexity**: `$0.005` per request.
- **Native**: provider pass-through (varies by model).
- **Firecrawl**: BYOK, charges Firecrawl credits.

Use low `--max-results` (1–3) when only the objective answer matters; keep 5+ for research.

## Rules

- Answer using only the returned citations' content (`url`, `title`, `content`); never invent URLs or facts. In text mode the script lists sources; check each citation's `content` before asserting.
- Cite sources with markdown links named by domain, e.g. `[nodejs.org](https://nodejs.org)`.
- If results don't answer the question, state explicitly what wasn't found and suggest a new query with other terms or domains.
- Include date and scope in `--query` when the info is time-sensitive (news, prices, versions, events).
- Never display `OPENROUTER_API_KEY` in commands, logs, output or conversation; HTTP errors already exclude the secret from detail.
- API error is a blocker: report the HTTP status and returned detail; don't work around it with guessing.
- Keep `--max-results` within 1–10 (script validation).

Source: https://openrouter.ai/docs/guides/features/plugins/web-search
