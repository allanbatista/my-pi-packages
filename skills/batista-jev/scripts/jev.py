#!/usr/bin/env python3
"""Submit typed JEV judgments through the OpenRouter Decisions API."""

import argparse
import json
import math
import os
import re
import sys
from email.utils import format_datetime, parsedate_to_datetime
from pathlib import Path
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

ENDPOINT = "https://openrouter.ai/api/alpha/decisions"
DEFAULT_MODEL = "typesafe/jev-1.13"
REQUEST_FIELDS = frozenset({"model", "state", "questions", "provider", "session_id", "trace", "user"})
MODEL_PATTERN = re.compile(r"~?typesafe/jev-[A-Za-z0-9][A-Za-z0-9._-]*\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def content(value):
    return isinstance(value, (str, dict, list)) and bool(value) and (
        not isinstance(value, str) or bool(value.strip())
    )


def number(value, low, high):
    return type(value) in (int, float) and (type(value) is int or math.isfinite(value)) and low <= value <= high


def parse_json(raw):
    def reject_constant(_):
        raise ValueError("JSON não permite NaN ou Infinity.")

    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "JSON contém uma chave duplicada.")
            result[key] = value
        return result

    try:
        return json.loads(raw, parse_constant=reject_constant, object_pairs_hook=unique_object)
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ValueError("JSON inválido ou codificação diferente de UTF-8.") from error


def validate_request(payload):
    require(isinstance(payload, dict), "A requisição deve ser um objeto JSON.")
    require(not (set(payload) - REQUEST_FIELDS), "Campos de requisição não suportados.")
    model = payload.get("model")
    require(isinstance(model, str) and MODEL_PATTERN.fullmatch(model),
            "Informe um modelo JEV da TypeSafe.")
    require(content(payload.get("state")), "state deve ser texto, objeto ou array não vazio.")
    questions = payload.get("questions")
    require(isinstance(questions, dict) and bool(questions), "questions deve ser um objeto não vazio.")
    for key, question in questions.items():
        require(isinstance(key, str) and bool(key.strip()), "ID de pergunta vazio.")
        require(isinstance(question, dict), "Cada pergunta deve ser um objeto.")
        kind = question.get("type")
        require(kind in ("noul", "choice", "score"), "Tipo de pergunta inválido.")
        require(content(question.get("instructions")), "instructions deve conter a pergunta.")
        criteria = question.get("criteria")
        if kind == "choice":
            require(isinstance(criteria, dict) and 2 <= len(criteria) <= 255,
                    "Choice exige entre 2 e 255 opções.")
            require(all(isinstance(option, str) and option.strip() for option in criteria),
                    "Choice contém opção vazia.")
        elif kind == "score":
            require(isinstance(criteria, list) and 2 <= len(criteria) <= 10,
                    "Score exige entre 2 e 10 níveis ordenados.")
        elif "criteria" in question:
            require(isinstance(criteria, dict) and set(criteria) == {"true", "false"},
                    "Noul criteria deve definir true e false.")
        if criteria is not None:
            values = criteria.values() if isinstance(criteria, dict) else criteria
            require(all(content(value) for value in values), "Descrição de critério vazia ou inválida.")
    for key in ("provider", "trace"):
        if key in payload:
            require(isinstance(payload[key], dict) or (key == "provider" and payload[key] is None),
                    "provider/trace deve ser um objeto; provider também admite null.")
    if "session_id" in payload:
        require(isinstance(payload["session_id"], str) and 0 < len(payload["session_id"]) <= 256,
                "session_id deve ter de 1 a 256 caracteres.")
    if "user" in payload:
        require(isinstance(payload["user"], str) and 0 < len(payload["user"]) <= 256,
                "user deve ter de 1 a 256 caracteres.")
    json.dumps(payload, allow_nan=False)


def validate_response(result, questions):
    require(isinstance(result, dict) and "error" not in result, "A API não retornou uma decisão válida.")
    for field in ("id", "model"):
        require(isinstance(result.get(field), str) and bool(result[field].strip()),
                "A resposta não contém ID/modelo válido.")
    answers = result.get("answers")
    require(isinstance(answers, dict) and set(answers) == set(questions),
            "A resposta não corresponde às perguntas enviadas.")
    for key, question in questions.items():
        answer = answers[key]
        kind = question["type"]
        require(isinstance(answer, dict) and answer.get("type") == kind,
                "Tipo de resposta ausente ou diferente da pergunta.")
        if kind == "noul":
            require(number(answer.get("noul"), 0, 1), "Noul inválido: esperado número entre 0 e 1.")
            continue
        require(number(answer.get("confidence"), 0, 1), "Confiança ausente ou inválida.")
        criteria = question["criteria"]
        options = set(criteria) if kind == "choice" else {str(i) for i in range(len(criteria))}
        probabilities = answer.get("probabilities")
        require(isinstance(probabilities, dict) and set(probabilities) == options,
                "Distribuição ausente ou diferente dos critérios.")
        require(all(number(value, 0, 1) for value in probabilities.values()),
                "Probabilidade fora do intervalo 0 a 1.")
        total = sum(probabilities.values())
        require(math.isclose(total, 1, rel_tol=0, abs_tol=0.02),
                "Distribuição de probabilidades não soma aproximadamente 1.")
        normalized = {option: value / total for option, value in probabilities.items()}
        if kind == "choice":
            choice = answer.get("choice")
            require(isinstance(choice, str) and choice in options,
                    "Choice retornou uma opção desconhecida.")
            require(normalized[choice] == max(normalized.values()),
                    "Choice não corresponde à opção mais provável.")
            count = len(normalized)
            expected_confidence = (max(normalized.values()) - 1 / count) / (1 - 1 / count)
        else:
            score = answer.get("score")
            require(number(score, 0, len(criteria) - 1), "Score fora da escala.")
            values = [normalized[str(index)] for index in range(len(criteria))]
            expected_score = sum(index * value for index, value in enumerate(values))
            require(math.isclose(score, expected_score, rel_tol=0,
                                 abs_tol=0.01 * (len(criteria) - 1) + 0.01),
                    "Score não corresponde à distribuição.")
            mode = values.index(max(values))
            spread = sum(value * abs(index - mode) for index, value in enumerate(values))
            even_spread = sum(abs(index - (len(values) - 1) / 2)
                              for index in range(len(values))) / len(values)
            expected_confidence = max(0.0, 1 - spread / even_spread)
            require(answer.get("legend") == {str(i): value for i, value in enumerate(criteria)},
                    "Legenda ausente ou diferente da escala enviada.")
        require(math.isclose(answer["confidence"], expected_confidence, rel_tol=0, abs_tol=0.03),
                "Confiança não corresponde à distribuição.")
    usage = result.get("usage")
    require(isinstance(usage, dict), "usage ausente.")
    require(number(usage.get("cost"), 0, float("inf")), "Custo ausente ou inválido.")
    for field in ("input_tokens", "output_tokens"):
        require(type(usage.get(field)) is int and usage[field] >= 0, "Contagem de tokens inválida.")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Redirecionamento HTTP recusado para preservar a credencial.")


def submit(payload, key, timeout):
    require(bool(key) and all(33 <= ord(char) <= 126 for char in key),
            "Credencial inválida; use OPENROUTER_API_KEY sem espaços ou caracteres de controle.")
    request = Request(ENDPOINT, data=json.dumps(payload, allow_nan=False).encode("utf-8"),
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                      method="POST")
    try:
        with build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            result = parse_json(response.read())
    except HTTPError as error:
        retry_after = error.headers.get("Retry-After", "").strip() if error.headers else ""
        detail = ""
        if retry_after and len(retry_after) <= 128 and retry_after.isascii():
            if retry_after.isdigit():
                detail = f" Retry-After: {retry_after}."
            else:
                try:
                    parsed = parsedate_to_datetime(retry_after)
                    detail = f" Retry-After: {format_datetime(parsed)}."
                except (TypeError, ValueError, OverflowError):
                    pass
        raise ValueError(f"OpenRouter retornou HTTP {error.code}; julgamento interrompido.{detail}") from error
    except (URLError, TimeoutError, OSError, HTTPException) as error:
        raise ValueError("Falha de rede ou timeout; julgamento não disponível.") from error
    validate_response(result, payload["questions"])
    return result


def main():
    parser = argparse.ArgumentParser(description="Decisões tipadas JEV via OpenRouter.")
    parser.add_argument("--request", required=True, help="Arquivo JSON ou - para stdin.")
    parser.add_argument("--model", help=f"Sobrescreve o modelo; padrão sem model: {DEFAULT_MODEL}.")
    parser.add_argument("--timeout", type=float, default=60, help="Timeout em segundos (padrão: 60).")
    parser.add_argument("--validate-only", action="store_true", help="Valida sem chamada paga.")
    args = parser.parse_args()
    try:
        require(number(args.timeout, 0, float("inf")) and args.timeout > 0, "Timeout deve ser finito e positivo.")
        raw = sys.stdin.buffer.read() if args.request == "-" else Path(args.request).read_bytes()
        payload = parse_json(raw)
        require(isinstance(payload, dict), "A requisição deve ser um objeto JSON.")
        payload["model"] = args.model if args.model is not None else payload.get("model", DEFAULT_MODEL)
        validate_request(payload)
        if args.validate_only:
            result = {"valid": True, "model": payload["model"], "questions": list(payload["questions"])}
        else:
            key = os.environ.get("OPENROUTER_API_KEY", "").strip()
            require(bool(key), "OPENROUTER_API_KEY ausente; carregue a credencial no ambiente.")
            result = submit(payload, key, args.timeout)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2))
    except (ValueError, OSError) as error:
        message = "Não foi possível ler o arquivo da requisição." if isinstance(error, OSError) else str(error)
        print(f"Erro: {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
