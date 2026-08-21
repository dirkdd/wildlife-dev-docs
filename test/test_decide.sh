#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
. "$(dirname "$0")/../lib/config.sh"
. "$(dirname "$0")/../lib/decide.sh"

NOW=1000000
FRESH=$((NOW - 60))
STALE=$((NOW - 5000))
# A window reset comfortably in the future, so it never itself explains an
# ALLOW in the assertions below that are really testing pct/tool/age.
RESET_FUTURE=$((NOW + 3600))
RESET_PAST=$((NOW - 5))

assert_eq "$(decide 10 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "ALLOW" "well under both thresholds allows"
assert_eq "$(decide 89 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "ALLOW" "just under the drain threshold allows"
assert_eq "$(decide 89 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "ALLOW" "spawns allowed just under the drain threshold"

assert_eq "$(decide 90 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "DENY_SPAWN" "at the drain threshold spawns are denied"
assert_eq "$(decide 94 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "DENY_SPAWN" "below freeze, spawns are denied"
assert_eq "$(decide 94 Task "$NOW" "$FRESH" "$RESET_FUTURE")"  "DENY_SPAWN" "legacy Task name is also denied"
assert_eq "$(decide 94 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "ALLOW" "in the drain band non-spawn tools still run"
assert_eq "$(decide 94 Read "$NOW" "$FRESH" "$RESET_FUTURE")"  "ALLOW" "in the drain band reads still run"

assert_eq "$(decide 95 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "FREEZE" "at the freeze threshold everything freezes"
assert_eq "$(decide 95 Read "$NOW" "$FRESH" "$RESET_FUTURE")"  "FREEZE" "read-only tools freeze too"
assert_eq "$(decide 99 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "FREEZE" "freeze outranks the spawn denial"

# Fail open on anything unusable.
assert_eq "$(decide UNKNOWN Bash "$NOW" "$FRESH" "$RESET_FUTURE")" "ALLOW" "UNKNOWN percent allows"
assert_eq "$(decide 99 Bash "$NOW" "$STALE" "$RESET_FUTURE")"      "ALLOW" "stale state allows"
assert_eq "$(decide 99 Bash "$NOW" "" "$RESET_FUTURE")"            "ALLOW" "missing timestamp allows"
assert_eq "$(decide "" Bash "$NOW" "$FRESH" "$RESET_FUTURE")"      "ALLOW" "empty percent allows"
assert_eq "$(decide 9x Bash "$NOW" "$FRESH" "$RESET_FUTURE")"      "ALLOW" "non-numeric percent allows"

# A clock that jumped backwards must not read as fresh-and-frozen forever.
assert_eq "$(decide 99 Bash "$NOW" "$((NOW + 9999))" "$RESET_FUTURE")" "ALLOW" "future timestamp allows"

# Reset staleness (fix round 1, FIX A). A state that is otherwise fresh and
# hot but whose window has already turned over must not drive a decision.
assert_eq "$(decide 99 Bash "$NOW" "$FRESH" "$RESET_PAST")"   "ALLOW" "a passed reset allows even at 99%"
assert_eq "$(decide 99 Bash "$NOW" "$FRESH" "$RESET_FUTURE")" "FREEZE" "the same state with a future reset still freezes"
assert_eq "$(decide 92 Agent "$NOW" "$FRESH" "$RESET_PAST")"  "ALLOW" "a passed reset allows a spawn rather than denying it"
