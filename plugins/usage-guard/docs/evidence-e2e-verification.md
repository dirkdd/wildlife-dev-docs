# Task 11: end-to-end verification — report

Repo: `C:/Users/dirkd/OneDrive/Desktop/GitHub/usage-guard`, branch `feat/usage-guard`.
Started at head `945dbcb`, unit suite green (134 assertions, 0 failed), clean tree.

## Pre-run setup

- Created `test/e2e/settings-e2e.json` per the brief, verbatim.
- Created `test/e2e/noop-poller`, a harmless stub, and exported
  `USAGE_GUARD_TEST_POLLER` to it for the whole e2e run. Every check fabricates a
  fresh state file (`ts` set to now), so the gate's UNKNOWN/STALE relaunch path
  should never fire, but this makes a mistake cost nothing instead of spawning a
  real `claude -p "/usage"` probe.
- Created `test/e2e/run-e2e` per the brief.

## Incident: all four checks ran unattended on the first pass

Per the brief's step 2, I ran the literal command
`bash test/e2e/run-e2e 2>&1 | sed -n '/== 1/,/== 2/p'`. The harness auto-backgrounded
it on its 2-minute default timeout. I had assumed the `sed` range filter would gate
how much of the script executed. It does not: a pipe filters what is *displayed*, not
what the producer runs, and in this case it also fully buffered output so nothing
streamed back before I noticed. I called `TaskStop` on the backgrounded task, but that
only tore down the wrapper shell — the already-forked child processes, and apparently
the rest of the script itself (reparented to PID 1), kept running to completion. By the
time I checked process state, checks 2, 3, and 4 had already executed back to back with
no review gate between them. A follow-up plain `kill` (not `-9`, which the permission
classifier blocked) on the parent shell PID may have raced with check 3/4 already under
way.

No retries were run before reporting this. I stopped and sent the team lead a full
account (captured evidence, what was missing, and two options) rather than guessing at
next steps. Ruling: accept the existing `guard.log` evidence for checks 1, 3, and 4;
rerun check 2 alone, since it is the one whose evidence (a clean model result reaching
the user after being held) could not be confirmed from `guard.log` alone. Also: rewrite
`run-e2e` to take a check number as an argument, and take "one at a time" literally —
separate invocations, never one script behind a display filter — from here on.

### Evidence recovered from the unattended run

Check 1 stdout (captured before the buffer stalled):
```
== 1. below threshold: session completes normally ==
alive
elapsed=19s (expect roughly 5 to 15)
```

Full `guard.log` for checks 2-4 of that run:
```
2026-08-21T02:17:29Z freeze start tool=Bash pct=99 resets_at=1787278735
2026-08-21T02:20:10Z freeze end reason=RESET tool=Bash
2026-08-21T02:20:29Z deny spawn tool=Agent pct=92
2026-08-21T02:20:41Z freeze start tool=Bash pct=99 resets_at=1787282436
2026-08-21T02:21:01Z freeze end reason=ESCAPE tool=Bash
```

Team lead's read of this log, which I did not independently re-derive but record as
their ruling: check 2's 161s freeze duration matches the 90s fabricated reset + 60s
`RESET_BUFFER`, quantized to a 20s wake increment. Check 3 shows `deny spawn` with no
`freeze start` between it and check 2's `freeze end`, correct since 92 is below the
95 freeze threshold. Check 4's `freeze start` line itself proves `DISABLE` was absent
at entry (`guard_disabled` is checked first and would have skipped the freeze
entirely), so the file appearing mid-freeze and producing `reason=ESCAPE` is exactly
the behavior under test; the 20s gap is consistent with the session reaching its tool
call about 5s into the 25s DISABLE-touch window.

What that log cannot show: what the model itself experienced for checks 2-4 — whether
it received a clean result with no error, or hung, or surfaced anything about being
paused. That gap is why check 2 was rerun.

## `run-e2e` rewrite

Refactored into `check1`/`check2`/`check3`/`check4` functions selected by a numeric
argument (`run-e2e 1` .. `run-e2e 4`); no argument still runs all four, but the header
comment now explicitly warns against backgrounding that shape or filtering it through
`sed` expecting it to gate execution.

## Check 2 rerun (foreground, single invocation, no pipe)

Command: `bash test/e2e/run-e2e 2` (no backgrounding, no display filter).

Output, verbatim:
```
== 2. freeze then release: reset 90 seconds out ==
thawed
elapsed=181s (expect at least 90)
-- guard log --
2026-08-21T02:24:41Z freeze start tool=Bash pct=99 resets_at=1787279165
2026-08-21T02:27:21Z freeze end reason=RESET tool=Bash
```

- Elapsed: 181s (at least 90s required — met).
- Model's literal reported result: `thawed`.
- No error text anywhere in the output.
- `guard.log`: `freeze start` at 02:24:41 → `freeze end reason=RESET` at 02:27:21,
  a 160s hold, consistent with the 90s fabricated reset + `RESET_BUFFER` (60s),
  quantized to the 20s wake increment.

This confirms the central claim of the whole design end to end: a tool call the gate
holds for roughly three minutes reaches the model with a clean result and no sign it
was paused.

## Checks not rerun (accepted on guard.log evidence per ruling)

- **Check 1** — accepted from the unattended run: stdout `alive`, elapsed 19s (target
  5-15s; over by a small margin, plausibly session-startup variance rather than a gate
  artifact — no error text, no indication the gate added the delay).
- **Check 3** — accepted from `guard.log`: `deny spawn tool=Agent pct=92`, and no
  `freeze start` line between check 2's `freeze end` and check 3's `deny spawn`. No
  stdout was captured for this check (the model's literal `SPAWN BLOCKED` text, if
  any, is not in evidence), but the gate-side decision is unambiguous in the log.
- **Check 4** — accepted from `guard.log`: `freeze start` → `freeze end reason=ESCAPE`,
  20s apart. No stdout was captured (elapsed for the full session, as opposed to the
  freeze window alone, is not directly measured), but the log line sequence proves the
  DISABLE-file escape path fired as designed.

## Unit suite

`./test/run-tests`: 134 assertions, 0 failed — before this work and again after,
unaffected by the e2e additions.

## Files added / exec bits

- `test/e2e/settings-e2e.json` (100644)
- `test/e2e/run-e2e` (100755, set via `git update-index --chmod=+x`)
- `test/e2e/noop-poller` (100755, set via `git update-index --chmod=+x`)
- `README.md` created fresh (did not exist before this task) with only the
  "Verified behavior" section, per the controller ruling that whichever of tasks 11/12/13
  runs first creates it and later tasks append.
- `.gitignore` gained `test/e2e/tmp/` (the scratch dir `run-e2e` recreates on every
  invocation was not previously ignored and got staged by accident on the first
  `git add`; excluded before committing).

Confirmed via `git ls-files -s test/e2e README.md`:
```
100644 README.md
100755 test/e2e/noop-poller
100755 test/e2e/run-e2e
100644 test/e2e/settings-e2e.json
```

## Finding for the record: backgrounded children survived parent kill

Not part of the brief, but surfaced by the incident above and worth recording because
it bears on Task 10's open question about whether `usage-poller` outlives its parent
session.

During the unattended run, I called `TaskStop` on the backgrounded wrapper shell that
was running `run-e2e`. The wrapper died, but its child processes (the in-flight
`claude -p` session, and apparently the rest of the shell script driving subsequent
checks) kept running to completion, reparented to PID 1 rather than being torn down
with their parent. A subsequent plain `kill` on the parent shell PID (not `-9`, which
this environment's permission classifier blocked) did not stop it either — checks 3
and 4 had already run by the time I re-checked process state.

This is evidence for the "survives" branch of Task 10's open question: if a background
child process on this machine survives its parent session/shell being killed, then an
`usage-poller` launched detached from a Claude Code session would plausibly survive
that session exiting too — meaning `GATE_IDLE_TIMEOUT` (the heartbeat-based self-exit,
not process-lifetime coupling) is the thing actually bounding an orphaned poller's
lifetime, not a defensive backstop for a case that mostly can't happen.

Caveat, stated as directed: `TaskStop` in this harness is not the same signal as a
Claude Code session process exiting, and however the host eventually reaps a session
(direct process exit, a Windows Job Object kill, or something else) may behave
differently from either of the two things I actually tried here. This is strong
supporting evidence, not a controlled experiment, and no experiment was run to settle
it — that would cost additional budget for a question the final review can weigh with
what's here.

## Fix round 1

Documentation and harness corrections only. No new sessions, no reruns.

**Fix 1 (Critical, controller's own error, not a correction of prior judgment).**
`README.md` claimed check 1 "Confirms the gate is silent below 80%." No 80% threshold
exists in the shipped code — `lib/config.sh` has `THRESHOLD_DRAIN=90` and
`THRESHOLD_FREEZE=95`, and check 1 ran at `pct=10`. The 80% band, and the "throttled
warning for 80-89" the dispatch also described, are planned Task 14 work that has not
been built yet. Corrected the line to: "Confirms the gate is silent at 10% usage, below
the drain threshold (`THRESHOLD_DRAIN=90`)." Swept the rest of the "Verified behavior"
section for any other reference to an 80% band or throttled warning — none found.

**Fix 2 (Important).** `README.md` said "161s between the two lines" for check 2's
freeze duration. The log timestamps (02:24:41 to 02:27:21) are 160s, matching what this
report already stated correctly above. Fixed the README to 160s.

**Fix 3 (Important).** `run-e2e` still ran all four checks on a bare invocation, guarded
only by a comment — the same failure mode as the original incident (a filter/comment
does not stop a producer). Changed the dispatch to require an explicit argument: a bare
`bash test/e2e/run-e2e` now prints usage and exits 1 without starting any session.
Running all four checks now requires the explicit `all` argument, so it can't happen by
accident or muscle memory. `run-e2e 1`..`run-e2e 4` are unchanged in behavior.

**Verification performed (no `claude` sessions started):**
- `bash test/e2e/run-e2e` (bare): printed usage, exited 1, no delay (proves no session
  was started — a real check takes 19s+ before any output).
- `bash -n test/e2e/run-e2e`: syntax OK.
- Static check that the case statement maps `2) check2 ;;` and that `check1`..`check4`
  are plain function definitions above the case block, so defining them does not
  execute their bodies (only the matched branch's function call does).
- `./test/run-tests`: 134 assertions, 0 failed — unaffected.

Committed as a follow-up commit on `feat/usage-guard` after `84c997d`.
