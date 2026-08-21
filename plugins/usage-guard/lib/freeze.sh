# Holds the calling hook until the usage window resets.
#
# Sleeps in increments rather than one long sleep for two reasons. Wall clock is
# recomputed every iteration, so a machine that hibernates cannot oversleep the
# reset. And an operator who creates the DISABLE file thaws every frozen session
# within one increment.
#
# The hard deadline exists because Claude Code kills a hook that exceeds its
# timeout and then lets the tool call through silently. Releasing deliberately
# before that turns a silent total failure into one leaked call.

freeze_until() {
  local resets_at="$1" deadline="$2"
  local target=$((resets_at + RESET_BUFFER))

  while :; do
    if guard_disabled; then
      printf 'ESCAPE\n'
      return 0
    fi

    local now
    now=$(date +%s)

    if [ "$now" -ge "$target" ]; then
      printf 'RESET\n'
      return 0
    fi

    if [ "$now" -ge "$deadline" ]; then
      printf 'DEADLINE\n'
      return 0
    fi

    sleep "$SLEEP_INCREMENT"
  done
}
