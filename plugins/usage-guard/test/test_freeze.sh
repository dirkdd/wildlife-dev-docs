#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
export GUARD_DIR="$(dirname "$0")/tmp/freeze"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
export SLEEP_INCREMENT=1
export RESET_BUFFER=0
. "$(dirname "$0")/../lib/config.sh"
. "$(dirname "$0")/../lib/escape.sh"
. "$(dirname "$0")/../lib/freeze.sh"

# A reset already in the past releases immediately.
now=$(date +%s)
start=$now
result=$(freeze_until $((now - 10)) $((now + 3600)))
elapsed=$(( $(date +%s) - start ))
assert_eq "$result" "RESET" "a past reset releases immediately"
assert_eq "$([ "$elapsed" -le 2 ] && echo fast || echo slow)" "fast" "past reset does not sleep"

# A reset a couple of seconds out is waited for.
now=$(date +%s)
start=$now
result=$(freeze_until $((now + 2)) $((now + 3600)))
elapsed=$(( $(date +%s) - start ))
assert_eq "$result" "RESET" "a near reset is waited for then released"
assert_eq "$([ "$elapsed" -ge 2 ] && echo waited || echo early)" "waited" "it actually waited for the reset"

# The hard deadline wins over a distant reset.
now=$(date +%s)
start=$now
result=$(freeze_until $((now + 3600)) $((now + 2)))
elapsed=$(( $(date +%s) - start ))
assert_eq "$result" "DEADLINE" "the hard deadline releases before the reset"
assert_eq "$([ "$elapsed" -le 4 ] && echo bounded || echo overran)" "bounded" "deadline release is prompt"

# The DISABLE file thaws a freeze within one increment.
now=$(date +%s)
start=$now
( sleep 2; touch "$DISABLE_FILE" ) &
helper=$!
result=$(freeze_until $((now + 3600)) $((now + 3600)))
elapsed=$(( $(date +%s) - start ))
wait "$helper" 2>/dev/null
rm -f "$DISABLE_FILE"
assert_eq "$result" "ESCAPE" "the DISABLE file thaws the freeze"
assert_eq "$([ "$elapsed" -le 6 ] && echo prompt || echo slow)" "prompt" "thaw happens within a couple of increments"
