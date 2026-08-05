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
    "You are a web search assistant. Answer factually and concisely in en-US, "
    "without inventing facts or URLs: use only the content of the provided search results "
    "and cite sources with markdown links named by domain, e.g. "
    "[nodejs.org](https://nodejs.org). If the results don't answer the question, "
    "state explicitly what was not found."
)


def api_key():
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        print(
            "Error: OPENROUTER_API_KEY is not set. Load ~/.secrets before calling.",
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
        print(f"HTTP error {error.code} from OpenRouter API: {detail}", file=sys.stderr)
        raise SystemExit(1)
    except URLError as error:
        print(f"Network failure calling OpenRouter: {error.reason}", file=sys.stderr)
        raise SystemExit(1)


def extract_message(data, requested_model):
    try:
        choice = data["choices"][0]
    except (KeyError, IndexError):
        print(f"Unexpected API response (no choices): {json.dumps(data)[:500]}", file=sys.stderr)
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
    print(f"## Answer ({result['model']})")
    print(result["content"] or "(no textual answer)")
    if result["citations"]:
        print(f"\n## Sources ({len(result['citations'])})")
        for index, citation in enumerate(result["citations"], 1):
            title = citation["title"] or citation["url"]
            print(f"{index}. [{title}]({citation['url']})")
            content = citation["content"].strip().replace("\n", " ")
            if content:
                print(f"   {content[:300]}{'…' if len(content) > 300 else ''}")


def main():
    parser = argparse.ArgumentParser(
        description="Web search via OpenRouter Web Search Plugin (chat completions)."
    )
    parser.add_argument("--query", required=True, help="search question or term")
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--engine",
        choices=VALID_ENGINES,
        help="search engine (default: native when the model supports it, else exa)",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=DEFAULT_MAX_RESULTS,
        help=f"max results (default: {DEFAULT_MAX_RESULTS}, max {MAX_MAX_RESULTS})",
    )
    parser.add_argument(
        "--include-domain",
        dest="include_domains",
        action="append",
        metavar="DOMAIN",
        help="restrict to domains (repeatable; supports *.substack.com and path openai.com/blog)",
    )
    parser.add_argument(
        "--exclude-domain",
        dest="exclude_domains",
        action="append",
        metavar="DOMAIN",
        help="exclude domains (repeatable)",
    )
    parser.add_argument("--json", action="store_true", help="print full result as JSON")
    args = parser.parse_args()

    if not 1 <= args.max_results <= MAX_MAX_RESULTS:
        parser.error(f"--max-results must be between 1 and {MAX_MAX_RESULTS}")

    payload = build_payload(args)
    result = extract_message(search(payload, api_key()), payload["model"])
    if args.json:
        print(json.dumps({"query": args.query, **result}, ensure_ascii=False, indent=2))
    else:
        print_text(result)


if __name__ == "__main__":
    main()
