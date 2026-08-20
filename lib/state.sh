# Reads the watchdog state file. Never fails: any problem yields UNKNOWN, and
# the caller treats UNKNOWN as "allow the call".

read_state() {
  local f="${1:-$STATE_FILE}"
  [ -r "$f" ] || { printf 'UNKNOWN\n'; return 0; }

  local content
  content=$(cat "$f" 2>/dev/null) || { printf 'UNKNOWN\n'; return 0; }
  [ -n "$content" ] || { printf 'UNKNOWN\n'; return 0; }

  local pct resets ts
  pct=$(printf '%s' "$content" | sed -n 's/.*"used_percentage"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)
  resets=$(printf '%s' "$content" | sed -n 's/.*"resets_at"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)
  ts=$(printf '%s' "$content" | sed -n 's/.*"ts"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)

  if [ -z "$pct" ] || [ -z "$resets" ] || [ -z "$ts" ]; then
    printf 'UNKNOWN\n'
    return 0
  fi

  printf '%s %s %s\n' "$pct" "$resets" "$ts"
  return 0
}
