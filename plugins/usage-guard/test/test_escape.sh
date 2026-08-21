#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
export GUARD_DIR="$(dirname "$0")/tmp/escape"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
. "$(dirname "$0")/../lib/config.sh"
. "$(dirname "$0")/../lib/escape.sh"

unset CLAUDE_USAGE_GUARD_OFF
assert_exit 1 "guard is active by default" guard_disabled

CLAUDE_USAGE_GUARD_OFF=1
assert_exit 0 "environment variable disables the guard" guard_disabled
unset CLAUDE_USAGE_GUARD_OFF

# Any other value must not disable it. A stray "0" should not stand the guard down.
CLAUDE_USAGE_GUARD_OFF=0
assert_exit 1 "a value of 0 does not disable the guard" guard_disabled
unset CLAUDE_USAGE_GUARD_OFF

touch "$DISABLE_FILE"
assert_exit 0 "DISABLE file disables the guard" guard_disabled
rm -f "$DISABLE_FILE"
assert_exit 1 "removing the DISABLE file re-arms the guard" guard_disabled
