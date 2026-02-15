#!/bin/bash
# beads-collect-tokens.sh — Claude Code Stop hook
# Collects token usage from a session transcript and writes a normalized
# record to .beads/token-usage.jsonl, joined with the session-map for
# issue attribution.
# Installed globally in ~/.claude/hooks/ to work across all projects.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Only act in beads-enabled projects
if [ -z "$CWD" ] || [ ! -d "${CWD}/.beads" ]; then
  exit 0
fi

# Must have a session ID
if [ -z "$SESSION_ID" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROJECT=$(basename "$CWD")
SESSION_MAP="${CWD}/.beads/.session-map.jsonl"
TOKEN_FILE="${CWD}/.beads/token-usage.jsonl"
CURRENT_ISSUE_FILE="${CWD}/.beads/.current-issue"

# --- Look up issue_id from session map, then fall back to .current-issue ---
ISSUE_ID=""
if [ -f "$SESSION_MAP" ]; then
  # Find the last entry for this session (could be session_start or issue_switch).
  # The last entry reflects the most recent issue attribution.
  ISSUE_ID=$(grep "\"session_id\":\"${SESSION_ID}\"" "$SESSION_MAP" \
    | tail -1 \
    | jq -r '.issue_id // empty' 2>/dev/null || true)
fi

# Fallback: read .current-issue if session-map had no issue_id
if [ -z "$ISSUE_ID" ] && [ -f "$CURRENT_ISSUE_FILE" ]; then
  ISSUE_ID=$(tr -d '[:space:]' < "$CURRENT_ISSUE_FILE" || true)
fi

# --- Extract usage from transcript ---
# The transcript is a JSONL file with entry types: assistant, user, system,
# progress, file-history-snapshot, queue-operation.
#
# Token data lives in assistant entries at .message.usage
# Model name lives in assistant entries at .message.model
# Duration is computed from first to last timestamp
# Turns are counted as user-type entries

INPUT_TOKENS=0
OUTPUT_TOKENS=0
CACHE_READ=0
CACHE_CREATION=0
COST_USD=0
DURATION_MS=0
NUM_TURNS=0
MODEL=""

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Single jq pass to extract tokens, model, duration, and turn count
  USAGE_SUMMARY=$(jq -s '
    # --- Token sums from assistant .message.usage ---
    [.[] | select(.type == "assistant" and .message.usage.input_tokens != null) | .message.usage] as $usages |

    ($usages | map(.input_tokens // 0) | add // 0) as $input |
    ($usages | map(.output_tokens // 0) | add // 0) as $output |
    ($usages | map(.cache_read_input_tokens // .cacheReadInputTokens // 0) | add // 0) as $cache_read |
    ($usages | map(.cache_creation_input_tokens // .cacheCreationInputTokens // 0) | add // 0) as $cache_creation |

    # --- Model: first non-synthetic assistant .message.model ---
    ([.[] | select(.type == "assistant" and .message.model != null and .message.model != "<synthetic>") | .message.model] | first // "") as $model |

    # --- Duration: last timestamp minus first timestamp (ms) ---
    [.[] | select(.timestamp != null) | .timestamp] as $ts |
    (if ($ts | length) >= 2
     then
       (($ts | last | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) -
        ($ts | first | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601)) * 1000
     else 0
     end) as $duration |

    # --- Turns: count user-type entries ---
    ([.[] | select(.type == "user")] | length) as $turns |

    # --- Cost: calculate from tokens and model pricing ---
    # Pricing per million tokens (USD)
    (if ($model | test("^claude-opus"))
     then { input: 15, output: 75, cache_read: 1.875, cache_create: 18.75 }
     elif ($model | test("^claude-sonnet"))
     then { input: 3, output: 15, cache_read: 0.375, cache_create: 3.75 }
     elif ($model | test("^claude-haiku"))
     then { input: 0.80, output: 4, cache_read: 0.10, cache_create: 1 }
     else { input: 15, output: 75, cache_read: 1.875, cache_create: 18.75 }
     end) as $pricing |

    (($input * $pricing.input + $output * $pricing.output +
      $cache_read * $pricing.cache_read + $cache_creation * $pricing.cache_create)
     / 1000000) as $cost |

    {
      input_tokens: $input,
      output_tokens: $output,
      cache_read_tokens: $cache_read,
      cache_creation_tokens: $cache_creation,
      model: $model,
      duration_ms: $duration,
      num_turns: $turns,
      total_cost_usd: ($cost * 100 | round / 100)
    }
  ' "$TRANSCRIPT_PATH" 2>/dev/null || echo '{}')

  if [ -n "$USAGE_SUMMARY" ] && [ "$USAGE_SUMMARY" != "{}" ]; then
    INPUT_TOKENS=$(echo "$USAGE_SUMMARY" | jq -r '.input_tokens // 0')
    OUTPUT_TOKENS=$(echo "$USAGE_SUMMARY" | jq -r '.output_tokens // 0')
    CACHE_READ=$(echo "$USAGE_SUMMARY" | jq -r '.cache_read_tokens // 0')
    CACHE_CREATION=$(echo "$USAGE_SUMMARY" | jq -r '.cache_creation_tokens // 0')
    COST_USD=$(echo "$USAGE_SUMMARY" | jq -r '.total_cost_usd // 0')
    DURATION_MS=$(echo "$USAGE_SUMMARY" | jq -r '.duration_ms // 0')
    NUM_TURNS=$(echo "$USAGE_SUMMARY" | jq -r '.num_turns // 0')
    MODEL=$(echo "$USAGE_SUMMARY" | jq -r '.model // ""')
  fi
fi

# Don't write a record if we got zero usage (empty/missing transcript)
if [ "$INPUT_TOKENS" = "0" ] && [ "$OUTPUT_TOKENS" = "0" ]; then
  exit 0
fi

# --- Deduplicate: remove any existing record for this session ---
# The Stop hook can fire multiple times per session (resume, /clear, etc.).
# Replace the previous record rather than appending duplicates.
if [ -f "$TOKEN_FILE" ] && grep -q "\"session_id\":\"${SESSION_ID}\"" "$TOKEN_FILE" 2>/dev/null; then
  grep -v "\"session_id\":\"${SESSION_ID}\"" "$TOKEN_FILE" > "${TOKEN_FILE}.tmp" || true
  mv "${TOKEN_FILE}.tmp" "$TOKEN_FILE"
fi

# --- Write normalized record ---
jq -n \
  --arg timestamp "$TIMESTAMP" \
  --arg session_id "$SESSION_ID" \
  --arg issue_id "$ISSUE_ID" \
  --arg project "$PROJECT" \
  --arg model "$MODEL" \
  --argjson input_tokens "$INPUT_TOKENS" \
  --argjson output_tokens "$OUTPUT_TOKENS" \
  --argjson cache_read_tokens "$CACHE_READ" \
  --argjson cache_creation_tokens "$CACHE_CREATION" \
  --argjson total_cost_usd "$COST_USD" \
  --argjson duration_ms "$DURATION_MS" \
  --argjson num_turns "$NUM_TURNS" \
  '{
    timestamp: $timestamp,
    session_id: $session_id,
    issue_id: $issue_id,
    project: $project,
    model: $model,
    input_tokens: $input_tokens,
    output_tokens: $output_tokens,
    cache_read_tokens: $cache_read_tokens,
    cache_creation_tokens: $cache_creation_tokens,
    total_cost_usd: $total_cost_usd,
    duration_ms: $duration_ms,
    num_turns: $num_turns
  }' -c >> "$TOKEN_FILE"

exit 0
