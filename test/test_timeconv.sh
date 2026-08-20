#!/usr/bin/env bash
. "$(dirname "$0")/assert.sh"
. "$(dirname "$0")/../lib/timeconv.sh"

# The real shape Claude Code writes into ~/.claude.json, fractional seconds and
# a +00:00 offset included.
assert_eq "$(iso_to_epoch '2026-08-20T04:49:59.665316+00:00')" "1787201399" "converts the real cache format"
assert_eq "$(iso_to_epoch '2026-08-20T04:49:59Z')"             "1787201399" "converts a plain Z timestamp"
assert_eq "$(iso_to_epoch 'not a timestamp')"                  ""           "garbage yields empty"
assert_eq "$(iso_to_epoch '')"                                 ""           "empty input yields empty"
assert_exit 0 "iso_to_epoch exits 0 on garbage" iso_to_epoch 'not a timestamp'
