#!/usr/bin/env python3
"""Publish and manage session-scoped Discord bot messages."""

import argparse
import hashlib
import json
import math
import mimetypes
import os
import re
import secrets
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_BASE_URL = "https://discord.com/api/v10"
POLL_INTERVAL_SECONDS = 15
MAX_POLL_SECONDS = 24 * 60 * 60
FALLBACK_THREAD_NAME = "General session"
DEFAULT_BRANCH_NAMES = {"main", "master"}
CHANNEL_IDS = {
    "releases": "1529459842937393213",
    "working": "1529460052958908537",
    "pull-requests": "1529517597064691712",
    "geral": "1529425753756799119",
}
AVATAR_URLS = {
    "Codex": "https://images.ctfassets.net/8su2tbn87fck/37ep8OPlSuUYpcTFkkW9NO/1a6381ac6612a83ec6d07b3fac5c5228/Blossom_4k_Icon_1.png",
    "Pi": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgihcqexA0F-rbWQWMiemcXyw4_1Iy_9lYs6oBL4QVbTN86MTO1QsY5KiC&s=10",
    "Claude": "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/claude-ai-icon.png",
}
SESSION_ENV_NAMES = (
    "DISCORD_AGENTS_SESSION_ID",
    "CODEX_THREAD_ID",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_SESSION_ID",
    "PI_SESSION_ID",
)
ESCAPED_NEWLINE_PATTERN = re.compile(r"(?<!\\)(?:\\r\\n|\\n)")
# Accept both the legacy pt-BR ("Versão") and the en-US ("Version") label.
RELEASE_VERSION_PATTERN = re.compile(
    r"\*\*(?:Versão|Version):\*\*\s*`?v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)`?"
)


class DiscordAPIError(RuntimeError):
    def __init__(self, status, detail):
        self.status = status
        self.code = None
        message = detail
        try:
            parsed = json.loads(detail)
            self.code = parsed.get("code")
            message = parsed.get("message", detail)
        except json.JSONDecodeError:
            pass
        suffix = f" (code {self.code})" if self.code is not None else ""
        super().__init__(f"Discord returned HTTP {status}: {message}{suffix}")


def bot_token():
    token = os.environ.get("DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT")
    if not token:
        raise ValueError("DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT is required")
    return token


def validate_snowflake(value, label):
    value = str(value or "")
    if not value.isdigit():
        raise ValueError(f"{label} must be a numeric Discord ID")
    return value


def build_multipart(payload, paths):
    uploads = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.is_file():
            raise ValueError(f"File not found or invalid: {path}")
        if "\r" in path.name or "\n" in path.name:
            raise ValueError(f"Invalid file name: {path.name!r}")
        try:
            content = path.read_bytes()
        except OSError as error:
            raise ValueError(f"Could not read file {path}: {error}") from error
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        uploads.append((path.name, content_type, content))

    payload = {
        **payload,
        "attachments": [
            {"id": index, "filename": filename}
            for index, (filename, _, _) in enumerate(uploads)
        ],
    }
    boundary = f"----discord-bot-{secrets.token_hex(16)}"
    parts = [
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="payload_json"\r\n',
        b"Content-Type: application/json\r\n\r\n",
        json.dumps(payload, ensure_ascii=False).encode(),
        b"\r\n",
    ]
    for index, (filename, content_type, content) in enumerate(uploads):
        escaped_filename = filename.replace("\\", "\\\\").replace('"', '\\"')
        parts.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    f'Content-Disposition: form-data; name="files[{index}]"; '
                    f'filename="{escaped_filename}"\r\n'
                ).encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                content,
                b"\r\n",
            ]
        )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def api_request(method, path, payload=None, files=None):
    headers = {
        "Authorization": f"Bot {bot_token()}",
        "User-Agent": "DiscordAgentMessages/1.0",
    }
    if files:
        data, headers["Content-Type"] = build_multipart(payload or {}, files)
    elif payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode()
        headers["Content-Type"] = "application/json"
    else:
        data = None
    url = path if path.startswith("https://") else f"{API_BASE_URL}{path}"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read().decode()
            return json.loads(body) if body else None
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise DiscordAPIError(error.code, detail) from error
    except URLError as error:
        raise RuntimeError(f"Failed to call Discord: {error.reason}") from error


def git_output(*args, cwd=None):
    try:
        result = subprocess.run(
            ["git", "-C", str(cwd or Path.cwd()), *args],
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def git_context(cwd=None):
    cwd = Path(cwd or Path.cwd())
    root = git_output("rev-parse", "--show-toplevel", cwd=cwd)
    if not root:
        return None
    return {
        "root": root,
        "branch": git_output("branch", "--show-current", cwd=cwd),
    }


def current_session_id(explicit=None, agent="Codex", cwd=None):
    if explicit:
        return explicit
    for name in SESSION_ENV_NAMES:
        if os.environ.get(name):
            return os.environ[name]
    context = git_context(cwd)
    if context:
        return f"{agent}:{context['root']}:{context['branch']}"
    return f"{agent}:general"


def session_thread_name(session_name):
    segments = [segment.strip() for segment in (session_name or "").split(">")]
    return " > ".join(segment for segment in segments if segment)


def default_thread_name(session_name=None, cwd=None):
    context = git_context(cwd)
    branch = context["branch"] if context else ""
    if branch and branch not in DEFAULT_BRANCH_NAMES:
        return branch[:100]
    return (session_thread_name(session_name) or FALLBACK_THREAD_NAME)[:100]


def state_root():
    configured = os.environ.get("DISCORD_AGENTS_STATE_DIR")
    if configured:
        return Path(configured)
    xdg_state_home = os.environ.get("XDG_STATE_HOME")
    base = Path(xdg_state_home) if xdg_state_home else Path.home() / ".local" / "state"
    return base / "discord-agent-messages"


def state_path(session_id, channel, agent):
    digest = hashlib.sha256(f"{session_id}\0{channel}\0{agent}".encode()).hexdigest()
    return state_root() / f"{digest}.json"


def load_thread_id(path):
    if not path.exists():
        return None
    try:
        state = json.loads(path.read_text())
        return validate_snowflake(state["thread_id"], "saved thread_id")
    except (OSError, KeyError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"Invalid thread state at {path}: {error}") from error


def save_thread(path, thread_id, thread_name, channel):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(
            {"thread_id": thread_id, "thread_name": thread_name, "channel": channel},
            ensure_ascii=False,
        )
    )
    temporary.chmod(0o600)
    temporary.replace(path)


def resolve_thread(args, create):
    session_id = current_session_id(args.session_id, args.agent)
    path = state_path(session_id, args.channel, args.agent)
    thread_name = args.thread_name or default_thread_name(getattr(args, "name", None))
    if args.thread_id:
        thread_id = validate_snowflake(args.thread_id, "thread_id")
        save_thread(path, thread_id, thread_name, args.channel)
        return thread_id, thread_name, False, path
    thread_id = load_thread_id(path)
    if thread_id:
        return thread_id, thread_name, False, path
    if not create:
        raise ValueError("No thread registered for this session; provide --thread-id")
    channel_id = CHANNEL_IDS[args.channel]
    thread = api_request(
        "POST",
        f"/channels/{channel_id}/threads",
        {
            "name": thread_name,
            "type": 11,
            "auto_archive_duration": 1440,
        },
    )
    thread_id = validate_snowflake(thread.get("id"), "returned thread_id")
    save_thread(path, thread_id, thread_name, args.channel)
    return thread_id, thread_name, True, path


def actor_name(agent, session_name):
    if not session_name or "\n" in session_name or "\r" in session_name:
        raise ValueError("--name must provide the agent session")
    segments = [segment.strip() for segment in session_name.split(">")]
    if any(not segment for segment in segments):
        raise ValueError("--name must use non-empty names separated by >")
    name = " > ".join([agent, *segments])
    if len(name) > 256:
        raise ValueError("agent identity must be at most 256 characters")
    return name


def normalize_markdown(content):
    return ESCAPED_NEWLINE_PATTERN.sub("\n", content)


def normalized_user_ids(user_id=None, mention_user_ids=None):
    values = ([user_id] if user_id else []) + list(mention_user_ids or [])
    user_ids = list(dict.fromkeys(validate_snowflake(value, "user_id") for value in values))
    if len(user_ids) > 100:
        raise ValueError("a message can mention at most 100 users")
    return user_ids


def message_payload(
    agent,
    session_name,
    content,
    user_id=None,
    poll=None,
    mention_user_ids=None,
    mention_everyone=False,
):
    description = normalize_markdown(content) if content else "📎 **Attachment**"
    if len(description) > 4096:
        raise ValueError("Markdown message exceeds 4096 characters")
    payload = {
        "embeds": [
            {
                "author": {
                    "name": actor_name(agent, session_name),
                    "icon_url": AVATAR_URLS[agent],
                },
                "description": description,
            }
        ],
        "allowed_mentions": {"parse": []},
    }
    user_ids = normalized_user_ids(user_id, mention_user_ids)
    mentions = []
    if mention_everyone:
        mentions.append("@everyone")
        payload["allowed_mentions"]["parse"].append("everyone")
    if user_ids:
        mentions.extend(f"<@{value}>" for value in user_ids)
        payload["allowed_mentions"]["users"] = user_ids
    if mentions:
        payload["content"] = " ".join(mentions)
    if poll:
        payload["poll"] = poll
    return payload


def create_message(
    thread_id,
    agent,
    session_name,
    content,
    files=None,
    user_id=None,
    poll=None,
    mention_user_ids=None,
    mention_everyone=False,
):
    return api_request(
        "POST",
        f"/channels/{thread_id}/messages",
        message_payload(
            agent,
            session_name,
            content,
            user_id=user_id,
            poll=poll,
            mention_user_ids=mention_user_ids,
            mention_everyone=mention_everyone,
        ),
        files or [],
    )


def publish(args, content, poll=None):
    thread_id, thread_name, created, path = resolve_thread(args, create=True)
    try:
        message = create_message(
            thread_id,
            args.agent,
            args.name,
            content,
            getattr(args, "file", []),
            user_id=getattr(args, "user_id", None),
            poll=poll,
            mention_user_ids=getattr(args, "mention_user_id", []),
            mention_everyone=getattr(args, "mention_everyone", False),
        )
    except DiscordAPIError as error:
        if error.code != 10003 or args.thread_id:
            raise
        path.unlink(missing_ok=True)
        thread_id, thread_name, created, _ = resolve_thread(args, create=True)
        message = create_message(
            thread_id,
            args.agent,
            args.name,
            content,
            getattr(args, "file", []),
            user_id=getattr(args, "user_id", None),
            poll=poll,
            mention_user_ids=getattr(args, "mention_user_id", []),
            mention_everyone=getattr(args, "mention_everyone", False),
        )
    return {
        "thread_id": thread_id,
        "thread_name": thread_name,
        "thread_created": created,
        "message": message,
    }


def human_response(message, user_id=None):
    author = message.get("author") or {}
    if author.get("bot") or message.get("type") not in (0, 19):
        return None
    if user_id and author.get("id") != user_id:
        return None
    content = (message.get("content") or "").strip()
    attachments = message.get("attachments") or []
    if not content and not attachments:
        return None
    return {
        "message_id": message.get("id"),
        "author": {
            "id": author.get("id"),
            "username": author.get("username"),
            "global_name": author.get("global_name"),
        },
        "content": content,
        "attachments": attachments,
        "timestamp": message.get("timestamp"),
    }


def poll_for_text_reply(
    thread_id,
    after_id,
    user_id,
    timeout,
    request_func=None,
    clock=None,
    sleeper=None,
):
    request_func = request_func or api_request
    clock = clock or time.monotonic
    sleeper = sleeper or time.sleep
    deadline = clock() + timeout
    cursor = after_id
    while True:
        query = urlencode({"after": cursor, "limit": 100})
        messages = request_func("GET", f"/channels/{thread_id}/messages?{query}")
        for message in sorted(messages, key=lambda item: int(item["id"])):
            cursor = max(cursor, message["id"], key=int)
            response = human_response(message, user_id)
            if response:
                return response
        remaining = deadline - clock()
        if remaining <= 0:
            raise TimeoutError(f"No response received in {timeout} seconds")
        sleeper(min(POLL_INTERVAL_SECONDS, remaining))


def poll_answers(message):
    poll = message.get("poll") or {}
    answers = poll.get("answers") or []
    return {
        str(answer["answer_id"]): answer.get("poll_media", {}).get("text", "")
        for answer in answers
        if answer.get("answer_id") is not None
    }


def poll_for_structured_reply(
    thread_id,
    message_id,
    user_id,
    timeout,
    request_func=None,
    clock=None,
    sleeper=None,
):
    request_func = request_func or api_request
    clock = clock or time.monotonic
    sleeper = sleeper or time.sleep
    deadline = clock() + timeout
    while True:
        message = request_func("GET", f"/channels/{thread_id}/messages/{message_id}")
        answers = poll_answers(message)
        results = (message.get("poll") or {}).get("results") or {}
        positive_ids = [
            str(count["id"])
            for count in results.get("answer_counts", [])
            if count.get("count", 0) > 0
        ]
        for answer_id in positive_ids:
            if user_id:
                voters = request_func(
                    "GET",
                    f"/channels/{thread_id}/polls/{message_id}/answers/{answer_id}?limit=100",
                ).get("users", [])
                voter = next((user for user in voters if user.get("id") == user_id), None)
                if not voter:
                    continue
            else:
                voter = None
            return {
                "answer_id": answer_id,
                "answer": answers.get(answer_id, ""),
                "user": voter,
            }
        remaining = deadline - clock()
        if remaining <= 0:
            raise TimeoutError(f"No response received in {timeout} seconds")
        sleeper(min(POLL_INTERVAL_SECONDS, remaining))


def compact_message(message):
    return {
        "message_id": message.get("id"),
        "channel_id": message.get("channel_id"),
        "attachments": message.get("attachments", []),
    }


def send_command(args):
    result = publish(args, args.content)
    result["message"] = compact_message(result["message"])
    print(json.dumps(result, ensure_ascii=False, indent=2))


def ask_command(args):
    poll = None
    content = f"### ❓ Question\n{args.question}\n\n_Reply in this thread._"
    if args.option:
        poll = {
            "question": {"text": args.question},
            "answers": [{"poll_media": {"text": option}} for option in args.option],
            "duration": max(1, min(24, math.ceil(args.timeout / 3600))),
            "allow_multiselect": False,
            "layout_type": 1,
        }
        content = f"### ❓ Decision needed\n{args.question}\n\n_Select an option below._"
    result = publish(args, content, poll)
    thread_id = result["thread_id"]
    message_id = result["message"]["id"]
    print(
        json.dumps(
            {
                "thread_id": thread_id,
                "thread_name": result["thread_name"],
                "question_message_id": message_id,
                "status": "aguardando_resposta",
                "poll_interval_seconds": POLL_INTERVAL_SECONDS,
                "timeout_seconds": args.timeout,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    if poll:
        response = poll_for_structured_reply(
            thread_id, message_id, args.user_id, args.timeout
        )
        try:
            api_request("POST", f"/channels/{thread_id}/polls/{message_id}/expire")
            response["poll_ended"] = True
        except DiscordAPIError as error:
            response["poll_ended"] = False
            response["poll_end_error"] = str(error)
    else:
        response = poll_for_text_reply(
            thread_id, message_id, args.user_id, args.timeout
        )
    print(
        json.dumps(
            {"thread_id": thread_id, "question_message_id": message_id, "response": response},
            ensure_ascii=False,
            indent=2,
        )
    )


def resolve_existing(args):
    thread_id, _, _, _ = resolve_thread(args, create=False)
    return thread_id


def get_command(args):
    message = api_request(
        "GET", f"/channels/{resolve_existing(args)}/messages/{args.message_id}"
    )
    print(json.dumps(message, ensure_ascii=False, indent=2))


def edit_command(args):
    message = api_request(
        "PATCH",
        f"/channels/{resolve_existing(args)}/messages/{args.message_id}",
        message_payload(args.agent, args.name, args.content),
    )
    print(json.dumps(message, ensure_ascii=False, indent=2))


def delete_command(args):
    api_request(
        "DELETE", f"/channels/{resolve_existing(args)}/messages/{args.message_id}"
    )
    print("HTTP 204")


def timeout_seconds(value):
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("timeout must be an integer") from error
    if not 1 <= parsed <= MAX_POLL_SECONDS:
        raise argparse.ArgumentTypeError("timeout must be between 1 and 86400 seconds")
    return parsed


def add_thread_arguments(parser, include_files=False):
    parser.add_argument("--agent", choices=AVATAR_URLS, default="Codex")
    parser.add_argument("--channel", choices=CHANNEL_IDS, default="working")
    parser.add_argument("--session-id")
    parser.add_argument("--thread-name")
    parser.add_argument("--thread-id")
    if include_files:
        parser.add_argument("--file", action="append", default=[], metavar="PATH")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Manages session-scoped Discord messages in threads."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    send = commands.add_parser("send")
    add_thread_arguments(send, include_files=True)
    send.add_argument("--name", required=True, metavar="SESSION_NAME")
    send.add_argument("--content")
    send.add_argument("--mention-user-id", action="append", default=[])
    send.add_argument("--mention-everyone", action="store_true")

    ask = commands.add_parser("ask")
    add_thread_arguments(ask)
    ask.add_argument("--name", required=True, metavar="SESSION_NAME")
    ask.add_argument("--question", required=True)
    ask.add_argument("--option", action="append", default=[])
    ask.add_argument("--user-id")
    ask.add_argument("--timeout", type=timeout_seconds, default=MAX_POLL_SECONDS)

    get = commands.add_parser("get")
    add_thread_arguments(get)
    get.add_argument("message_id")

    edit = commands.add_parser("edit")
    add_thread_arguments(edit)
    edit.add_argument("--name", required=True, metavar="SESSION_NAME")
    edit.add_argument("message_id")
    edit.add_argument("--content", required=True)

    delete = commands.add_parser("delete")
    add_thread_arguments(delete)
    delete.add_argument("message_id")
    delete.add_argument("--yes", action="store_true")

    args = parser.parse_args()
    if args.command == "send" and not args.content and not args.file:
        parser.error("send requires --content and/or --file")
    if args.command == "send" and args.channel == "releases" and not args.thread_name:
        parser.error(
            "send in releases requires --thread-name with a user-friendly title"
        )
    if (
        args.command == "send"
        and args.channel == "releases"
        and not RELEASE_VERSION_PATTERN.search(normalize_markdown(args.content or ""))
    ):
        parser.error("send in releases requires **Version:** `vMAJOR.MINOR.PATCH`")
    if args.command == "ask" and args.option and not 2 <= len(args.option) <= 10:
        parser.error("ask requires between 2 and 10 structured options")
    if args.command == "ask" and len(args.question) > 300:
        parser.error("the question must be at most 300 characters")
    if args.command == "ask" and any(len(option) > 55 for option in args.option):
        parser.error("each option must be at most 55 characters")
    if args.command == "delete" and not args.yes:
        parser.error("delete requires --yes after explicit confirmation")
    if args.thread_name and not 1 <= len(args.thread_name) <= 100:
        parser.error("thread-name must be between 1 and 100 characters")
    return args


def main():
    args = parse_args()
    if args.command == "send":
        send_command(args)
    elif args.command == "ask":
        ask_command(args)
    elif args.command == "get":
        get_command(args)
    elif args.command == "edit":
        edit_command(args)
    else:
        delete_command(args)


if __name__ == "__main__":
    try:
        main()
    except (DiscordAPIError, RuntimeError, TimeoutError, ValueError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("Wait interrupted", file=sys.stderr)
        sys.exit(130)
