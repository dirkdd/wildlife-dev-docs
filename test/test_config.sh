#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"

# Defaults apply when nothing is set.
( unset GUARD_DIR THRESHOLD_FREEZE
  . "$(dirname "$0")/../lib/config.sh"
  assert_eq "$THRESHOLD_DRAIN" "90" "drain threshold defaults to 90"
  assert_eq "$THRESHOLD_FREEZE" "95" "freeze threshold defaults to 95"
  assert_eq "$STALE_SECONDS" "1200" "staleness ceiling defaults to 1200"
  assert_eq "$SLEEP_INCREMENT" "20" "sleep increment defaults to 20"
  assert_eq "$STATE_FILE" "$GUARD_DIR/state.json" "state file sits under the guard dir"
  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_a )

# An environment override wins.
( export GUARD_DIR=/tmp/ug-test THRESHOLD_FREEZE=42
  . "$(dirname "$0")/../lib/config.sh"
  assert_eq "$GUARD_DIR" "/tmp/ug-test" "GUARD_DIR honors the environment"
  assert_eq "$THRESHOLD_FREEZE" "42" "freeze threshold honors the environment"
  assert_eq "$STATE_FILE" "/tmp/ug-test/state.json" "state file follows the override"
  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_b )

cat /tmp/ug_cfg_a /tmp/ug_cfg_b >/dev/null 2>&1

# --- Fix round 1: relaunch/heartbeat throttle defaults and stamp_due ---

( unset RELAUNCH_STAMP RELAUNCH_THROTTLE GATE_SEEN_STAMP GATE_IDLE_TIMEOUT
  export GUARD_DIR=/tmp/ug-cfg-c
  . "$(dirname "$0")/../lib/config.sh"
  assert_eq "$RELAUNCH_STAMP" "/tmp/ug-cfg-c/last-relaunch" "relaunch stamp sits under the guard dir by default"
  assert_eq "$RELAUNCH_THROTTLE" "60" "relaunch throttle defaults to 60"
  assert_eq "$GATE_SEEN_STAMP" "/tmp/ug-cfg-c/gate-seen" "gate-seen stamp sits under the guard dir by default"
  assert_eq "$GATE_IDLE_TIMEOUT" "1800" "gate idle timeout defaults to 1800"

  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_c )
cat /tmp/ug_cfg_c >/dev/null 2>&1

# Fix round 2, FIX 5: the previous version of this assertion ran a COPY of
# the screening case statement inline and then asserted the copy against
# itself, which would pass even with the real screen in lib/config.sh
# deleted. Export the malformed value and re-source config.sh for real, same
# as the "environment override wins" block above, so this exercises the
# shipped screen rather than a stand-in for it. Same class of guard as
# HOOK_TIMEOUT_SECONDS and PROBE_TIMEOUT (leading zero parses as octal in
# bash arithmetic).
( export GUARD_DIR=/tmp/ug-cfg-e RELAUNCH_THROTTLE=0100
  . "$(dirname "$0")/../lib/config.sh"
  assert_eq "$RELAUNCH_THROTTLE" "60" "a leading-zero RELAUNCH_THROTTLE falls back to the default"
  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_e )
cat /tmp/ug_cfg_e >/dev/null 2>&1

( export GUARD_DIR=/tmp/ug-cfg-f GATE_IDLE_TIMEOUT=0900
  . "$(dirname "$0")/../lib/config.sh"
  assert_eq "$GATE_IDLE_TIMEOUT" "1800" "a leading-zero GATE_IDLE_TIMEOUT falls back to the default"
  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_f )
cat /tmp/ug_cfg_f >/dev/null 2>&1

( export GUARD_DIR=/tmp/ug-cfg-d RELAUNCH_THROTTLE=60
  rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
  . "$(dirname "$0")/../lib/config.sh"
  NOW=1000000

  # First call: no stamp exists yet, so it is due, and it writes the stamp.
  stamp_due "$GUARD_DIR/stamp" "$RELAUNCH_THROTTLE" "$NOW"
  assert_eq "$?" "0" "stamp_due fires on a fresh (missing) stamp"
  assert_eq "$(cat "$GUARD_DIR/stamp")" "$NOW" "stamp_due writes the epoch it was given"

  # Immediately after: inside the throttle window, so it must not fire again.
  stamp_due "$GUARD_DIR/stamp" "$RELAUNCH_THROTTLE" "$((NOW + 5))"
  assert_eq "$?" "1" "stamp_due does not fire again inside the throttle window"
  assert_eq "$(cat "$GUARD_DIR/stamp")" "$NOW" "a throttled call leaves the stamp untouched"

  # Once the throttle has elapsed, it fires again and moves the stamp.
  stamp_due "$GUARD_DIR/stamp" "$RELAUNCH_THROTTLE" "$((NOW + 61))"
  assert_eq "$?" "0" "stamp_due fires again once the throttle has elapsed"
  assert_eq "$(cat "$GUARD_DIR/stamp")" "$((NOW + 61))" "the stamp advances to the new call time"

  # relaunch_due and gate_seen are stamp_due against their own configured
  # files, independent of each other.
  rm -f "$RELAUNCH_STAMP" "$GATE_SEEN_STAMP"
  relaunch_due "$NOW"
  assert_eq "$?" "0" "relaunch_due fires on a fresh RELAUNCH_STAMP"
  gate_seen "$NOW"
  assert_eq "$?" "0" "gate_seen fires on a fresh GATE_SEEN_STAMP"
  assert_eq "$([ -f "$RELAUNCH_STAMP" ] && [ -f "$GATE_SEEN_STAMP" ] && echo both || echo missing)" "both" "relaunch_due and gate_seen write to two independent stamp files"

  printf '%s %s\n' "$ASSERT_TOTAL" "$ASSERT_FAILED" > /tmp/ug_cfg_d )
cat /tmp/ug_cfg_d >/dev/null 2>&1
