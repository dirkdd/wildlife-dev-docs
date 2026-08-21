#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
export GUARD_DIR="$(dirname "$0")/tmp/state"
mkdir -p "$GUARD_DIR"
. "$(dirname "$0")/../lib/config.sh"
. "$(dirname "$0")/../lib/state.sh"

good="$GUARD_DIR/good.json"
printf '{"used_percentage":46,"resets_at":1787227799,"ts":1787209916}\n' > "$good"
assert_eq "$(read_state "$good")" "46 1787227799 1787209916" "parses a well formed state file"

# Field order must not matter.
reordered="$GUARD_DIR/reordered.json"
printf '{"ts":1787209916,"resets_at":1787227799,"used_percentage":46}\n' > "$reordered"
assert_eq "$(read_state "$reordered")" "46 1787227799 1787209916" "parses fields in any order"

assert_eq "$(read_state "$GUARD_DIR/does-not-exist.json")" "UNKNOWN" "missing file yields UNKNOWN"

malformed="$GUARD_DIR/malformed.json"
printf 'this is not json at all\n' > "$malformed"
assert_eq "$(read_state "$malformed")" "UNKNOWN" "malformed file yields UNKNOWN"

partial="$GUARD_DIR/partial.json"
printf '{"used_percentage":46}\n' > "$partial"
assert_eq "$(read_state "$partial")" "UNKNOWN" "missing fields yield UNKNOWN"

empty="$GUARD_DIR/empty.json"
: > "$empty"
assert_eq "$(read_state "$empty")" "UNKNOWN" "empty file yields UNKNOWN"

# Fail open means exit 0 even when the answer is UNKNOWN.
assert_exit 0 "read_state exits 0 on a missing file" read_state "$GUARD_DIR/nope.json"
