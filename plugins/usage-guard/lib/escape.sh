# The escape hatches. Neither requires a working Claude session, because a
# frozen session cannot be used to turn the guard off.

guard_disabled() {
  [ "${CLAUDE_USAGE_GUARD_OFF:-}" = "1" ] && return 0
  [ -e "$DISABLE_FILE" ] && return 0
  return 1
}
