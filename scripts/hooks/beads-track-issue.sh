#!/bin/bash
# beads-track-issue.sh — Claude Code PostToolUse hook
# Watches for `bd update <id> --status=in_progress` commands to track
# mid-session issue switches. Updates .beads/.current-issue and appends
# to .beads/.session-map.jsonl for token attribution.

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exitCode // empty')

# Only process successful bd update commands that change status to in_progress
if ! echo "$COMMAND" | grep -qE '^bd update .+ --status[= ]in_progress'; then
  exit 0
fi

# Only if the command succeeded
if [ "$EXIT_CODE" != "0" ]; then
  exit 0
fi

# Extract issue ID (first arg after "bd update")
ISSUE_ID=$(echo "$COMMAND" | sed -n 's/^bd update \([^ ]*\).*/\1/p')

if [ -z "$ISSUE_ID" ] || [ ! -d "${CWD}/.beads" ]; then
  exit 0
fi

# Update .current-issue
echo "$ISSUE_ID" > "${CWD}/.beads/.current-issue"

# Append to session map
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROJECT=$(basename "$CWD")

echo "{\"timestamp\":\"${TIMESTAMP}\",\"session_id\":\"${SESSION_ID}\",\"issue_id\":\"${ISSUE_ID}\",\"project\":\"${PROJECT}\",\"event\":\"issue_switch\"}" \
  >> "${CWD}/.beads/.session-map.jsonl"

exit 0
