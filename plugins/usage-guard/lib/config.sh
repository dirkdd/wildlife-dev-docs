# Configuration. Every value is overridable from the environment so tests can
# redirect paths and thresholds without touching the real guard directory.

: "${GUARD_DIR:=$HOME/.claude/usage-guard}"
: "${STATE_FILE:=$GUARD_DIR/state.json}"
: "${DISABLE_FILE:=$GUARD_DIR/DISABLE}"
: "${LOCK_FILE:=$GUARD_DIR/guard.lock}"
: "${LOG_FILE:=$GUARD_DIR/guard.log}"

: "${THRESHOLD_DRAIN:=90}"
: "${THRESHOLD_FREEZE:=95}"
: "${THRESHOLD_WARN:=80}"
: "${STALE_SECONDS:=1200}"
: "${RESET_BUFFER:=60}"
: "${SLEEP_INCREMENT:=20}"

# STALE_SECONDS feeds a bash arithmetic comparison in decide.sh
# (`age -gt STALE_SECONDS`) that exists to discard old state.json readings.
# An unscreened bad value does not fail open here: `[ -gt ]` against a
# non-numeric operand errors and reads as false, so the staleness check
# silently never trips and an old, high-pct reading keeps driving FREEZE
# decisions indefinitely instead of being discarded. Screened the same way
# as the other bash-arithmetic consumers in this file.
case "$STALE_SECONDS" in ''|*[!0-9]*|0?*) STALE_SECONDS=1200 ;; esac

# SLEEP_INCREMENT is the one value in this group whose bad value does not
# fail open: freeze.sh loops `sleep "$SLEEP_INCREMENT"` for up to 5.4 hours,
# and `sleep 0` or `sleep foo` returns immediately, turning that loop into a
# tight spin that forks `date` at full CPU for the whole freeze. The usual
# digit screen is not enough here: 0 itself, not just a non-numeric value,
# is the spin case, so it is rejected explicitly alongside the leading-zero
# and non-digit arms the other values use.
case "$SLEEP_INCREMENT" in ''|*[!0-9]*|0?*|0) SLEEP_INCREMENT=20 ;; esac

# THRESHOLD_DRAIN, THRESHOLD_FREEZE and THRESHOLD_WARN are deliberately left
# unscreened. Each only ever feeds `[ "$pct" -ge "$THRESHOLD_X" ]` in
# decide.sh; a non-numeric value makes that comparison error and read as
# false, so a bad threshold just means that band's action (FREEZE,
# DENY_SPAWN, or WARN) never fires. That is already the fail-open direction
# this whole system is built around, so no extra screen changes the outcome.
#
# RESET_BUFFER is also left unscreened. It only feeds
# `target=$((resets_at + RESET_BUFFER))` in freeze.sh; a bad value there
# (confirmed: something like `60s`) makes that arithmetic expansion fatal to
# freeze_until, which returns immediately having printed nothing. Because
# usage-gate calls it inside a command substitution, only that subshell
# dies; REASON comes back empty and the gate exits 0. So a malformed
# RESET_BUFFER produces no freeze at all, rather than a maximal one, which
# is still the fail-open direction this whole system is built around.

# One throttled advisory per window, not one per tool call. Screened the same
# way as the other bash-arithmetic consumers above (leading zero reads as
# octal; any other non-digit breaks the comparison outright).
: "${WARN_STAMP:=$GUARD_DIR/last-warn}"
: "${WARN_THROTTLE:=600}"
case "$WARN_THROTTLE" in ''|*[!0-9]*|0?*) WARN_THROTTLE=600 ;; esac

# Must match the "timeout" value in hooks/hooks.json. The gate releases 120
# seconds before this so an overrun degrades to one leaked call.
: "${HOOK_TIMEOUT_SECONDS:=19800}"
# This is the one value here a human is most likely to hand-edit (to keep it
# synced with hooks.json), and bash arithmetic treats a leading zero as octal
# (rejecting any digit outside 0-7, e.g. 08000) and rejects any other
# non-digit outright. A plain digit screen (*[!0-9]*) does not catch the
# leading-zero case, since "08000" is still all digits — 0?* is needed to
# reject a leading zero followed by more digits. Screen it here so every
# consumer is protected, not just the one call site that does arithmetic on
# it today.
case "$HOOK_TIMEOUT_SECONDS" in ''|*[!0-9]*|0?*) HOOK_TIMEOUT_SECONDS=19800 ;; esac

# How long the poller waits for a single `claude -p "/usage"` probe before
# killing it. Screened the same way as HOOK_TIMEOUT_SECONDS above: it feeds a
# bash arithmetic comparison, so a leading zero (octal) or any non-digit has
# to be rejected, not just an empty value.
: "${PROBE_TIMEOUT:=60}"
case "$PROBE_TIMEOUT" in ''|*[!0-9]*|0?*) PROBE_TIMEOUT=60 ;; esac

# Backstop for the probe-recursion fix (see usage-poller's USAGE_GUARD_PROBE
# sentinel). A freshly launched poller probes immediately rather than
# waiting out interval_for first, which is what made the recursion this
# guards against tight: roughly one probe every two seconds, unbounded, when
# the sentinel is missing or ever lost. PROBE_MIN_INTERVAL caps probes to at
# most one per this many seconds, machine-wide, independent of the sentinel.
# Screened the same way as the other bash-arithmetic consumers in this file.
: "${PROBE_STAMP:=$GUARD_DIR/last-probe}"
: "${PROBE_MIN_INTERVAL:=30}"
case "$PROBE_MIN_INTERVAL" in ''|*[!0-9]*|0?*) PROBE_MIN_INTERVAL=30 ;; esac

# Fix round 1, FIX B/D. The gate is the sensor's heartbeat: when it finds no
# usable state it relaunches the poller itself, rather than waiting on the
# next SessionStart, which may never come again for a session that already
# started. RELAUNCH_THROTTLE bounds that to one launch attempt per window so
# a stretch of stale state cannot spawn one process per tool call.
: "${RELAUNCH_STAMP:=$GUARD_DIR/last-relaunch}"
: "${RELAUNCH_THROTTLE:=60}"
case "$RELAUNCH_THROTTLE" in ''|*[!0-9]*|0?*) RELAUNCH_THROTTLE=60 ;; esac

# A second, independent stamp the gate touches on every path, including the
# fast ALLOW below 90%, throttled the same way. This is what lets
# usage-poller tell a genuinely idle machine (no session has run a tool call
# in a while) from a live one, so an immortal poller has something to exit
# on. Deliberately not the same file as RELAUNCH_STAMP: that one only moves
# when state is stale, which is the wrong signal for "is anyone home."
: "${GATE_SEEN_STAMP:=$GUARD_DIR/gate-seen}"

# How long usage-poller waits without seeing GATE_SEEN_STAMP move before it
# concludes no session is left to serve and exits. Set comfortably above
# RELAUNCH_THROTTLE and the widest poll interval so it never trips while the
# gate is actually making tool calls. It DOES trip during a long freeze
# (freeze_until sits in its own sleep loop, making no tool calls, so the
# heartbeat stops moving for the whole freeze) and during a single
# long-running tool call — both while the sensor still matters. This is
# self-healing rather than a bug: freeze_until releases on the wall clock and
# resets_at, not on state, so it does not depend on the poller either way,
# and the next tool call after release finds stale state and relaunches
# within one call via FIX B above.
: "${GATE_IDLE_TIMEOUT:=1800}"
case "$GATE_IDLE_TIMEOUT" in ''|*[!0-9]*|0?*) GATE_IDLE_TIMEOUT=1800 ;; esac

guard_log() {
  # Best effort. A guard that cannot log still has to let work through.
  mkdir -p "$GUARD_DIR" 2>/dev/null
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG_FILE" 2>/dev/null
  return 0
}

# Generic cheap throttle. Touches $1, stamping it with $3, and returns 0 at
# most once every $2 seconds; every call before that returns 1 without
# touching the file. A missing or unreadable stamp reads as epoch 0, so the
# first call after a fresh install (or a wiped GUARD_DIR) is always due. The
# cost on the "not due" path is one small read; the cost on the "due" path
# is that plus one small write, at most once per $2 seconds.
#
# The read uses the `read` builtin against a redirect, not `cat` piped
# through a subshell. Measured on this machine (Windows/Git Bash, where an
# external process fork is expensive): swapping cat for read cut this
# function from ~34 ms/call to ~0.3 ms/call, over 100x, because it turns one
# process spawn per gate invocation into zero. Called on every PreToolUse
# call including the fast ALLOW path, so this is the one place in the
# codebase where that trade actually matters; other reads (e.g. read_state)
# stay on cat since they were already reviewed and this task's scope is the
# new stamp helpers.
stamp_due() {
  local stamp_file="$1" throttle="$2" now="$3"
  local last=""
  # Bash applies redirections left to right, so 2>/dev/null must come BEFORE
  # the input redirect: a failing `< "$stamp_file"` aborts before a trailing
  # 2>/dev/null is ever installed, and the error reaches real stderr despite
  # the [ -r ] guard above it (which is TOCTOU-only). Confirmed locally:
  # `read -r x < /nonexistent 2>/dev/null` prints to stderr; ordering the
  # redirects the other way around does not.
  [ -r "$stamp_file" ] && read -r last 2>/dev/null < "$stamp_file"
  case "$last" in ''|*[!0-9]*) last=0 ;; esac
  if [ $((now - last)) -lt "$throttle" ]; then
    return 1
  fi
  mkdir -p "$GUARD_DIR" 2>/dev/null
  printf '%s\n' "$now" > "$stamp_file" 2>/dev/null
  return 0
}

# True (and stamps RELAUNCH_STAMP) when the gate should attempt to launch a
# fresh poller; false otherwise. Called from the gate's UNKNOWN and stale
# branches only, never on the fast ALLOW path.
relaunch_due() {
  stamp_due "$RELAUNCH_STAMP" "$RELAUNCH_THROTTLE" "$1"
}

# Touches GATE_SEEN_STAMP, throttled the same way. Called on every gate
# invocation regardless of outcome; its return value is not acted on, only
# the side effect matters.
gate_seen() {
  stamp_due "$GATE_SEEN_STAMP" "$RELAUNCH_THROTTLE" "$1"
}

# True (and stamps WARN_STAMP) when the gate may emit the 80% advisory;
# false while a prior warning is still inside WARN_THROTTLE. Reuses
# stamp_due rather than reimplementing the same read/screen/write, same as
# relaunch_due and gate_seen above.
warn_due() {
  stamp_due "$WARN_STAMP" "$WARN_THROTTLE" "$1"
}

# True (and stamps PROBE_STAMP) when the poller may run a `claude -p
# "/usage"` probe; false while a prior probe is still inside
# PROBE_MIN_INTERVAL. Reuses stamp_due, same as relaunch_due, gate_seen and
# warn_due above. Stamping happens before the caller returns, not after the
# probe runs, so two callers racing in the same second cannot both probe.
probe_due() {
  stamp_due "$PROBE_STAMP" "$PROBE_MIN_INTERVAL" "$1"
}
