#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
. "$(dirname "$0")/../lib/config.sh"
. "$(dirname "$0")/../lib/decide.sh"

NOW=1000000
FRESH=$((NOW - 60))
STALE=$((NOW - 5000))

assert_eq "$(decide 10 Bash "$NOW" "$FRESH")"  "ALLOW" "well under both thresholds allows"
assert_eq "$(decide 89 Bash "$NOW" "$FRESH")"  "ALLOW" "just under the drain threshold allows"
assert_eq "$(decide 89 Agent "$NOW" "$FRESH")" "ALLOW" "spawns allowed just under the drain threshold"

assert_eq "$(decide 90 Agent "$NOW" "$FRESH")" "DENY_SPAWN" "at the drain threshold spawns are denied"
assert_eq "$(decide 94 Agent "$NOW" "$FRESH")" "DENY_SPAWN" "below freeze, spawns are denied"
assert_eq "$(decide 94 Task "$NOW" "$FRESH")"  "DENY_SPAWN" "legacy Task name is also denied"
assert_eq "$(decide 94 Bash "$NOW" "$FRESH")"  "ALLOW" "in the drain band non-spawn tools still run"
assert_eq "$(decide 94 Read "$NOW" "$FRESH")"  "ALLOW" "in the drain band reads still run"

assert_eq "$(decide 95 Bash "$NOW" "$FRESH")"  "FREEZE" "at the freeze threshold everything freezes"
assert_eq "$(decide 95 Read "$NOW" "$FRESH")"  "FREEZE" "read-only tools freeze too"
assert_eq "$(decide 99 Agent "$NOW" "$FRESH")" "FREEZE" "freeze outranks the spawn denial"

# Fail open on anything unusable.
assert_eq "$(decide UNKNOWN Bash "$NOW" "$FRESH")" "ALLOW" "UNKNOWN percent allows"
assert_eq "$(decide 99 Bash "$NOW" "$STALE")"      "ALLOW" "stale state allows"
assert_eq "$(decide 99 Bash "$NOW" "")"            "ALLOW" "missing timestamp allows"
assert_eq "$(decide "" Bash "$NOW" "$FRESH")"      "ALLOW" "empty percent allows"
assert_eq "$(decide 9x Bash "$NOW" "$FRESH")"      "ALLOW" "non-numeric percent allows"

# A clock that jumped backwards must not read as fresh-and-frozen forever.
assert_eq "$(decide 99 Bash "$NOW" "$((NOW + 9999))")" "ALLOW" "future timestamp allows"
