#!/usr/bin/env python3
"""Search the web through the OpenRouter Web Search Plugin (chat completions)."""

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "~deepseek/deepseek-v4-flash-latest"
DEFAULT_MAX_RESULTS = 5
MAX_MAX_RESULTS = 10
VALID_ENGINES = ("exa", "native", "firecrawl", "parallel", "perplexity")
SYSTEM_PROMPT = (
    "Você é um assistente de busca web. Responda de forma factual e concisa em pt-BR, "
    "sem inventar fatos nem URLs: use somente o conteúdo dos resultados de busca fornecidos "
    "e cite as fontes com links markdown nomeados pelo domínio, por exemplo "
    "[nodejs.org](https://nodejs.org). Se os resultados não responderem à pergunta, "
    "diga explicitamente o que não foi encontrado."
)


def api_key():
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        print(
            "Erro: OPENROUTER_API_KEY não está definida. Carregue ~/.secrets antes de chamar.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return key


def build_payload(args):
    plugin = {"id": "web", "max_results": args.max_results}
    if args.engine:
        plugin["engine"] = args.engine
    if args.include_domains:
        plugin["include_domains"] = args.include_domains
    if args.exclude_domains:
        plugin["exclude_domains"] = args.exclude_domains
    return {
        "model": args.model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": args.query},
        ],
        "plugins": [plugin],
    }


def search(payload, key):
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        f"{API_BASE_URL}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"Erro HTTP {error.code} da API do OpenRouter: {detail}", file=sys.stderr)
        raise SystemExit(1)
    except URLError as error:
        print(f"Falha de rede ao chamar o OpenRouter: {error.reason}", file=sys.stderr)
        raise SystemExit(1)


def extract_message(data, requested_model):
    try:
        choice = data["choices"][0]
    except (KeyError, IndexError):
        print(f"Resposta inesperada da API (sem choices): {json.dumps(data)[:500]}", file=sys.stderr)
        raise SystemExit(1)
    message = choice.get("message", {})
    citations = []
    for annotation in message.get("annotations") or []:
        citation = annotation.get("url_citation") or {}
        url = citation.get("url")
        if url:
            citations.append(
                {
                    "url": url,
                    "title": citation.get("title") or "",
                    "content": citation.get("content") or "",
                }
            )
    return {
        "content": message.get("content") or "",
        "citations": citations,
        "model": data.get("model") or requested_model,
    }


def print_text(result):
    print(f"## Resposta ({result['model']})")
    print(result["content"] or "(sem resposta textual)")
    if result["citations"]:
        print(f"\n## Fontes ({len(result['citations'])})")
        for index, citation in enumerate(result["citations"], 1):
            title = citation["title"] or citation["url"]
            print(f"{index}. [{title}]({citation['url']})")
            content = citation["content"].strip().replace("\n", " ")
            if content:
                print(f"   {content[:300]}{'…' if len(content) > 300 else ''}")


def main():
    parser = argparse.ArgumentParser(
        description="Busca web via OpenRouter Web Search Plugin (chat completions)."
    )
    parser.add_argument("--query", required=True, help="pergunta ou termo da busca")
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"modelo a usar (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--engine",
        choices=VALID_ENGINES,
        help="engine de busca (default: native quando o modelo suporta, senão exa)",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=DEFAULT_MAX_RESULTS,
        help=f"máximo de resultados (default: {DEFAULT_MAX_RESULTS}, máx. {MAX_MAX_RESULTS})",
    )
    parser.add_argument(
        "--include-domain",
        dest="include_domains",
        action="append",
        metavar="DOMAIN",
        help="restringe a domínios (repetível; suporta *.substack.com e path openai.com/blog)",
    )
    parser.add_argument(
        "--exclude-domain",
        dest="exclude_domains",
        action="append",
        metavar="DOMAIN",
        help="exclui domínios (repetível)",
    )
    parser.add_argument("--json", action="store_true", help="imprime o resultado completo em JSON")
    args = parser.parse_args()

    if not 1 <= args.max_results <= MAX_MAX_RESULTS:
        parser.error(f"--max-results deve estar entre 1 e {MAX_MAX_RESULTS}")

    payload = build_payload(args)
    result = extract_message(search(payload, api_key()), payload["model"])
    if args.json:
        print(json.dumps({"query": args.query, **result}, ensure_ascii=False, indent=2))
    else:
        print_text(result)


if __name__ == "__main__":
    main()
