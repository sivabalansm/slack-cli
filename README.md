# slack-cli

A zero-dependency Node.js CLI for sending, reading, and searching Slack messages **as your own user** (not a bot).

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From scratch**
2. Name it anything (e.g. "My CLI") and select your workspace
3. Go to **App Manifest** (under Features) and paste this JSON, then click **Save Changes**:

```json
{
  "display_information": { "name": "My CLI" },
  "features": { "bot_user": { "display_name": "My CLI", "always_online": false } },
  "oauth_config": {
    "scopes": {
      "user": [
        "chat:write",
        "channels:history",
        "channels:read",
        "channels:write",
        "groups:history",
        "groups:read",
        "groups:write",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "files:write",
        "reactions:write",
        "search:read",
        "users:read"
      ],
      "bot": ["chat:write"]
    }
  },
  "settings": {
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

4. Go to **Install App** and click **Install to \<workspace\>** → **Allow**
5. Copy the **User OAuth Token** (`xoxp-...`)

### 2. Configure the Token

Create a `.env` file in this directory:

```
SLACK_USER_TOKEN=xoxp-your-token-here
```

Or export it in your shell:

```bash
export SLACK_USER_TOKEN=xoxp-your-token-here
```

### 3. (Optional) Multi-Workspace Profiles

To use the CLI against more than one Slack workspace, create a separate token file per workspace named `.env.<profile>` (the Slack app must be created in *each* workspace — repeat Step 1 there):

```
.env             # default (used when no profile is selected)
.env.work        # profile "work"
.env.personal    # profile "personal"
```

Then select a profile per command:

```bash
slack --profile work channels         # uses .env.work
SLACK_PROFILE=personal slack dm       # uses .env.personal
slack channels                        # default → .env
```

**Resolution rules:**
- `--profile` flag wins over `SLACK_PROFILE` env var.
- Shell `SLACK_USER_TOKEN` still wins over any `.env*` file.
- Profile names must match `[A-Za-z0-9._-]+` (no slashes — path traversal is blocked).
- `--profile` must appear *before* the subcommand (e.g. `slack --profile work send ...`, not `slack send ... --profile work`) to protect arbitrary message/query strings.
- A missing `.env.<profile>` file errors with a clear message (except for `--help` and `slack config`, which warn instead).

`.gitignore` excludes `.env.*` by default — never commit a token file.

### 4. Make it Executable

```bash
chmod +x slack
```

## Usage

```
slack send <target> <message>                     Send a message
slack send <target> <message> -t <ts>             Reply in thread
slack send <target> <message> -t <ts> --broadcast Reply + broadcast to channel
echo "msg" | slack send <target>                  Send from stdin (pipe)
slack read <target> [--limit N]                   Read recent messages (default 20)
slack read <target> -t <ts> [--limit N]           Read thread replies
slack search <query> [--limit N]                  Search messages
slack dm [--limit N]                              List recent DM conversations
slack react <target> <ts> <emoji>                 Add emoji reaction
slack edit <target> <ts> <new message>            Edit a sent message
slack delete <target> <ts>                        Delete a sent message
slack upload <target> <filepath>                  Upload a file
slack channels [--limit N]                        List channels
slack users [--limit N]                           List users
slack config                                      Show resolved profile + masked token

slack [--profile <name>] <command> [args...]      Use a non-default profile
SLACK_PROFILE=<name> slack <command> [args...]    Same, via env var
```

### Target Formats

| Format | Example | Description |
|--------|---------|-------------|
| `#channel` | `#general` | Channel by name |
| `@username` | `@siva` | DM by username |
| `U...` | `U0A9558HDE3` | User by ID (opens DM) |
| `C...` / `D...` | `C9MGF8UE6` | Channel/DM by ID |
| bare name | `general` | Auto-detects channel or user |

### Examples

```bash
# Send a DM
./slack send @yueran "hey, quick question"

# Send to a channel
./slack send #general "good morning everyone"

# Read last 10 messages from a DM
./slack read @yueran --limit 10

# Reply in a thread
./slack send #general "got it, thanks" -t 1774558996.316679

# Read thread replies
./slack read #general -t 1774558996.316679

# Search messages
./slack search "from:@siva after:2026-03-20"
./slack search "project update in:#general"

# List channels and users
./slack channels
./slack users

# DM inbox — see recent conversations
./slack dm

# React to a message
./slack react @siva 1774558996.316679 thumbsup

# Edit a message
./slack edit @siva 1774558996.316679 "updated text"

# Delete a message
./slack delete @siva 1774558996.316679

# Upload a file
./slack upload @siva ./report.pdf

# Pipe from another command
echo "deploy complete" | ./slack send #deploys
git log --oneline -5 | ./slack send @siva
```

## Scopes Reference

| Scope | Purpose |
|-------|---------|
| `chat:write` | Send messages as your user |
| `channels:history` | Read public channel messages |
| `channels:read` | List public channels |
| `channels:write` | Join/manage public channels |
| `groups:history` | Read private channel messages |
| `groups:read` | List private channels |
| `groups:write` | Join/manage private channels |
| `im:history` | Read DM messages |
| `im:read` | List DMs |
| `im:write` | Open new DMs |
| `mpim:history` | Read group DM messages |
| `mpim:read` | List group DMs |
| `mpim:write` | Open new group DMs |
| `files:write` | Upload files |
| `reactions:write` | Add emoji reactions |
| `search:read` | Search messages |
| `users:read` | List users and resolve usernames |

## Requirements

- Node.js 18+ (uses native `fetch`)
- No npm dependencies

## Tests

```bash
npm test            # runs node:test against test/profile.test.js (no network)
```
