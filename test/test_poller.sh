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
