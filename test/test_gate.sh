#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GUARD_DIR="$(dirname "$0")/tmp/gate"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
export STATE_FILE="$GUARD_DIR/state.json"
export DISABLE_FILE="$GUARD_DIR/DISABLE"
export SLEEP_INCREMENT=1
export RESET_BUFFER=0

# Fix round 1, FIX B: the gate can now launch usage-poller on its own. Point
# it at a harmless stub for the whole file so nothing here ever shells out to
# the real poller, which would in turn shell out to `claude -p "/usage"`.
# The stub just appends a line to a marker file so tests can count launches.
#
# Fix round 2, FIX 2: the gate no longer honours a generic POLLER_BIN from
# the environment (that was itself the defect: an inherited path is data to
# every other config value but this one names something to EXECUTE). The
# test seam is now the unambiguously-named USAGE_GUARD_TEST_POLLER, which no
# real shell rc or .env would ever set by accident.
POLLER_MARKER="$GUARD_DIR/poller-launches"
export USAGE_GUARD_TEST_POLLER="$GUARD_DIR/stub-poller"
cat > "$USAGE_GUARD_TEST_POLLER" <<STUB
#!/usr/bin/env bash
printf '%s\n' "\$\$" >> "$POLLER_MARKER"
STUB
chmod +x "$USAGE_GUARD_TEST_POLLER"
launch_count() { [ -f "$POLLER_MARKER" ] && wc -l < "$POLLER_MARKER" | tr -d ' ' || printf '0'; }
wait_for_launch() {
  # The gate backgrounds the stub and never waits on it, so give it a short
  # window to actually write before asserting on the marker.
  local tries=0
  while [ "$(launch_count)" = "0" ] && [ "$tries" -lt 20 ]; do
    sleep 0.1; tries=$((tries + 1))
  done
}

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

# Drain band, ordinary tool: proceeds (no permission decision either way).
# Task 14: this used to assert an empty $out. It no longer can, because the
# WARN check has no upper bound of its own (see lib/decide.sh) and this is
# the first non-throttled WARN of the whole file, so it now carries the
# advisory alongside the silent allow.
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
assert_eq "$(printf '%s' "$out" | grep -c 'permissionDecision')" "0" "drain band still lets non-spawn tools proceed"
assert_eq "$(printf '%s' "$out" | grep -c 'systemMessage')" "1" "drain band non-spawn tools now carry the warn advisory too"

# No state file at all: fail open, and (FIX B) relaunch the poller.
rm -f "$STATE_FILE" "$POLLER_MARKER"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate"); code=$?
assert_eq "$code" "0" "missing state exits 0"
assert_eq "$out"  ""  "missing state prints nothing"
wait_for_launch
assert_eq "$(launch_count)" "1" "missing state relaunches the poller exactly once"

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

# tool_name extraction takes the FIRST (outermost) match, not a decoy nested
# in tool_input.
write_state 92 "$(( $(date +%s) + 3600 ))"
decoy_bash='{"tool_name":"Bash","tool_input":{"tool_name":"Agent"}}'
out=$(printf '%s' "$decoy_bash" | bash "$ROOT/hooks/usage-gate")
assert_eq "$out" "" "a decoy tool_name inside tool_input does not trigger a false deny"

decoy_agent='{"tool_name":"Agent","tool_input":{"tool_name":"Bash"}}'
out=$(printf '%s' "$decoy_agent" | bash "$ROOT/hooks/usage-gate")
assert_eq "$(printf '%s' "$out" | grep -c '"permissionDecision":"deny"')" "1" "a decoy tool_name inside tool_input does not bypass a real Agent spawn's deny"

# A malformed HOOK_TIMEOUT_SECONDS (leading zero parses as octal in bash
# arithmetic) must not crash the freeze-deadline computation.
write_state 99 "$(( $(date +%s) - 5 ))"
start=$(date +%s)
out=$(payload Bash | HOOK_TIMEOUT_SECONDS=08000 bash "$ROOT/hooks/usage-gate"); code=$?
elapsed=$(( $(date +%s) - start ))
assert_eq "$code" "0" "malformed HOOK_TIMEOUT_SECONDS still exits 0"
assert_eq "$out" "" "malformed HOOK_TIMEOUT_SECONDS still emits nothing on an already-past reset"

# --- Fix round 1 ---

# A healthy fresh state must not relaunch the poller, and every path
# (including this fast ALLOW one) must touch the heartbeat stamp (FIX D).
rm -f "$POLLER_MARKER" "$GUARD_DIR/gate-seen"
write_state 10 "$(( $(date +%s) + 3600 ))"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
sleep 0.3
assert_eq "$out" "" "healthy state still prints nothing"
assert_eq "$(launch_count)" "0" "healthy state does not relaunch the poller"
assert_eq "$([ -s "$GUARD_DIR/gate-seen" ] && echo touched || echo missing)" "touched" "the fast ALLOW path still touches the gate heartbeat stamp"

# Stale state (ts far older than STALE_SECONDS) relaunches the poller, same
# as UNKNOWN, even though decide() itself fails open to ALLOW for it.
rm -f "$POLLER_MARKER" "$GUARD_DIR/last-relaunch"
printf '{"used_percentage":50,"resets_at":%s,"ts":%s}\n' "$(( $(date +%s) + 3600 ))" "$(( $(date +%s) - 5000 ))" > "$STATE_FILE"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
wait_for_launch
assert_eq "$out" "" "stale state still prints nothing"
assert_eq "$(launch_count)" "1" "stale state relaunches the poller exactly once"

# A second call while the state is still stale/missing must be throttled:
# RELAUNCH_STAMP was just written above, so this one must not launch again.
rm -f "$STATE_FILE"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate")
sleep 0.3
assert_eq "$out" "" "throttled relaunch still prints nothing"
assert_eq "$(launch_count)" "1" "a second stale/missing call within RELAUNCH_THROTTLE does not relaunch again"

# --- Fix round 2 ---

# FIX 1: the relaunch must not depend on the poller script's own executable
# bit. A stub written WITHOUT chmod +x is supposed to prove the gate runs it
# via `bash` rather than executing it directly, but that only proves
# anything on a filesystem where a plain redirect creates a non-executable
# file and `chmod -x` actually clears the bit. On this filesystem neither
# holds (see commit 7425987 and the ledger note this fix responds to): a
# heredoc-created file already comes out executable, so the assertion below
# would pass identically whether the gate ran the stub via `bash` or
# executed it directly, proving nothing about the property it claims to
# cover. Try to force the non-executable state with an explicit chmod -x and
# check it actually took; run the exec-bit assertion only if it did, and
# skip with a visible message otherwise so this never silently reports
# coverage it did not get.
NOEXEC_MARKER="$GUARD_DIR/noexec-launches"
NOEXEC_POLLER="$GUARD_DIR/stub-poller-noexec"
cat > "$NOEXEC_POLLER" <<STUB
#!/usr/bin/env bash
printf '%s\n' "\$\$" >> "$NOEXEC_MARKER"
STUB
chmod -x "$NOEXEC_POLLER" 2>/dev/null
if [ -x "$NOEXEC_POLLER" ]; then
  printf '  skip the exec-bit poller-stub check (chmod -x does not take effect on this filesystem)\n'
else
  rm -f "$STATE_FILE" "$GUARD_DIR/last-relaunch" "$NOEXEC_MARKER"
  out=$(payload Bash | USAGE_GUARD_TEST_POLLER="$NOEXEC_POLLER" bash "$ROOT/hooks/usage-gate")
  tries=0
  while [ ! -s "$NOEXEC_MARKER" ] && [ "$tries" -lt 20 ]; do sleep 0.1; tries=$((tries + 1)); done
  assert_eq "$out" "" "a non-executable poller stub still prints nothing on the gate's stdout"
  assert_eq "$([ -s "$NOEXEC_MARKER" ] && echo ran || echo did-not-run)" "ran" "the relaunch runs the poller through bash, independent of its executable bit"
fi

# The platform-independent form of the same property: assert the gate's own
# source invokes the poller as `bash "$POLLER_BIN"` rather than executing it
# directly. This is what actually catches a regression back to direct
# execution, regardless of what any given filesystem does with exec bits.
assert_eq "$(grep -c '^[[:space:]]*bash "\$POLLER_BIN"' "$ROOT/hooks/usage-gate")" "1" "the gate invokes the poller as bash \"\$POLLER_BIN\", not by executing it directly"

# FIX 2: a POLLER_BIN inherited from the environment must be ignored. Point
# it at a decoy that would prove itself if executed, then confirm the decoy
# never ran while the legitimate USAGE_GUARD_TEST_POLLER stub still did.
DECOY_MARKER="$GUARD_DIR/decoy-launches"
DECOY_POLLER="$GUARD_DIR/decoy-poller"
cat > "$DECOY_POLLER" <<STUB
#!/usr/bin/env bash
printf '%s\n' "\$\$" >> "$DECOY_MARKER"
STUB
chmod +x "$DECOY_POLLER"
rm -f "$STATE_FILE" "$GUARD_DIR/last-relaunch" "$POLLER_MARKER" "$DECOY_MARKER"
out=$(payload Bash | POLLER_BIN="$DECOY_POLLER" bash "$ROOT/hooks/usage-gate")
wait_for_launch
assert_eq "$out" "" "an inherited POLLER_BIN still prints nothing on the gate's stdout"
assert_eq "$([ -e "$DECOY_MARKER" ] && echo ran || echo did-not-run)" "did-not-run" "an inherited POLLER_BIN is ignored, not executed"
assert_eq "$(launch_count)" "1" "the gate still launches its own poller (via USAGE_GUARD_TEST_POLLER) rather than the decoy"

# --- Task 14: warning band at 80% ---

write_state 85 "$(( $(date +%s) + 3600 ))"
rm -f "$GUARD_DIR/last-warn"
out=$(payload Bash | bash "$ROOT/hooks/usage-gate"); code=$?
assert_eq "$code" "0" "warn path exits 0"
assert_eq "$(printf '%s' "$out" | grep -c 'permissionDecision')" "0" "warn never emits a permission decision"
assert_eq "$([ -n "$out" ] && echo present || echo empty)" "present" "the first warn actually emits a message"

out2=$(payload Bash | bash "$ROOT/hooks/usage-gate")
assert_eq "$out2" "" "second warn inside the throttle window is silent"
