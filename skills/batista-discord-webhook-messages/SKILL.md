---
name: batista-discord-webhook-messages
description: "Publish and manage Discord bot messages and attachments, always in session-scoped threads with hierarchical agent identity; send Markdown updates, fetch, edit or delete messages, ask free-form questions waiting for a reply and structured poll questions. Use as `/skill:batista-discord-webhook-messages` for Codex, Pi or Claude notifications on the working, pull-requests, releases and geral channels, including user-friendly release notes."
---

# Session-scoped Discord messages

Use only `scripts/discord_message.py` (skill-relative: `skills/batista-discord-webhook-messages/scripts/discord_message.py`). Require `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT`; treat credentials as secrets, never display them.

| Variable | Use |
| --- | --- |
| `DISCORD_APP_MY_MY_DEV_BOT_APP_ID` | identify/validate app/bot |
| `DISCORD_APP_MY_MY_DEV_BOT_PUBBLIC_KEY` | verify signatures of received interactions |
| `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT` | authenticate REST calls |
| `DISCORD_APP_MY_MY_DEV_BOT_WEBHOOK_TOKEN` | reply to interactions/webhooks when that flow exists |

Flow is outbound-only via the bot REST API, consuming only `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT`. Never use webhooks to publish nor reuse old RedQueen variables.

## Channels

| Name | ID | Use |
| --- | --- | --- |
| `releases` | `1529459842937393213` | release notes only, after merge confirmed in `main` or `master` |
| `working` | `1529460052958908537` | plan, execution, tests and local completion before opening the PR |
| `pull-requests` | `1529517597064691712` | open PR, CI, review, fixes and wait for merge |
| `geral` | `1529425753756799119` | messages not tied to a task |

Follow `working` → `pull-requests` → `releases`. Stay in `working` while local or branch-only; after opening the PR, post in `pull-requests` until merge (CI, review, fixes, blockers, ready state). `releases` only after merge confirmed in `main`/`master`. No PR → conclude in `working`; PR unmerged → conclude/block in `pull-requests`; never `releases` pre-merge.

Before `releases`, confirm the merged SHA has a version tag on the remote. Follow repo convention; if none, start `v1.0.0`, bump PATCH per merge. Reuse a SemVer tag already pointing exactly at the same SHA. Never move, overwrite or force-publish a tag. Content must include `**Version:** \`vMAJOR.MINOR.PATCH\``.

Always post inside a thread; the script creates one per session+channel and reuses its ID. Session key: `PI_SESSION_ID` (Pi), `CODEX_THREAD_ID` (Codex) or equivalent; absent → repo+branch. In `working`/`pull-requests`, thread name = specific branch (no repo/dir); in `main`, `master`, detached HEAD or outside Git, use the full `--name` chain without the code agent. In `releases`, always pass `--thread-name` with a short user-friendly editorial title. Never use branch, dir, PR number, hash, "merge/deploy" or internal task name in titles. Example: `More control over investigations and policies`, not `feature/allow-editing-agent-discovery` nor `Merge and deploy PR 129`. `General session` only when no session is available. `--session-id` overrides the session.

## Hierarchical identity

Pass `--name` on every `send`/`ask`/`edit`: only the session chain, ` > `-separated; the script prepends `--agent`. Root: `--name "Discord Tweaks"`; a subagent keeps the chain and appends its name, e.g. `--name "Discord Tweaks > Tests"`. Visual author: `Codex > Discord Tweaks > Tests`. In `releases`, `--name` uses the same friendly release title, without describing merge/deploy.

## Send

```bash
set -a; source /home/allanbatista/.secrets; set +a
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "Discord Tweaks" --channel working \
  --content $'### 🔄 In progress\nImplementing session-based grouping.\n\n**Next:** validate the real send.'

rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "More control over investigations" --channel releases \
  --thread-name "More control over investigations" \
  --content $'### 🚀 More control over investigations\nThe description can now be adjusted before using an investigation.\n\n### 🔧 Technical details\n- **Version:** `v1.0.0`\n- **Merge:** PR #123 merged into `main`.\n- **Validation:** post-merge smoke passed.' \
  --mention-everyone \
  --file ./report.txt
```

Write Markdown in `--content`; separate title, body and actions with line breaks. The script converts unescaped `\n`/`\r\n` from CLI into real breaks; `\\n` shows the literal sequence. Author is the real bot `my-dev-bot`; embed shows hierarchical identity + Codex/Pi/Claude logo. Repeat `--file` per attachment.

Timeline templates:

```markdown
### 🔄 In progress
<current status>

**Next:** <action>
```

```markdown
### ✅ Completed
<result>

**Validation:** <evidence>
```

Use `Completed` in `working` until merge. After confirmed merge, post in `releases` in product language: start with what changed and the user benefit; PR/commit/services/CI/deploy only in the final technical section. Include only categories with content:

```markdown
### 🔎 Pull request
<open PR or relevant completed step>

**State:** <CI, review, or readiness>
**Next:** <action>
```

```markdown
### 🚀 <benefit-oriented title>
<plain-language summary, understandable without technical context>

### ✨ What's new
- <new user capability>

### 📈 Improvements
- <improved experience or behavior>

### 🐛 Fixes
- <problem fixed and perceived effect>

### 🔧 Technical details
- **Version:** `vMAJOR.MINOR.PATCH`
- **Merge:** <PR or commit in main/master>
- **Validation:** <post-merge smoke>
```

```markdown
### ⛔ Blocked
<reason>

**Need:** <decision or input>
```

Do not repeat task, branch or context per message; the thread already keeps that timeline.

## Mentions

Mention only when needed. In `send`, repeat `--mention-user-id` (up to 100 IDs) or use `--mention-everyone` in releases. Main user: `cafeina_infinita` (`321460958998560768`) — mention it when a problem really interrupts the task. Every new release, after merge confirmed in `main`/`master`, must use `--mention-everyone`. Do not mention for recovered transient failures. In `ask --user-id`, use only `cafeina_infinita`'s ID when continuity depends on the answer.

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "Discord Tweaks" --channel working \
  --content $'### ⛔ Decision needed\nI need to confirm the environment.' \
  --mention-user-id 321460958998560768
```

The script writes `<@USER_ID>` in content and restricts `allowed_mentions.users` to given IDs; `--mention-everyone` writes `@everyone` and allows only that mention. Without options, no mention is parsed. In `ask`, `--user-id` also restricts the expected reply to that person.

## Ask and wait

Free-form question: accept the first human reply in the thread, or restrict via `--user-id`:

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py ask \
  --agent Codex --name "Discord Tweaks" --channel working \
  --question "Which environment should I validate?" --user-id USER_ID
```

Structured question: 2–10 options via native poll:

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py ask \
  --agent Codex --name "Discord Tweaks" --channel working --question "How should I proceed?" \
  --option "Apply now" --option "Keep local only" --user-id USER_ID
```

Poll every 15 seconds; stop on reply or 24 hours. `--timeout` 1–`86400` s. Process may stay open: when receiving a session ID from the execution tool, keep following it without blocking user updates for more than 60 seconds. Final reply comes as JSON.

## Fetch, edit and delete

Resolve thread by session+channel; `--thread-id` only for an explicit thread.

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py get MESSAGE_ID --channel working
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py edit MESSAGE_ID --channel working --agent Codex --name "Discord Tweaks" --content "### ✅ Updated\nNew content."
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py delete MESSAGE_ID --channel working --yes
```

Require explicit confirmation before deleting. Never attach secrets or files outside the user's scope. No automatic mentions; mention deliberately only via `send --mention-user-id`, `send --mention-everyone` or `ask --user-id`.

Sources: https://docs.discord.com/developers/resources/channel, https://docs.discord.com/developers/resources/message, https://docs.discord.com/developers/resources/poll and https://docs.discord.com/developers/reference#uploading-files
