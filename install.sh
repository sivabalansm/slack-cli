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

# Setup .env if not present
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo ""
  echo "No .env file found. Create one with your Slack user token:"
  echo "  echo 'SLACK_USER_TOKEN=xoxp-your-token' > $SCRIPT_DIR/.env"
else
  echo "Token: loaded from $SCRIPT_DIR/.env"
fi

echo ""
echo "Usage: slack --help"
