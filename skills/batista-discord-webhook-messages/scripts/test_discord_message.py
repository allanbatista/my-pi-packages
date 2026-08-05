#!/usr/bin/env python3
"""Unit tests for session-scoped Discord bot messages."""

import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


module_path = Path(__file__).with_name("discord_message.py")
spec = importlib.util.spec_from_file_location("discord_message", module_path)
discord_message = importlib.util.module_from_spec(spec)
spec.loader.exec_module(discord_message)


class DiscordMessageTests(unittest.TestCase):
    def test_uses_my_my_dev_bot_token(self):
        with patch.dict(
            os.environ,
            {"DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT": "bot-token"},
            clear=True,
        ):
            self.assertEqual(discord_message.bot_token(), "bot-token")

        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(
            ValueError, "DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT"
        ):
            discord_message.bot_token()

    def test_channel_and_agent_mappings(self):
        self.assertEqual(
            discord_message.CHANNEL_IDS,
            {
                "releases": "1529459842937393213",
                "working": "1529460052958908537",
                "pull-requests": "1529517597064691712",
                "geral": "1529425753756799119",
            },
        )
        self.assertEqual(set(discord_message.AVATAR_URLS), {"Codex", "Pi", "Claude"})

    def test_uses_branch_or_root_session_as_thread_name(self):
        with patch.object(discord_message, "git_context", return_value=None):
            self.assertEqual(
                discord_message.default_thread_name("Audit > Tests"),
                "Audit > Tests",
            )
            self.assertEqual(discord_message.default_thread_name(), "General session")
        with patch.object(
            discord_message,
            "git_context",
            return_value={
                "root": "/workspace/repo",
                "branch": "feature/messages",
            },
        ):
            self.assertEqual(
                discord_message.default_thread_name("Audit"), "feature/messages"
            )
        with patch.object(
            discord_message,
            "git_context",
            return_value={"root": "/workspace/repo", "branch": "master"},
        ):
            self.assertEqual(
                discord_message.default_thread_name("Audit > Execute"),
                "Audit > Execute",
            )

    def test_builds_multipart_payload_with_multiple_files(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "evidence.png"
            report = Path(directory) / "report.txt"
            image.write_bytes(b"PNG data")
            report.write_text("report data")

            body, content_type = discord_message.build_multipart(
                {"embeds": [{"description": "**Evidence**"}]}, [image, report]
            )

        payload_start = body.index(b"\r\n\r\n") + 4
        payload_end = body.index(b"\r\n--", payload_start)
        payload = json.loads(body[payload_start:payload_end])
        self.assertTrue(content_type.startswith("multipart/form-data; boundary="))
        self.assertEqual(
            payload["attachments"],
            [
                {"id": 0, "filename": "evidence.png"},
                {"id": 1, "filename": "report.txt"},
            ],
        )
        self.assertIn(b'name="files[0]"; filename="evidence.png"', body)
        self.assertIn(b'name="files[1]"; filename="report.txt"', body)
        self.assertIn(b"PNG data", body)

    def test_formats_markdown_as_agent_embed_and_optional_mention(self):
        payload = discord_message.message_payload(
            "Codex",
            "Parent session > Tests",
            "### ✅ Completed\n**Validation:** passed",
            "123456",
        )
        self.assertEqual(payload["content"], "<@123456>")
        self.assertEqual(payload["allowed_mentions"]["users"], ["123456"])
        self.assertEqual(
            payload["embeds"][0]["author"]["name"],
            "Codex > Parent session > Tests",
        )
        self.assertIn("### ✅ Completed", payload["embeds"][0]["description"])

    def test_allows_only_explicit_deduplicated_user_mentions(self):
        payload = discord_message.message_payload(
            "Codex",
            "Parent session",
            "Decision needed.",
            mention_user_ids=["123456", "789012", "123456"],
        )

        self.assertEqual(payload["content"], "<@123456> <@789012>")
        self.assertEqual(
            payload["allowed_mentions"],
            {"parse": [], "users": ["123456", "789012"]},
        )
        with self.assertRaisesRegex(ValueError, "at most 100"):
            discord_message.normalized_user_ids(
                mention_user_ids=[str(value) for value in range(1, 102)]
            )

    def test_allows_explicit_everyone_mention(self):
        payload = discord_message.message_payload(
            "Codex", "Release", "New version.", mention_everyone=True
        )

        self.assertEqual(payload["content"], "@everyone")
        self.assertEqual(payload["allowed_mentions"], {"parse": ["everyone"]})

    def test_converts_escaped_newlines_without_changing_escaped_literals(self):
        payload = discord_message.message_payload(
            "Codex",
            "Markdown fix",
            r"### 🔄 In progress\nNormal body\n\n**Next:** validate `\\n` literal.",
        )

        self.assertEqual(
            payload["embeds"][0]["description"],
            "### 🔄 In progress\nNormal body\n\n**Next:** validate `\\\\n` literal.",
        )
        self.assertEqual(discord_message.normalize_markdown(r"one\r\ntwo"), "one\ntwo")

    def test_rejects_invalid_hierarchical_name(self):
        for name in ("", "Parent > ", "Parent\nChild"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                discord_message.actor_name("Codex", name)

    def test_creates_and_reuses_thread_for_same_session(self):
        args = SimpleNamespace(
            session_id="session-1",
            agent="Codex",
            name="Parent session",
            channel="working",
            thread_id=None,
            thread_name="repo · branch",
        )
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            os.environ, {"DISCORD_AGENTS_STATE_DIR": directory}
        ), patch.object(
            discord_message, "api_request", return_value={"id": "123456789"}
        ) as request:
            first = discord_message.resolve_thread(args, create=True)
            second = discord_message.resolve_thread(args, create=True)

        self.assertEqual(first[:3], ("123456789", "repo · branch", True))
        self.assertEqual(second[:3], ("123456789", "repo · branch", False))
        request.assert_called_once_with(
            "POST",
            "/channels/1529460052958908537/threads",
            {
                "name": "repo · branch",
                "type": 11,
                "auto_archive_duration": 1440,
            },
        )

    def test_polls_free_text_every_fifteen_seconds(self):
        request = Mock(
            side_effect=[
                [],
                [
                    {
                        "id": "102",
                        "type": 0,
                        "content": "You may proceed.",
                        "attachments": [],
                        "timestamp": "2026-07-22T00:00:00Z",
                        "author": {
                            "id": "99",
                            "username": "allan",
                            "global_name": "Allan",
                            "bot": False,
                        },
                    }
                ],
            ]
        )
        clock = Mock(side_effect=[0, 1])
        sleeper = Mock()

        response = discord_message.poll_for_text_reply(
            "200", "100", None, 60, request, clock, sleeper
        )

        self.assertEqual(response["content"], "You may proceed.")
        sleeper.assert_called_once_with(15)

    def test_reads_structured_poll_answer(self):
        request = Mock(
            return_value={
                "poll": {
                    "answers": [
                        {"answer_id": 1, "poll_media": {"text": "Yes"}},
                        {"answer_id": 2, "poll_media": {"text": "No"}},
                    ],
                    "results": {
                        "answer_counts": [
                            {"id": 1, "count": 1},
                            {"id": 2, "count": 0},
                        ]
                    },
                }
            }
        )

        response = discord_message.poll_for_structured_reply(
            "200", "300", None, 60, request, Mock(return_value=0), Mock()
        )

        self.assertEqual(response["answer_id"], "1")
        self.assertEqual(response["answer"], "Yes")

    def test_polling_timeout_is_reported(self):
        with self.assertRaisesRegex(TimeoutError, "No response"):
            discord_message.poll_for_text_reply(
                "200",
                "100",
                None,
                10,
                Mock(return_value=[]),
                Mock(side_effect=[0, 11]),
                Mock(),
            )

    def test_cli_validates_send_and_structured_options(self):
        with patch.object(sys, "argv", ["discord_message.py", "send"]):
            with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                discord_message.parse_args()
        self.assertEqual(error.exception.code, 2)

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--channel",
                "releases",
                "--name",
                "Release",
                "--content",
                "### 🚀 News",
            ],
        ):
            with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                discord_message.parse_args()
        self.assertEqual(error.exception.code, 2)

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--channel",
                "releases",
                "--name",
                "More control over investigations",
                "--thread-name",
                "More control over investigations",
                "--content",
                "### 🚀 More control over investigations\n\n**Version:** `v1.0.0`",
            ],
        ):
            args = discord_message.parse_args()
        self.assertEqual(args.thread_name, "More control over investigations")

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--channel",
                "releases",
                "--name",
                "More control over investigations",
                "--thread-name",
                "More control over investigations",
                "--content",
                "### 🚀 More control over investigations\n\n**Versão:** `v1.0.0`",
            ],
        ):
            args = discord_message.parse_args()
        self.assertEqual(args.thread_name, "More control over investigations")

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--channel",
                "releases",
                "--name",
                "More control over investigations",
                "--thread-name",
                "More control over investigations",
                "--content",
                "### 🚀 More control over investigations",
            ],
        ):
            with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                discord_message.parse_args()
        self.assertEqual(error.exception.code, 2)

        argv = [
            "discord_message.py",
            "ask",
            "--name",
            "Parent session > Decision",
            "--question",
            "Continue?",
            "--option",
            "Yes",
            "--option",
            "No",
        ]
        with patch.object(sys, "argv", argv):
            args = discord_message.parse_args()
        self.assertEqual(args.name, "Parent session > Decision")
        self.assertEqual(args.option, ["Yes", "No"])
        self.assertEqual(args.timeout, 86400)

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--name",
                "Parent session",
                "--content",
                "Notice",
                "--mention-user-id",
                "123456",
                "--mention-user-id",
                "789012",
            ],
        ):
            args = discord_message.parse_args()
        self.assertEqual(args.mention_user_id, ["123456", "789012"])

        with patch.object(
            sys,
            "argv",
            [
                "discord_message.py",
                "send",
                "--name",
                "Release",
                "--content",
                "Notice",
                "--mention-everyone",
            ],
        ):
            args = discord_message.parse_args()
        self.assertTrue(args.mention_everyone)

    def test_rejects_missing_file(self):
        with self.assertRaisesRegex(ValueError, "File not found"):
            discord_message.build_multipart({}, ["/missing/evidence.png"])


if __name__ == "__main__":
    unittest.main()
