#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GUARD_DIR="$(dirname "$0")/tmp/statusline"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
export STATE_FILE="$GUARD_DIR/state.json"
. "$ROOT/lib/config.sh"
. "$ROOT/lib/state.sh"

payload='{"session_id":"x","rate_limits":{"five_hour":{"used_percentage":46,"resets_at":1787201399}}}'
printf '%s' "$payload" | bash "$ROOT/hooks/usage-statusline" > /dev/null
# used_percentage in the payload is already a percentage (0-100), not a
# 0-to-1 fraction. Pinning it to 46 here, rather than a round number like 50,
# catches a stray *100 immediately: that bug would write 4600, not 46.
assert_eq "$(read_state "$STATE_FILE" | cut -d' ' -f1)" "46" "shim writes the percent unscaled, no stray *100"
assert_eq "$(read_state "$STATE_FILE" | cut -d' ' -f2)" "1787201399" "shim writes the reset"

rm -f "$STATE_FILE"
printf '%s' '{"session_id":"x"}' | bash "$ROOT/hooks/usage-statusline" > /dev/null
assert_eq "$(read_state "$STATE_FILE")" "UNKNOWN" "absent rate_limits writes nothing"

printf '%s' 'not json' | bash "$ROOT/hooks/usage-statusline" > /dev/null
assert_exit 0 "shim exits 0 on garbage" bash -c "printf 'not json' | bash '$ROOT/hooks/usage-statusline'"

assert_eq "$(printf '%s' "$payload" | bash "$ROOT/hooks/usage-statusline" | wc -l | tr -d ' ')" "1" "shim always prints exactly one line"
