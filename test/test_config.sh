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
