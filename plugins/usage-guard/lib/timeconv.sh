# Converts an ISO 8601 timestamp to epoch seconds across the three shells this
# plugin has to run on. GNU date covers Linux and Git Bash on Windows. BSD date
# covers macOS. Both are tried before giving up, and giving up is not an error:
# the caller treats an empty result as UNKNOWN and allows the call.

iso_to_epoch() {
  local iso="$1"
  [ -n "$iso" ] || { printf '\n'; return 0; }

  # Strip fractional seconds, which BSD date cannot parse, and normalise the
  # +00:00 offset to Z.
  local clean
  clean=$(printf '%s' "$iso" | sed -e 's/\.[0-9]*//' -e 's/+00:00$/Z/')

  local out
  # GNU date.
  out=$(date -u -d "$clean" +%s 2>/dev/null)
  if [ -n "$out" ]; then printf '%s\n' "$out"; return 0; fi

  # BSD date, which needs the input format spelled out.
  out=$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$clean" +%s 2>/dev/null)
  if [ -n "$out" ]; then printf '%s\n' "$out"; return 0; fi

  printf '\n'
  return 0
}
