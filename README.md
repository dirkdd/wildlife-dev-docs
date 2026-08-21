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

## Fan-out behavior

What happens when a freeze catches subagents already running, via
`test/e2e/run-fanout` (same fabricated-state mechanism as above). Full detail in
`.superpowers/sdd/2026-08-20-usage-guard/task-12-report.md`.

A parent session launched three `general-purpose` agents in parallel, each running
`bash -c "sleep 45; echo done"`. State started at `used_percentage=10` (fan-out allowed)
and was raised to 99 twenty seconds in, once agents were already running.

**Captured stdout (model's literal final answer):**
```
All three reported back — 3/3, each returning `done`.
| Agent | Result | Duration | Tool uses |
|---|---|---|---|
| AGENT-1 | `done` | ~260s | 1 |
| AGENT-2 | `done` | ~278s | 10 |
| AGENT-3 | `done` | ~61s | 1 |
```
Elapsed: 301s. AGENT-2 needed extra tool uses because its foreground `sleep` was
blocked by an unrelated environment guard against long blind sleeps, and it retried in
the background; it still exited 0 with `done`.

**`guard.log` (verbatim):**
```
2026-08-21T02:49:31Z freeze start tool=Bash pct=99 resets_at=1787280690
2026-08-21T02:49:32Z freeze start tool=Bash pct=99 resets_at=1787280690
2026-08-21T02:52:32Z freeze end reason=RESET tool=Bash
2026-08-21T02:52:33Z freeze end reason=RESET tool=Bash
```
Only two concurrent `freeze start`/`freeze end` pairs appear despite three agents
running. The likely explanation: AGENT-3's single Bash tool call (~61s total agent
duration) landed and completed before the state flip at t+20s, so it never hit the
freeze window at all; AGENT-1 and AGENT-2's calls did, and both froze and released
together roughly 180s later, matching Check 2's freeze/release timing.

**Process count during the freeze.** Correlated by start time against the two
`freeze start` log lines (02:49:31Z / 02:49:32Z UTC), four raw `bash` processes
appeared at that moment, as two parent/child pairs — one pair per concurrently held
`PreToolUse` hook invocation (Claude Code's hook runner wraps the configured `bash
"<ROOT>/hooks/usage-gate"` command in its own shell, so each held hook shows up as a
wrapper + the actual gate process). This count is confirmed, not assumed, from PID and
start-time correlation with `guard.log`. A raw `ps -W | grep -c bash` taken during the
same window returned 33-35, but that count is dominated by unrelated bash processes
belonging to the outer Claude Code session driving this experiment and is not a usable
signal on its own; it is reported here only so it isn't silently omitted.

**Outcome: all three agents reported back after the thaw.** This matches the first of
the three predefined responses: freezing subagent tool calls is safe, and the design
stands as-is. The caveat above (only two of the three agents' calls actually landed
inside the freeze window) means this run confirms freeze/release survival for
concurrently-frozen subagent calls, not for all three simultaneously; that stronger
claim is unconfirmed by this run and would need a design (e.g. staggered `sleep`
starts) that reliably lands every agent's first tool call after the freeze begins.

Unit suite unaffected: 134 assertions, 0 failed, before and after this work.
