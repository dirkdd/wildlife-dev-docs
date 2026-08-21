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

# Warning band (Task 14): 80 up to (and, for non-spawn tools, past) the drain
# threshold. These four replace what used to be plain ALLOW/ALLOW pairs at
# 89% and 94%, now that a fourth WARN return sits between DENY_SPAWN and the
# final ALLOW. Order matters: FREEZE, then DENY_SPAWN, then WARN, then ALLOW.
assert_eq "$(decide 79 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "ALLOW" "just under the warn threshold allows"
assert_eq "$(decide 80 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "WARN"  "at the warn threshold warns"
assert_eq "$(decide 89 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "WARN"  "top of the warn band still warns"
assert_eq "$(decide 89 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "WARN"  "spawns warn but are not denied below the drain"
assert_eq "$(decide 80 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "WARN"  "spawns warn but are not denied at the warn threshold"

assert_eq "$(decide 90 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "DENY_SPAWN" "at the drain threshold spawns are denied"
assert_eq "$(decide 94 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "DENY_SPAWN" "below freeze, spawns are denied"
assert_eq "$(decide 94 Task "$NOW" "$FRESH" "$RESET_FUTURE")"  "DENY_SPAWN" "legacy Task name is also denied"
# The WARN check sits after the drain block with no upper bound of its own,
# so a non-spawn tool past the drain threshold is not denied but still
# warns; it only stops warning once FREEZE takes over at 95%.
assert_eq "$(decide 94 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "WARN" "in the drain band non-spawn tools still run, but now they warn"
assert_eq "$(decide 94 Read "$NOW" "$FRESH" "$RESET_FUTURE")"  "WARN" "in the drain band reads still run, but now they warn"

assert_eq "$(decide 95 Bash "$NOW" "$FRESH" "$RESET_FUTURE")"  "FREEZE" "at the freeze threshold everything freezes"
assert_eq "$(decide 95 Read "$NOW" "$FRESH" "$RESET_FUTURE")"  "FREEZE" "read-only tools freeze too"
assert_eq "$(decide 99 Agent "$NOW" "$FRESH" "$RESET_FUTURE")" "FREEZE" "freeze outranks the spawn denial"
# Already covered above ("at the freeze threshold everything freezes"), so
# not repeated as a separate "freeze still outranks warn" assertion.
assert_eq "$(decide 85 Bash "$NOW" "$STALE" "$RESET_FUTURE")"  "ALLOW" "stale state does not warn"

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

# A five-hour window can never reset more than six hours out. This is the
# real hazard: a statusline payload that hands over resets_at in
# milliseconds passes the digit screen and still reads as "in the future"
# when compared against a seconds-based now, so a seconds-to-milliseconds
# confusion looks exactly like this value (now + 30000, over 8 hours out).
RESET_UNIT_CONFUSED=$((NOW + 30000))
assert_eq "$(decide 99 Bash "$NOW" "$FRESH" "$RESET_UNIT_CONFUSED")" "ALLOW" "a resets_at more than six hours out fails open instead of freezing on a unit confusion"
