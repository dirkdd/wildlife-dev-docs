#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GUARD_DIR="$(dirname "$0")/tmp/poller"
rm -rf "$GUARD_DIR"; mkdir -p "$GUARD_DIR"
export STATE_FILE="$GUARD_DIR/state.json"
. "$ROOT/lib/config.sh"
. "$ROOT/lib/timeconv.sh"
. "$ROOT/lib/state.sh"
POLLER_LIB_ONLY=1 . "$ROOT/hooks/usage-poller"

# Extracting from a realistic ~/.claude.json fragment.
fake="$GUARD_DIR/claude.json"
cat > "$fake" <<'JSON'
{"someOtherKey":1,"cachedUsageUtilization":{"fetchedAtMs":1787188917258,"accountUuid":"abc","utilization":{"five_hour":{"utilization":46,"resets_at":"2026-08-20T04:49:59.665316+00:00","limit_dollars":null}}}}
JSON
assert_eq "$(read_cache "$fake")" "46 2026-08-20T04:49:59.665316+00:00" "extracts percent and reset from the cache"

assert_eq "$(read_cache "$GUARD_DIR/missing.json")" "" "missing cache yields empty"

nokey="$GUARD_DIR/nokey.json"
printf '{"unrelated":true}\n' > "$nokey"
assert_eq "$(read_cache "$nokey")" "" "cache without the key yields empty"

# Both blocks present, different values: must pick five_hour, not seven_day.
both="$GUARD_DIR/both.json"
cat > "$both" <<'JSON'
{"cachedUsageUtilization":{"utilization":{"five_hour":{"utilization":46,"resets_at":"2026-08-20T04:49:59.665316+00:00"},"seven_day":{"utilization":12,"resets_at":"2026-08-25T00:00:00.000000+00:00"}}}}
JSON
assert_eq "$(read_cache "$both")" "46 2026-08-20T04:49:59.665316+00:00" "five_hour is picked over seven_day when both are present"

# The interval ladder.
assert_eq "$(interval_for 10)" "900" "below 70 polls every 15 minutes"
assert_eq "$(interval_for 69)" "900" "just below 70 polls every 15 minutes"
assert_eq "$(interval_for 70)" "300" "at 70 polls every 5 minutes"
assert_eq "$(interval_for 89)" "300" "just below 90 polls every 5 minutes"
assert_eq "$(interval_for 90)" "120" "at 90 polls every 2 minutes"
assert_eq "$(interval_for 99)" "120" "near the cap polls every 2 minutes"
assert_eq "$(interval_for UNKNOWN)" "300" "an unknown percent falls back to 5 minutes"

# Atomic write produces a file the state reader accepts.
write_state_file 46 1787201399
out=$(read_state "$STATE_FILE")
assert_eq "$(printf '%s' "$out" | cut -d' ' -f1)" "46" "written state round-trips the percent"
assert_eq "$(printf '%s' "$out" | cut -d' ' -f2)" "1787201399" "written state round-trips the reset"
assert_eq "$([ -e "$STATE_FILE.tmp" ] && echo leftover || echo clean)" "clean" "atomic write leaves no temp file"

# Lock acquisition: fresh, held, stale, and corrupt-pid cases.
rm -rf "$LOCK_FILE"
acquire_lock
assert_eq "$?" "0" "acquire_lock succeeds against a fresh GUARD_DIR"
assert_eq "$(cat "$LOCK_FILE/pid" 2>/dev/null)" "$$" "acquire_lock writes a pid file containing the current pid"

acquire_lock
assert_eq "$?" "1" "a second acquire_lock fails while the recorded pid is alive"

rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
# 4194304 is one past Linux's default pid_max (4194303) and out of range for
# Windows/macOS pid spaces too, so it cannot be a live process here.
printf '4194304\n' > "$LOCK_FILE/pid"
acquire_lock
assert_eq "$?" "0" "a stale lock (dead pid) is reclaimed"
assert_eq "$(cat "$LOCK_FILE/pid" 2>/dev/null)" "$$" "reclaiming a stale lock rewrites the pid file to the current pid"

rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
printf 'not-a-pid\n' > "$LOCK_FILE/pid"
acquire_lock
assert_eq "$?" "0" "a lock with a garbage pid file is treated as stale and reclaimed"

rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
acquire_lock
assert_eq "$?" "0" "a lock with a missing pid file is treated as stale and reclaimed"

# The trap must use rm -rf, not rmdir, since the lock dir is never empty once
# it holds a pid file; rmdir on a non-empty directory fails.
rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"; printf '%s\n' "$$" > "$LOCK_FILE/pid"
rm -rf "$LOCK_FILE"
assert_eq "$([ -e "$LOCK_FILE" ] && echo present || echo gone)" "gone" "rm -rf removes a lock directory that contains a pid file"

# --- Fix round 2 ---

# Simulate the pid write failing. acquire_lock is a shell function sourced
# into THIS shell (POLLER_LIB_ONLY dot-sources it above), and bash resolves
# a shell function ahead of the printf builtin, so shadowing printf here
# intercepts the exact `printf ... > "$LOCK_FILE/pid"` call inside
# acquire_lock. Redirection is set up by the shell before the command runs,
# so "$LOCK_FILE/pid" still gets created/truncated as normal; only the
# reported exit status is forced to 1. That is precisely the condition
# acquire_lock's `if printf ... ; then` branches on, so this is a faithful
# simulation of "the write failed" without needing OS-level permission
# tricks (which are unreliable for directories on this Windows/Git Bash
# machine). The shadow is installed and removed immediately around the one
# call it targets so it cannot affect any other assertion.
printf() { command printf "$@"; return 1; }
rm -rf "$LOCK_FILE"
acquire_lock
pidwrite_status=$?
unset -f printf
assert_eq "$pidwrite_status" "1" "acquire_lock returns 1 when the pid write fails"
assert_eq "$([ -e "$LOCK_FILE" ] && echo present || echo gone)" "gone" "acquire_lock leaves no lock directory behind when the pid write fails"

# After a successful acquire, the pid file holds $$ and a second acquire in
# the same shell fails (re-asserted here under the fix-round-2 code path,
# distinct from the pre-existing assertions above).
rm -rf "$LOCK_FILE"
acquire_lock
assert_eq "$?" "0" "fix round 2: acquire_lock succeeds against a fresh GUARD_DIR"
assert_eq "$(cat "$LOCK_FILE/pid" 2>/dev/null)" "$$" "fix round 2: pid file holds the current pid after a successful acquire"
acquire_lock
assert_eq "$?" "1" "fix round 2: a second acquire_lock in the same shell fails while the lock is held"

# A stale lock with a dead pid is still reclaimed after the round-2 rewrite
# (mv-based clear, retry-mkdir loop). 4194304 is one past Linux's default
# pid_max (4194303) and out of range for the Windows/macOS pid spaces this
# also runs on, so it cannot be a live process here - same dead pid used by
# the pre-existing stale-reclaim assertion above.
rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
printf '4194304\n' > "$LOCK_FILE/pid"
acquire_lock
assert_eq "$?" "0" "fix round 2: a stale lock with a dead pid is still reclaimed"
assert_eq "$(cat "$LOCK_FILE/pid" 2>/dev/null)" "$$" "fix round 2: reclaiming a stale lock rewrites the pid file to the current pid"

# own_lock: true only when the pid file names this process.
rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
printf '%s\n' "$$" > "$LOCK_FILE/pid"
own_lock
assert_eq "$?" "0" "own_lock returns 0 when the pid file holds the current pid"

rm -rf "$LOCK_FILE"; mkdir -p "$LOCK_FILE"
printf '4194304\n' > "$LOCK_FILE/pid"
own_lock
assert_eq "$?" "1" "own_lock returns 1 when the pid file holds a different pid"

rm -rf "$LOCK_FILE"

# --- Fix round 1, FIX D: gate_idle bounds the immortal-poller branch ---

GATE_SEEN_STAMP="$GUARD_DIR/gate-seen"

rm -f "$GATE_SEEN_STAMP"
gate_idle
assert_eq "$?" "1" "a missing heartbeat stamp reads as not-idle, not idle-since-epoch"

printf 'not-a-timestamp\n' > "$GATE_SEEN_STAMP"
gate_idle
assert_eq "$?" "1" "a garbage heartbeat stamp reads as not-idle"

printf '%s\n' "$(date +%s)" > "$GATE_SEEN_STAMP"
gate_idle
assert_eq "$?" "1" "a heartbeat touched just now is not idle"

printf '%s\n' "$(( $(date +%s) - GATE_IDLE_TIMEOUT + 10 ))" > "$GATE_SEEN_STAMP"
gate_idle
assert_eq "$?" "1" "a heartbeat just inside GATE_IDLE_TIMEOUT is not idle"

printf '%s\n' "$(( $(date +%s) - GATE_IDLE_TIMEOUT - 10 ))" > "$GATE_SEEN_STAMP"
gate_idle
assert_eq "$?" "0" "a heartbeat older than GATE_IDLE_TIMEOUT is idle"

rm -f "$GATE_SEEN_STAMP"

# --- Probe-recursion fix: USAGE_GUARD_PROBE sentinel ---
#
# The probe (`claude -p "/usage"`) starts a brand new Claude Code session,
# and that child session's own SessionStart hook launches another poller,
# which probes again, unbounded. This is the regression test: run
# usage-poller as a real program (not sourced), the way SessionStart does,
# with the sentinel a probe-launched session would carry. It must exit 0
# immediately and do no work at all, not even acquire the lock or log.
# Isolated into its own GUARD_DIR so a pre-existing guard.log from the
# lock-reclaim assertions above cannot mask a regression.
#
# Bounded, not awaited via command substitution: `main_loop &` backgrounds a
# subshell that inherits this process's stdout, so `out=$(... bash
# usage-poller)` would block on EOF from that fd until the subshell exits,
# which (absent the early exit) only happens after GATE_IDLE_TIMEOUT or a
# real crash. A removed early exit must fail this test, not hang the suite:
# output goes to a file, the invocation is backgrounded from THIS shell
# instead, and this test polls kill -0 for a bounded number of iterations
# before asserting on exit rather than waiting on the pipe.
#
# A stub `claude` is put on PATH for this one invocation. If the early exit
# were ever removed, main_loop would eventually reach run_probe, which would
# try to launch a real `claude -p "/usage"` session; the stub makes that
# call to a fake CLI even in that broken-code scenario, so this regression
# test can never itself become the thing that spawns a real probe session.
PROBE_DIR="$GUARD_DIR/probe-sentinel"
rm -rf "$PROBE_DIR"; mkdir -p "$PROBE_DIR/bin"
cat > "$PROBE_DIR/bin/claude" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$PROBE_DIR/bin/claude"
PROBE_OUT="$PROBE_DIR/poller.out"
: > "$PROBE_OUT"

# Killing $poller_pid below only kills the launcher subshell, not the
# `main_loop &` grandchild it would spawn in the regression scenario (early
# exit removed). Killing a process group is not portable, so instead make
# sure that grandchild cannot outlive this test even if the kill misses it:
# pre-seed a STALE GATE_SEEN_STAMP so gate_idle is true on main_loop's very
# first iteration and it exits on its own. Without this, an orphaned loop in
# the regression scenario runs forever, since nothing else ever touches
# PROBE_DIR's gate-seen stamp to make it look idle.
printf '%s\n' "$(( $(date +%s) - 999999 ))" > "$PROBE_DIR/gate-seen"

(
  PATH="$PROBE_DIR/bin:$PATH" \
  GUARD_DIR="$PROBE_DIR" LOCK_FILE="$PROBE_DIR/guard.lock" LOG_FILE="$PROBE_DIR/guard.log" \
  USAGE_GUARD_PROBE=1 bash "$ROOT/hooks/usage-poller" > "$PROBE_OUT" 2>&1
) &
poller_pid=$!

tries=0
while kill -0 "$poller_pid" 2>/dev/null && [ "$tries" -lt 10 ]; do
  sleep 0.2
  tries=$((tries + 1))
done

if kill -0 "$poller_pid" 2>/dev/null; then
  kill -9 "$poller_pid" 2>/dev/null
  wait "$poller_pid" 2>/dev/null
  assert_eq "did-not-exit" "exited" "USAGE_GUARD_PROBE=1 makes usage-poller exit promptly instead of hanging (it did not; a stray process had to be killed)"
else
  wait "$poller_pid"
  code=$?
  assert_eq "$code" "0" "USAGE_GUARD_PROBE=1 makes usage-poller exit 0 immediately"
fi

out=$(cat "$PROBE_OUT" 2>/dev/null)
assert_eq "$out" "" "USAGE_GUARD_PROBE=1 usage-poller prints nothing"
assert_eq "$([ -e "$PROBE_DIR/guard.lock" ] && echo present || echo absent)" "absent" "USAGE_GUARD_PROBE=1 writes no lock directory"
assert_eq "$([ -s "$PROBE_DIR/guard.log" ] && echo present || echo absent)" "absent" "USAGE_GUARD_PROBE=1 writes no guard.log line"
rm -rf "$PROBE_DIR"

# --- Probe-recursion fix: probe_due backstop (lib/config.sh) ---

PROBE_STAMP="$GUARD_DIR/last-probe"
rm -f "$PROBE_STAMP"
probe_due "$(date +%s)"
assert_eq "$?" "0" "probe_due returns 0 when no stamp exists"

probe_due "$(date +%s)"
assert_eq "$?" "1" "probe_due returns 1 when the stamp is newer than PROBE_MIN_INTERVAL"

rm -f "$PROBE_STAMP"
now=$(date +%s)
probe_due "$now"
assert_eq "$(cat "$PROBE_STAMP" 2>/dev/null)" "$now" "probe_due writes the stamp before returning 0"
probe_due "$now"
assert_eq "$?" "1" "a second caller in the same second cannot also probe"

rm -f "$PROBE_STAMP"
printf '%s\n' "$(( $(date +%s) - PROBE_MIN_INTERVAL - 5 ))" > "$PROBE_STAMP"
probe_due "$(date +%s)"
assert_eq "$?" "0" "probe_due returns 0 once the stamp is older than PROBE_MIN_INTERVAL"
rm -f "$PROBE_STAMP"

# PROBE_MIN_INTERVAL screening, same shape as the other bash-arithmetic
# consumers in lib/config.sh.
( PROBE_MIN_INTERVAL=010 . "$ROOT/lib/config.sh"; printf '%s\n' "$PROBE_MIN_INTERVAL" ) > "$GUARD_DIR/pmi-leading-zero.out"
assert_eq "$(cat "$GUARD_DIR/pmi-leading-zero.out")" "30" "PROBE_MIN_INTERVAL rejects a leading-zero value, falling back to 30"

( PROBE_MIN_INTERVAL=0 . "$ROOT/lib/config.sh"; printf '%s\n' "$PROBE_MIN_INTERVAL" ) > "$GUARD_DIR/pmi-bare-zero.out"
assert_eq "$(cat "$GUARD_DIR/pmi-bare-zero.out")" "30" "PROBE_MIN_INTERVAL rejects a bare 0, falling back to 30"
rm -f "$GUARD_DIR/pmi-leading-zero.out" "$GUARD_DIR/pmi-bare-zero.out"

# --- BASHPID vs $$ (fix round 2): acquire_lock must record the lock owner's
# real, checkable pid, not the pid of a process that has already exited ---
#
# main_loop runs as `main_loop &`, a backgrounded subshell. Bash keeps $$
# pinned to the invoking (launcher) shell's pid even inside that subshell,
# while BASHPID reports the subshell's own, actual OS pid. Recording $$
# recorded a pid that is dead within milliseconds of backgrounding, so every
# later poller found a "dead" owner and reclaimed a lock that was, in fact,
# still legitimately held; that produced the same "poll: reclaiming stale
# lock from pid NNNNN" storm fingerprint as the probe recursion, but from an
# unrelated cause. Demonstrated here without running a real main_loop: a
# bare backgrounded subshell calling acquire_lock directly, held open with a
# short sleep so its pid stays live long enough to assert against. 5 seconds,
# not 2: the pid-file wait loop just above can itself take up to ~2 seconds
# in its worst case, and a 2-second hold left too little margin on a loaded
# machine, where the subshell could exit before the kill -0 checks below
# even ran, producing a false FAIL unrelated to the code under test.
rm -rf "$LOCK_FILE"
( acquire_lock; sleep 5 ) &
subshell_pid=$!
tries=0
while [ ! -s "$LOCK_FILE/pid" ] && [ "$tries" -lt 20 ]; do sleep 0.1; tries=$((tries + 1)); done
recorded=$(cat "$LOCK_FILE/pid" 2>/dev/null)
assert_eq "$recorded" "$subshell_pid" "acquire_lock records the backgrounded subshell's own pid (BASHPID), matching what \$! sees from outside it"
assert_eq "$([ "$recorded" = "$$" ] && echo same || echo different)" "different" "the recorded pid is not this test shell's \$$, proving BASHPID rather than \$\$ was recorded"
kill -0 "$recorded" 2>/dev/null
assert_eq "$?" "0" "the recorded pid still names a live process (the old \$\$ bug would have recorded an already-dead launcher pid instead)"
wait "$subshell_pid" 2>/dev/null
rm -rf "$LOCK_FILE"

