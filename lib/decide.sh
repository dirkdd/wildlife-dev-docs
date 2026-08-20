# The whole policy, as a pure function. Kept free of I/O so every branch is
# testable without a filesystem or a clock.

decide() {
  local pct="$1" tool="$2" now="$3" ts="$4"

  # Anything we cannot read as a number means we do not know, and not knowing
  # means we allow the call.
  case "$pct" in ''|*[!0-9]*) printf 'ALLOW\n'; return 0 ;; esac
  case "$now" in ''|*[!0-9]*) printf 'ALLOW\n'; return 0 ;; esac
  case "$ts"  in ''|*[!0-9]*) printf 'ALLOW\n'; return 0 ;; esac

  local age=$((now - ts))

  # A negative age means the clock moved. Treat it as unusable rather than
  # trusting a reading from the future.
  [ "$age" -lt 0 ] && { printf 'ALLOW\n'; return 0; }
  [ "$age" -gt "$STALE_SECONDS" ] && { printf 'ALLOW\n'; return 0; }

  if [ "$pct" -ge "$THRESHOLD_FREEZE" ]; then
    printf 'FREEZE\n'
    return 0
  fi

  if [ "$pct" -ge "$THRESHOLD_DRAIN" ]; then
    case "$tool" in
      Agent|Task) printf 'DENY_SPAWN\n'; return 0 ;;
    esac
  fi

  printf 'ALLOW\n'
  return 0
}
