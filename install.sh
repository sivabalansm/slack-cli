#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Create bin directory if needed
mkdir -p "$INSTALL_DIR"

# Symlink the slack CLI
ln -sf "$SCRIPT_DIR/slack" "$INSTALL_DIR/slack"
chmod +x "$SCRIPT_DIR/slack"

# Check if ~/.local/bin is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "$INSTALL_DIR"; then
  SHELL_NAME="$(basename "$SHELL")"
  case "$SHELL_NAME" in
    fish)
      RC="$HOME/.config/fish/config.fish"
      LINE="fish_add_path $INSTALL_DIR"
      ;;
    zsh)
      RC="$HOME/.zshrc"
      LINE="export PATH=\"$INSTALL_DIR:\$PATH\""
      ;;
    *)
      RC="$HOME/.bashrc"
      LINE="export PATH=\"$INSTALL_DIR:\$PATH\""
      ;;
  esac

  if [ -f "$RC" ] && grep -qF "$INSTALL_DIR" "$RC" 2>/dev/null; then
    : # already in rc file
  else
    echo "$LINE" >> "$RC"
    echo "Added $INSTALL_DIR to PATH in $RC"
    echo "Run: source $RC (or restart your shell)"
  fi
fi

echo "Installed: $INSTALL_DIR/slack -> $SCRIPT_DIR/slack"

DEFAULT_ENV="$SCRIPT_DIR/.env"
PROFILES=""
for f in "$SCRIPT_DIR"/.env.*; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in
    .env.example|.env.sample|.env.template|.env.local) ;;
    *) PROFILES="$PROFILES ${f##*/.env.}" ;;
  esac
done
PROFILES="${PROFILES# }"

if [ -f "$DEFAULT_ENV" ]; then
  echo "Default profile: loaded from $DEFAULT_ENV"
fi
if [ -n "$PROFILES" ]; then
  echo "Profile files found: $PROFILES (use: slack --profile <name> <command>)"
fi
if [ ! -f "$DEFAULT_ENV" ] && [ -z "$PROFILES" ]; then
  echo ""
  echo "No .env file found. Create one with your Slack user token:"
  echo "  echo 'SLACK_USER_TOKEN=xoxp-your-token' > $DEFAULT_ENV"
  echo ""
  echo "Multi-workspace? Copy to .env.<profile> (e.g. .env.personal) and use:"
  echo "  slack --profile <name> <command>"
fi

echo ""
echo "Usage: slack --help"
