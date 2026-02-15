#!/bin/bash
# beads-session-start.sh — Claude Code SessionStart hook
# Detects beads projects, finds active issue, configures OTEL token tracking.
# Installed globally in ~/.claude/hooks/ to work across all projects.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Only act in beads-enabled projects
if [ ! -d "${CWD}/.beads" ]; then
  exit 0
fi

# Find active issue (in_progress, owned by current user)
ACTIVE_ISSUE=""
if command -v bd &>/dev/null; then
  ACTIVE_ISSUE=$(bd list --status=in_progress --json 2>/dev/null \
    | jq -r '.[0].id // empty' 2>/dev/null || true)
fi

# Write session-to-issue mapping
SESSION_MAP="${CWD}/.beads/.session-map.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROJECT=$(basename "$CWD")

echo "{\"timestamp\":\"${TIMESTAMP}\",\"session_id\":\"${SESSION_ID}\",\"issue_id\":\"${ACTIVE_ISSUE}\",\"project\":\"${PROJECT}\",\"event\":\"session_start\"}" \
  >> "$SESSION_MAP"

# Set OTEL env vars for the session via CLAUDE_ENV_FILE
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export CLAUDE_CODE_ENABLE_TELEMETRY=1' >> "$CLAUDE_ENV_FILE"
  echo 'export OTEL_METRICS_EXPORTER=console' >> "$CLAUDE_ENV_FILE"
  echo 'export OTEL_LOGS_EXPORTER=console' >> "$CLAUDE_ENV_FILE"

  ATTRS="project=${PROJECT}"
  if [ -n "$ACTIVE_ISSUE" ]; then
    ATTRS="${ATTRS},issue_id=${ACTIVE_ISSUE}"
    # Also write .current-issue for other tools to read
    echo "$ACTIVE_ISSUE" > "${CWD}/.beads/.current-issue"
  fi
  echo "export OTEL_RESOURCE_ATTRIBUTES=\"${ATTRS}\"" >> "$CLAUDE_ENV_FILE"
fi

exit 0
