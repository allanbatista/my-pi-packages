#!/usr/bin/env python3
"""Deterministic boundary and CLI tests; live E2E is run separately."""

import copy
import io
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from http.client import IncompleteRead
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import jev

SKILL = Path(__file__).resolve().parents[1]
SAMPLE = SKILL / "references" / "triage.json"


def request():
    return json.loads(SAMPLE.read_text())


def response():
    return {
        "id": "fixture-decision",
        "model": "typesafe/jev-1.13-20260917",
        "answers": {
            "topic": {"type": "choice", "choice": "billing", "confidence": 0.97,
                      "probabilities": {"billing": 0.98, "account": 0.01, "other": 0.01}},
            "refund_requested": {"type": "noul", "noul": 0.99},
            "refund_explicitness": {
                "type": "score", "score": 1.98, "confidence": 0.97,
                "probabilities": {"0": 0, "1": 0.02, "2": 0.98},
                "legend": {str(i): text for i, text in enumerate(
                    request()["questions"]["refund_explicitness"]["criteria"])}
            },
        },
        "usage": {"input_tokens": 100, "output_tokens": 10, "cost": 0.00001},
    }


class RequestTests(unittest.TestCase):
    def test_valid_shapes_and_optional_noul_criteria(self):
        for state in ("mensagem", {"message": "mensagem"}, ["mensagem"]):
            payload = request()
            payload["state"] = state
            payload["questions"]["refund_requested"].pop("criteria")
            payload["questions"]["topic"]["instructions"] = {"question": "Classifique o conteúdo."}
            payload.update(provider={"allow_fallbacks": False}, session_id="test", trace={"trace_id": "test"})
            jev.validate_request(payload)

    def test_rejects_empty_and_invalid_boundaries(self):
        changes = [
            {"state": value} for value in (None, "", "  ", {}, [], False, 12)
        ] + [{"questions": value} for value in (None, {}, [])] + [
            {"model": "chat-model"}, {"session_id": "x" * 257}, {"trace": []}, {"provider": "TypeSafe"}
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                jev.validate_request({**request(), **change})

    def test_rejects_unknown_fields_invalid_user_and_empty_model(self):
        for change in ({"api_key": "secret"}, {"unknown": 1}, {"user": 123},
                       {"user": "x" * 257}, {"user": ""}, {"model": "typesafe/jev-"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                jev.validate_request({**request(), **change})
        jev.validate_request({**request(), "user": "test-user"})

    def test_rejects_invalid_questions(self):
        cases = [
            {"type": "noul", "instructions": ""},
            {"type": "unknown", "instructions": "Avalie."},
            {"type": "noul", "instructions": "Avalie.", "criteria": {"true": "Sim."}},
            {"type": "choice", "instructions": "Avalie.", "criteria": {"only": "Uma."}},
            {"type": "choice", "instructions": "Avalie.", "criteria": {"a": "", "b": "B."}},
            {"type": "score", "instructions": "Avalie.", "criteria": ["Uma."]},
            {"type": "score", "instructions": "Avalie.", "criteria": ["Uma.", None]},
        ]
        for question in cases:
            with self.subTest(question=question), self.assertRaises(ValueError):
                jev.validate_request({**request(), "questions": {"test": question}})

    def test_remote_option_and_level_limits(self):
        for kind, limit in (("choice", 255), ("score", 10)):
            for count in (limit, limit + 1):
                criteria = ({str(i): str(i) for i in range(count)} if kind == "choice"
                            else [str(i) for i in range(count)])
                payload = {**request(), "questions": {"q": {
                    "type": kind, "instructions": "Classifique.", "criteria": criteria}}}
                if count == limit:
                    jev.validate_request(payload)
                else:
                    with self.assertRaises(ValueError):
                        jev.validate_request(payload)

    def test_rejects_nonstandard_and_duplicate_json(self):
        for raw in ('{"state": NaN}', '{"x": Infinity}', '{"x": 1, "x": 2}', '{', b'"\xff"'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                jev.parse_json(raw)


class ResponseTests(unittest.TestCase):
    def test_accepts_fractional_score_and_resolved_model(self):
        jev.validate_response(response(), request()["questions"])

    def test_rejects_missing_or_mismatched_answers(self):
        for answers in (None, {}, {"unrequested": {}}, {"topic": {"type": "score"}}):
            with self.subTest(answers=answers), self.assertRaises(ValueError):
                jev.validate_response({**response(), "answers": answers}, request()["questions"])

    def test_rejects_invalid_probabilities_scores_and_options(self):
        changes = [
            ("refund_requested", {"noul": value})
            for value in (None, True, "0.9", -0.01, 1.01, float("nan"), float("inf"), 10 ** 400)
        ] + [
            ("topic", {"type": "noul"}), ("topic", {"choice": "invented"}),
            ("topic", {"confidence": None}), ("topic", {"probabilities": {}}),
            ("topic", {"probabilities": {"billing": -1, "account": 1, "other": 1}}),
            ("topic", {"probabilities": {"billing": 1, "account": 1, "other": 1}}),
            ("refund_explicitness", {"score": 3}), ("refund_explicitness", {"score": True}),
            ("refund_explicitness", {"legend": {}}),
        ]
        for key, change in changes:
            result = response()
            result["answers"][key].update(change)
            with self.subTest(key=key, change=change), self.assertRaises(ValueError):
                jev.validate_response(result, request()["questions"])

    def test_rejects_inconsistent_typed_answers(self):
        for key, change in (("topic", {"choice": "account"}),
                            ("topic", {"confidence": 0.1}),
                            ("refund_explicitness", {"score": 0.1}),
                            ("refund_explicitness", {"confidence": 0.1})):
            result = response()
            result["answers"][key].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                jev.validate_response(result, request()["questions"])

    def test_rejects_incomplete_distribution_with_many_options(self):
        criteria = {str(index): str(index) for index in range(100)}
        questions = {"q": {"type": "choice", "instructions": "Classifique.", "criteria": criteria}}
        result = {**response(), "answers": {"q": {
            "type": "choice", "choice": "0", "confidence": 0,
            "probabilities": {key: 0.005 for key in criteria}}}}
        with self.assertRaises(ValueError):
            jev.validate_response(result, questions)

    def test_accepts_rounding_and_tied_modes(self):
        result = response()
        result["answers"]["topic"].update(choice="billing", confidence=0,
                                         probabilities={"billing": 0.33, "account": 0.33, "other": 0.33})
        jev.validate_response(result, request()["questions"])

    def test_rejects_error_and_missing_accounting(self):
        for change in ({"error": {"code": 400}}, {"usage": None}, {"id": ""}, {"model": None},
                       {"usage": {"input_tokens": 1, "output_tokens": 1, "cost": -1}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                jev.validate_response({**response(), **change}, request()["questions"])


class TransportTests(unittest.TestCase):
    def test_preserves_payload_and_accounting(self):
        raw = io.BytesIO(json.dumps(response()).encode())
        with patch.object(jev, "build_opener") as factory:
            factory.return_value.open.return_value = raw
            result = jev.submit(request(), "test-key", 10)
            sent = factory.return_value.open.call_args.args[0]
            self.assertEqual(sent.full_url, jev.ENDPOINT)
            self.assertEqual(sent.get_method(), "POST")
            self.assertEqual(json.loads(sent.data), request())
            self.assertEqual(result, response())

    def test_failures_do_not_leak_remote_body_or_retry(self):
        failures = [HTTPError(jev.ENDPOINT, code, "error", {}, io.BytesIO(b"private-key private-state"))
                    for code in (400, 401, 402, 429, 503)] + [URLError("private-key"), TimeoutError(), IncompleteRead(b"private-state", 100)]
        for failure in failures:
            with self.subTest(failure=type(failure).__name__), patch.object(jev, "build_opener") as factory:
                factory.return_value.open.side_effect = failure
                with self.assertRaises(ValueError) as caught:
                    jev.submit(request(), "private-key", 10)
                self.assertNotIn("private", str(caught.exception))
                self.assertEqual(factory.return_value.open.call_count, 1)

    def test_preserves_safe_retry_after_without_remote_body(self):
        failure = HTTPError(jev.ENDPOINT, 429, "private-state", {"Retry-After": "30"},
                            io.BytesIO(b"private-state"))
        with patch.object(jev, "build_opener") as factory:
            factory.return_value.open.side_effect = failure
            with self.assertRaisesRegex(ValueError, "Retry-After: 30") as caught:
                jev.submit(request(), "private-key", 10)
            self.assertNotIn("private", str(caught.exception))
            self.assertEqual(factory.return_value.open.call_count, 1)

    def test_ignores_sensitive_retry_after_and_accepts_http_date(self):
        for header, expected in (("private-state", None),
                                 ("Wed, 07 Oct 2026 22:00:00 GMT", "Retry-After:")):
            failure = HTTPError(jev.ENDPOINT, 429, "error", {"Retry-After": header}, None)
            with patch.object(jev, "build_opener") as factory:
                factory.return_value.open.side_effect = failure
                with self.assertRaises(ValueError) as caught:
                    jev.submit(request(), "private-key", 10)
                self.assertNotIn("private", str(caught.exception))
                if expected:
                    self.assertIn(expected, str(caught.exception))
                else:
                    self.assertNotIn("Retry-After:", str(caught.exception))

    def test_rejects_redirect_and_invalid_credential(self):
        with self.assertRaises(ValueError):
            jev.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.example")
        with patch.object(jev, "build_opener") as factory, self.assertRaises(ValueError) as caught:
            jev.submit(request(), "private-key\n", 10)
        self.assertNotIn("private-key", str(caught.exception))
        factory.assert_not_called()


class CliTests(unittest.TestCase):
    def run_cli(self, *args, data=None):
        env = copy.copy(os.environ)
        env.pop("OPENROUTER_API_KEY", None)
        return subprocess.run([sys.executable, str(SKILL / "scripts" / "jev.py"), *args],
                              input=data, text=True, capture_output=True, env=env, timeout=5)

    def test_validation_reads_stdin_without_key_or_echoing_state(self):
        payload = request()
        payload.pop("model")
        result = self.run_cli("--request", "-", "--validate-only", data=json.dumps(payload))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["model"], jev.DEFAULT_MODEL)
        self.assertNotIn("state", result.stdout)

    def test_model_override_and_failure_exit(self):
        result = self.run_cli("--request", str(SAMPLE), "--validate-only", "--model", "~typesafe/jev-latest")
        self.assertEqual(json.loads(result.stdout)["model"], "~typesafe/jev-latest")
        for args in (("--timeout", "nan"), ("--timeout", "0"), ("--model", "invalid"), ()):
            result = self.run_cli("--request", str(SAMPLE), *args)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(result.stdout, "")
            self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
