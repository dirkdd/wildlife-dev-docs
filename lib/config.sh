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

guard_log() {
  # Best effort. A guard that cannot log still has to let work through.
  mkdir -p "$GUARD_DIR" 2>/dev/null
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG_FILE" 2>/dev/null
  return 0
}
