# The whole policy, as a pure function. Kept free of I/O so every branch is
# testable without a filesystem or a clock.

decide() {
  local pct="$1" tool="$2" now="$3" ts="$4" resets_at="$5"

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

  # A fresh session starting just after a window reset can still read the
  # previous session's leftover state.json: it is younger than STALE_SECONDS,
  # so the age check above lets it through. Once "now" has reached resets_at
  # the window has actually turned over, so that reading no longer describes
  # the current window and must not drive a decision. FREEZE happened to be
  # safe already, because freeze_until releases the instant the reset has
  # passed; the drain band was not, since it never looks at resets_at at all.
  case "$resets_at" in ''|*[!0-9]*) printf 'ALLOW\n'; return 0 ;; esac
  [ "$now" -ge "$resets_at" ] && { printf 'ALLOW\n'; return 0; }

  # A five-hour window can never reset more than six hours out. resets_at
  # passes the digit screen above whether the sensor wrote seconds or
  # milliseconds, and a millisecond value read as seconds looks like it is
  # hours or days in the future, so `now >= resets_at` above can never catch
  # it. Left unscreened, freeze_until would loop on that value until the
  # ~5.4 hour deadline, every time, long after the real window reset. Any
  # resets_at further out than a window can genuinely land is a unit or
  # parse error and must fail open like every other unusable input above.
  [ $((resets_at - now)) -gt 21600 ] && { printf 'ALLOW\n'; return 0; }

  if [ "$pct" -ge "$THRESHOLD_FREEZE" ]; then
    printf 'FREEZE\n'
    return 0
  fi

  if [ "$pct" -ge "$THRESHOLD_DRAIN" ]; then
    case "$tool" in
      Agent|Task) printf 'DENY_SPAWN\n'; return 0 ;;
    esac
  fi

  # Order matters: FREEZE, then DENY_SPAWN, then WARN, then ALLOW. A tool
  # that survived the drain check above (either because it is not a spawn,
  # or because pct has not reached THRESHOLD_DRAIN yet) still gets a WARN
  # here for any pct at or above THRESHOLD_WARN, including pct in the drain
  # band itself: a non-spawn tool at 94% is not denied, but it still warns.
  if [ "$pct" -ge "$THRESHOLD_WARN" ]; then
    printf 'WARN\n'
    return 0
  fi

  printf 'ALLOW\n'
  return 0
}
