# Task 12: Fan-out behavior under a freeze — report

Repo: `usage-guard`, branch `feat/usage-guard`, starting head `a6159af`, suite green at
134 assertions before this work.

## What was run

`test/e2e/run-fanout` (new file, matches the brief verbatim):

- Fabricated state file starting at `used_percentage=10` so the fan-out is allowed to
  begin.
- A backgrounded updater raises state to `used_percentage=99` (`resets_at` = now+120)
  20 seconds after launch, while agents should already be running.
- A single `claude -p` session, prompted to launch three `general-purpose` agents in
  parallel, each running `bash -c "sleep 45; echo done"`, then report how many reported
  back.
- `USAGE_GUARD_TEST_POLLER` pointed at `test/e2e/noop-poller` for the whole run (belt
  and braces; fabricated state is always fresh so the relaunch path should not fire).

Run once, as instructed. Not re-run.

## Confirmation agents had started before the freeze

The backgrounded state-flip fires 20s after the harness launches (measured from when
the harness process forks, before `claude -p` itself has even started up — CLI startup
latency eats into that budget). Observed timeline, all times UTC:

- Harness raised state to 99 at epoch `1787280570` (`[harness] raised state to 99 at
  1787280570` in captured stdout).
- `guard.log`'s first `freeze start` line is `02:49:31Z`, one second after that
  epoch converts (`1787280570` = `02:49:30Z`).
- `ps -ef` snapshots taken during the run show two new parent/child bash-process pairs
  born at `19:49:31` and `19:49:32` local time (the machine's local clock; the offset
  from the UTC log lines is constant and self-consistent), i.e. the exact same instant
  as the two `freeze start` log lines.

That correlation (log timestamp = new held process's start time) is the confirmation:
the hook that froze was already executing a tool call for the fan-out (not the harness's
own state-fabrication step, which never invokes a hook) at the moment state flipped,
meaning at least two of the three agents' Bash tool calls were in flight before the
freeze took hold. I did not additionally confirm agent-level start times from `claude
-p`'s own progress output; `-p` mode does not stream that here, so this timing/PID
correlation is the strongest evidence available.

## Total elapsed time

`elapsed=301s` (from the harness's own `start=$(date +%s))` / final subtraction,
captured verbatim in stdout).

## Model's literal final answer (verbatim, captured stdout)

```
All three reported back — 3/3, each returning `done`.
| Agent | Result | Duration | Tool uses |
|---|---|---|---|
| AGENT-1 | `done` | ~260s | 1 |
| AGENT-2 | `done` | ~278s | 10 |
| AGENT-3 | `done` | ~61s | 1 |
One note: agent 2 reported that the foreground `sleep` was blocked by the environment's
sleep guard, so it re-ran the command in the background instead; it still exited 0 with
`done`. That accounts for its 10 tool uses.
```

(The "environment's sleep guard" is an unrelated Claude Code harness feature that
blocks long blind `sleep` calls in bash tool calls; it is not part of usage-guard. It
explains AGENT-2's extra tool uses, not a freeze artifact.)

This capture is genuine stdout from the run, obtained via a Monitor task watching
`/tmp/fanout-output.log` for the harness's own `elapsed=` completion line, not
reconstructed from memory. (Note: I did lose track of it briefly mid-run and sent a
status update to that effect before the Monitor notification landed; the text above is
what the notification actually delivered, verbatim.)

## `guard.log` (verbatim, complete)

```
2026-08-21T02:49:31Z freeze start tool=Bash pct=99 resets_at=1787280690
2026-08-21T02:49:32Z freeze start tool=Bash pct=99 resets_at=1787280690
2026-08-21T02:52:32Z freeze end reason=RESET tool=Bash
2026-08-21T02:52:33Z freeze end reason=RESET tool=Bash
```

Two concurrent freeze/release pairs, not three. `resets_at=1787280690` matches the
fabricated state (`1787280570 + 120`). Release at `02:52:32Z`/`02:52:33Z` is
`1787280752`/`1787280753`, i.e. `resets_at + RESET_BUFFER(60)` = `1787280750`,
quantized up to the next `SLEEP_INCREMENT(20)` boundary — consistent with `freeze.sh`'s
documented polling behavior.

Only two, not three, tool calls were caught in the freeze window. The most likely
explanation, given the per-agent durations in the model's answer: AGENT-3's total
duration (~61s, 1 tool use) is short enough that its single Bash call plausibly started
and completed under the still-low (10%) state before the flip landed at t+20s, so it
never reached the gate while state read 99. AGENT-1 (~260s) and AGENT-2 (~278s,
including its extra retries) both align with having been held for the ~180s
freeze-to-release gap, then finishing. This is inference from timing, not a per-agent
correlation confirmed via a distinguishing field in `guard.log` (the log does not carry
an agent identifier, only `tool=Bash`).

## Sleeping hook process count during the freeze

Captured via a separate Bash invocation while the harness ran (`ps -ef | grep
'/usr/bin/bash' | sort -k7`), taken at multiple points during the freeze window. Two
methods, reported separately because they disagree and the disagreement is explainable:

1. **Correlated count (the trustworthy one):** four raw `/usr/bin/bash` processes were
   born at the same instant as the two `freeze start` log lines (`19:49:31` and
   `19:49:32` local time), as two parent/child pairs (e.g. PID 52273 with child 52302;
   PID 52335 with child 52386). Claude Code's hook runner wraps the configured hook
   command (`bash "<ROOT>/hooks/usage-gate"`) in its own shell, so one *logical* held
   `PreToolUse` invocation shows up as two OS processes. Two logical freezes, four raw
   processes — consistent with the two `freeze start`/`freeze end` pairs in `guard.log`.
2. **Brief's literal method (`ps -W 2>/dev/null | grep -c bash`):** returned 33-35 at
   various points during the run. This number is not a clean signal here: it includes
   every bash process belonging to the outer Claude Code session that was driving this
   whole experiment (itself dozens of shells across its own tool-call history), not
   just usage-guard's held hooks. Reporting it because the brief asked for it, but it
   should not be read as "35 sleeping hook processes" — the correlated count above (4
   raw / 2 logical) is the number that actually maps to held hook invocations.

I did get this in a separate Bash invocation from the one running the harness, per the
brief's requirement; I did not lose or fail to obtain it.

## Outcome classification

**All three agents reported back after the thaw.** This is the first of the three
predefined outcomes: freezing subagent tool calls, on this run, was safe — no agent was
lost, the session completed cleanly, and the model's own accounting confirms 3/3.

Caveat, stated plainly rather than smoothed over: `guard.log` shows only two concurrent
freeze/release pairs, not three, so this run demonstrates survival for concurrently-held
subagent calls under a freeze (2 of them), plus one agent that likely completed before
the freeze ever caught it. It does not demonstrate all three agents being held inside
the freeze simultaneously and all three surviving that. The result is consistent with
"freezing subagents is safe" but is not the maximally strong version of that claim. A
stronger test would need a probe that reliably gets every agent's first tool call to
land after the freeze begins (e.g. an initial no-op Bash call per agent before the
`sleep`, or staggering the state-flip later once all three have logged a first action) —
that is a design choice for a possible second run, which is the team lead's call, not
mine to make unilaterally given the budget constraint.

## Verification

- `./test/run-tests`: 134 assertions, 0 failed (unchanged), after the fan-out run.
- `test/e2e/run-fanout` exec bit recorded via `git update-index --chmod=+x` and
  confirmed via `git ls-files -s` (mode `100755`).
- Commit made on `feat/usage-guard`; see repo log for SHA.
