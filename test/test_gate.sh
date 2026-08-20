#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GUARD_DIR="$(dirname "$0")/tmp/gate"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
export STATE_FILE="$GUARD_DIR/state.json"
export DISABLE_FILE="$GUARD_DIR/DISABLE"
export SLEEP_INCREMENT=1
export RESET_BUFFER=0

payload() { printf '{"hook_event_name":"PreToolUse","tool_name":"%s","tool_input":{},"cwd":"/tmp"}' "$1"; }
write_state() { printf '{"used_percentage":%s,"resets_at":%s,"ts":%s}\n' "$1" "$2" "$(date +%s)" > "$STATE_FILE"; }

# Under the drain threshold: silent, empty stdout, exit 0.
write_state 10 "$(( $(date +%s) + 3600 ))"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate"); code=$?
assert_eq "$code" "0"  "below threshold exits 0"
assert_eq "$out"  ""   "below threshold prints nothing"

# Drain band, spawn tool: deny JSON.
write_state 92 "$(( $(date +%s) + 3600 ))"
out=$(payload Agent | bash "$ROOT/hooks/usage-gate"); code=$?
assert_eq "$code" "0" "deny still exits 0"
assert_eq "$(printf '%s' "$out" | grep -c '"permissionDecision":"deny"')" "1" "drain band denies an Agent spawn"
assert_eq "$(printf '%s' "$out" | grep -c '"hookEventName":"PreToolUse"')" "1" "deny JSON names the event"

# Drain band, ordinary tool: allowed.
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
assert_eq "$out" "" "drain band lets non-spawn tools through"

# No state file at all: fail open.
rm -f "$STATE_FILE"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate"); code=$?
assert_eq "$code" "0" "missing state exits 0"
assert_eq "$out"  ""  "missing state prints nothing"

# Freeze band with a reset already past: releases at once, silent.
write_state 99 "$(( $(date +%s) - 5 ))"
start=$(date +%s)
out=$(payload Bash | bash "$ROOT/hooks/usage-gate"); code=$?
elapsed=$(( $(date +%s) - start ))
assert_eq "$code" "0" "freeze release exits 0"
assert_eq "$out"  ""  "freeze release prints nothing, so the call proceeds untouched"
assert_eq "$([ "$elapsed" -le 3 ] && echo fast || echo slow)" "fast" "an already-past reset does not hold"

# Escape hatch beats a freeze.
write_state 99 "$(( $(date +%s) + 3600 ))"
touch "$DISABLE_FILE"
start=$(date +%s)
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
elapsed=$(( $(date +%s) - start ))
rm -f "$DISABLE_FILE"
assert_eq "$([ "$elapsed" -le 3 ] && echo fast || echo slow)" "fast" "DISABLE file skips the freeze entirely"

# Env var escape hatch.
CLAUDE_USAGE_GUARD_OFF=1 out=$(payload Agent | CLAUDE_USAGE_GUARD_OFF=1 bash "$ROOT/hooks/usage-gate")
assert_eq "$out" "" "env var escape hatch suppresses the deny"
