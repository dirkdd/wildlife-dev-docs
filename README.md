## Verified behavior

End-to-end verification against real `claude -p` sessions, via `test/e2e/run-e2e` and a
fabricated state file (`test/e2e/settings-e2e.json`, `test/e2e/noop-poller`). Full detail
in `.superpowers/sdd/2026-08-20-usage-guard/task-11-report.md`.

**Check 1 — below threshold, gate invisible.** `used_percentage=10`. Captured stdout:
model reported `alive`, elapsed 19s (target: roughly 5-15s; slightly over, plausibly
session-startup variance, not a gate artifact). Confirms the gate is silent at 10%
usage, below the drain threshold (`THRESHOLD_DRAIN=90`).

**Check 2 — freeze then release.** `used_percentage=99`, reset fabricated 90s out. Rerun
in isolation (the run this section's evidence comes from) captured full stdout: model
reported `thawed` with no error text, elapsed 181s. `guard.log`:
```
freeze start tool=Bash pct=99 resets_at=...
freeze end reason=RESET tool=Bash
```
160s between the two lines, against a roughly 150s target (90s fabricated reset +
60s RESET_BUFFER, quantized to a 20s wake increment). This is the central claim of the
whole design: a tool call held by the gate reaches the model with a clean result and no
sign it was paused.

**Check 3 — drain band.** `used_percentage=92`. Evidence is `guard.log` only (no stdout
was captured for this check — see the incident note in the task-11 report):
```
deny spawn tool=Agent pct=92
```
No `freeze start` line appears, correctly, since 92 is below the freeze threshold (95).

**Check 4 — escape hatch.** `used_percentage=99`, `DISABLE` file touched 25s after start.
Evidence is `guard.log` only (no stdout captured):
```
freeze start tool=Bash pct=99 resets_at=...
freeze end reason=ESCAPE tool=Bash
```
20s between the two lines. The `freeze start` line itself proves `DISABLE` was absent at
entry (`guard_disabled` is checked before anything else and would have skipped the freeze
entirely), so the file appearing mid-freeze and producing `reason=ESCAPE` is exactly the
behavior under test.

Unit suite (`./test/run-tests`) unaffected: 134 assertions, 0 failed, both before and
after this work.
