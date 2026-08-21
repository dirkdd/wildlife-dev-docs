# Configuration. Every value is overridable from the environment so tests can
# redirect paths and thresholds without touching the real guard directory.

: "${GUARD_DIR:=$HOME/.claude/usage-guard}"
: "${STATE_FILE:=$GUARD_DIR/state.json}"
: "${DISABLE_FILE:=$GUARD_DIR/DISABLE}"
: "${LOCK_FILE:=$GUARD_DIR/guard.lock}"
: "${LOG_FILE:=$GUARD_DIR/guard.log}"

: "${THRESHOLD_DRAIN:=90}"
: "${THRESHOLD_FREEZE:=95}"
: "${STALE_SECONDS:=1200}"
: "${RESET_BUFFER:=60}"
: "${SLEEP_INCREMENT:=20}"

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
# RELAUNCH_THROTTLE and the widest poll interval so a live gate never trips
# it by accident.
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
  [ -r "$stamp_file" ] && read -r last < "$stamp_file" 2>/dev/null
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
