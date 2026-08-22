# usage-guard

A Claude Code plugin that holds every session on a machine at the edge of its rolling
5-hour usage window instead of letting them run it out. A background poller tracks
the window's usage percentage, and a `PreToolUse` hook reads that state on every tool
call: below 80% it is invisible, from 80% up it emits one throttled advisory and then
stays quiet until the throttle expires, from 90-94% it also blocks new subagent
spawns while letting existing work finish, and at 95% and above it holds the tool
call until the window resets, then lets it through with no error and no lost work.

The advisory's visibility depends on the client and output mode: confirmed showing up
under `--output-format stream-json`, not shown at all in plain `-p` output, and
whether the model itself ever receives it is unverified. `guard.log` records every
warn unconditionally, regardless of output mode, and is the dependable way to observe
them; see "Where state lives" below. Denying a spawn and freezing a tool call are real
permission outcomes and are unaffected by any of this.

## Install

### Marketplace (recommended)

```
/plugin marketplace add dirkdd/wildlife-dev-docs
/plugin install usage-guard@wildlife-ai
```

This is the primary install path. The loader resolves `${CLAUDE_PLUGIN_ROOT}` itself
and reads the `PreToolUse` and `SessionStart` hooks, timeout included, straight out of
this plugin's `hooks/hooks.json`, so none of the manual caveats below apply to it.

### Manual: clone and wire the hooks directly

A secondary path for running a checkout outside the marketplace, for example a fork or
a pre-release clone:

```bash
git clone <this-repo-url> ~/.claude/usage-guard-src
```

Then add the `PreToolUse` and `SessionStart` hooks from `hooks/hooks.json` in this repo
to your `~/.claude/settings.json`. `hooks/run-hook.cmd` is the entry point on Windows;
`hooks/usage-gate` and `hooks/usage-poller` are invoked directly on macOS and Linux.

On this manual path, copy the `PreToolUse` hook's `"timeout": 19800` field along with
the rest of the entry. It is easy to omit when hand-copying, and nothing catches the
omission: a hook with no `timeout` field gets Claude Code's own default, which is far
shorter than the 5.4-hour deadline `HOOK_TIMEOUT_SECONDS` in `lib/config.sh` computes
the freeze against. With the two out of sync, Claude Code kills every freeze early, the
tool call it was holding proceeds unguarded, and nothing logs that this happened. If
you change the timeout from 19800, set `HOOK_TIMEOUT_SECONDS` to the same value or the
freeze silently stops holding. A marketplace install (above) does not carry this risk:
the loader reads `hooks/hooks.json` directly, timeout included, so there is nothing to
hand-copy out of sync.

`hooks/hooks.json` writes each command as `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" ...`.
For a marketplace install, Claude Code's own plugin loader substitutes that placeholder
automatically. On the manual path, the hook entry is hand-copied into `settings.json`
outside the loader, so whether `${CLAUDE_PLUGIN_ROOT}` resolves there at all is
unconfirmed; it has not been verified against a live session. Do not rely on it for a
manual install. The safe option on that path is to substitute the literal absolute path
to your clone in place of `${CLAUDE_PLUGIN_ROOT}` in the command string itself, for
example `"/home/you/.claude/usage-guard-src/hooks/run-hook.cmd"`, so the hook does not
depend on a variable that may never resolve.

The plugin only touches `~/.claude/usage-guard/` (state, lock, and log files) and the
two hook entries above. It does not modify any other settings.

## Escape hatches

Both work without a working Claude session, because a session frozen by the guard
cannot be used to turn the guard off. Either one thaws every frozen session on the
machine within one `SLEEP_INCREMENT` (20 seconds by default).

A frozen session looks exactly like a hung one from the outside: the session sits
still, produces no output, and shows no error, for as long as the freeze holds, up to
about 5.4 hours. Nothing in the transcript marks it as the guard rather than a stuck
process. The one piece of evidence is `guard.log` at `~/.claude/usage-guard/guard.log`:
a `freeze start` line with no matching `freeze end` confirms this is the guard holding
the call, not a hang, so check there before assuming something is broken. Pressing Esc
against a session in
that state is untested (see "Known limitations" below), so it is not the recommended
way to find out which situation you are in. Creating the DISABLE file (see below)
thaws the session within one `SLEEP_INCREMENT`, about 20 seconds by default, and is
the safe way to confirm it was the guard: if the session resumes, it was frozen; if it
does not, look elsewhere.

**1. The DISABLE file.** Its presence disables the guard for every session on the
machine until it is removed.

cmd.exe:
```
mkdir "%USERPROFILE%\.claude\usage-guard" 2>nul
type nul > "%USERPROFILE%\.claude\usage-guard\DISABLE"
```

To re-enable:
```
del "%USERPROFILE%\.claude\usage-guard\DISABLE"
```

bash:
```bash
mkdir -p ~/.claude/usage-guard && touch ~/.claude/usage-guard/DISABLE
```

To re-enable:
```bash
rm ~/.claude/usage-guard/DISABLE
```

**2. The environment variable.** Setting `CLAUDE_USAGE_GUARD_OFF=1` in the environment
a session's hooks run in has the same effect, scoped to that environment rather than
machine-wide.

cmd.exe:
```
set CLAUDE_USAGE_GUARD_OFF=1
```

bash:
```bash
export CLAUDE_USAGE_GUARD_OFF=1
```

## Optional: statusline shim for fresher readings

The plugin works fully without this. The poller is the floor: it keeps `state.json`
current on its own schedule and the gate reads it regardless of whether a statusline
is configured.

Claude Code passes a `rate_limits` block to a statusline command on roughly a
30-second refresh, and to no hook. Pointing `hooks/usage-statusline` at that command
lets the gate see a fresher reading wherever a statusline runs, without replacing the
poller: a headless `claude -p` session renders no statusline at all, and that is
exactly where long unattended work happens, so the poller keeps covering it either
way. Both sensors write the same `state.json` through the same atomic write, and the
gate has no way to tell which one wrote a given reading, nor does it need to.

A plugin cannot install a `statusLine` setting on a user's behalf, so wiring this up
is a manual, per-machine step. Add it to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash \"/ABSOLUTE/PATH/TO/usage-guard/hooks/usage-statusline\"",
    "refreshInterval": 30
  }
}
```

Use the absolute path to your clone, matching the one used for the hooks in
`hooks/hooks.json`. This setting **replaces** any existing statusline command: a user
who already has one configured needs to merge the two rather than overwrite, since
only one `statusLine.command` can run.

## Where state lives

The poller runs `claude -p "/usage"` in the background on its own schedule, roughly
every 2 to 15 minutes, to refresh `state.json`. That is a plain process spawn, not a
model turn, which is why it is affordable to run this often, but it does mean the
guard's sensor invokes the CLI on its own behind the scenes. Every probe is recorded
in `guard.log`.

Everything is under `~/.claude/usage-guard/` (overridable via `GUARD_DIR`):

- `state.json`: the poller's last reading, usage percentage, window reset time, and
  the timestamp it was written.
- `guard.log`: an append-only line per gate decision that was not a plain ALLOW
  (relaunches, warns, drain denials, freeze start/end), plus poller lifecycle lines,
  including every `claude -p "/usage"` probe.
- `guard.lock`, `last-relaunch`, `gate-seen`, `last-warn`: internal coordination
  files. Safe to delete while no session is frozen; the guard fails open and
  recreates them.

A stale `guard.lock` disables the guard silently: the lock exists to keep two pollers
from running at once, and a poller that gets killed without running its exit trap can
leave the lock held by a pid that later gets reused by an unrelated process, which
then reads as "still running" forever. There is no independent liveness check, so
recovery is manual: `rm -rf ~/.claude/usage-guard/guard.lock`.

## Configuring thresholds

Every value in `lib/config.sh` reads from the environment first, so thresholds can be
changed without editing the plugin. Set these in the environment your Claude Code
sessions inherit:

| Variable | Default | Meaning |
|---|---|---|
| `THRESHOLD_WARN` | `80` | Usage percentage at which the gate starts surfacing a throttled advisory message. |
| `THRESHOLD_DRAIN` | `90` | Usage percentage at which new subagent spawns start getting denied. |
| `THRESHOLD_FREEZE` | `95` | Usage percentage at which tool calls are held until the window resets. |
| `STALE_SECONDS` | `1200` | How old a state reading can be before the gate treats it as unknown and allows the call. |
| `RESET_BUFFER` | `60` | Seconds added past the window's reset time before a freeze releases. |
| `SLEEP_INCREMENT` | `20` | How often a frozen hook wakes to recheck the clock and the DISABLE file. |
| `HOOK_TIMEOUT_SECONDS` | `19800` | Must match the `timeout` value in `hooks/hooks.json`. The freeze releases 120 seconds before this so a timeout overrun leaks one call instead of failing silently. |
| `PROBE_TIMEOUT` | `60` | Seconds the poller waits for a single usage probe before killing it. |
| `PROBE_MIN_INTERVAL` | `30` | Minimum seconds between two `claude -p "/usage"` probes, machine-wide. |
| `RELAUNCH_THROTTLE` | `60` | Minimum seconds between the gate's attempts to relaunch a missing poller. |
| `GATE_IDLE_TIMEOUT` | `1800` | Seconds without a tool call before the poller assumes no session is left to serve and exits. |
| `WARN_THROTTLE` | `600` | Minimum seconds between two advisory messages. |

The file paths under "Where state lives" above (`STATE_FILE`, `DISABLE_FILE`, `LOCK_FILE`,
`LOG_FILE`) are also individually overridable; in practice `GUARD_DIR` alone covers them.

## Cost

Measured on Windows with Git Bash: the gate adds roughly 395-400 ms to every tool
call. Git Bash forks a process for nearly every line the gate scripts execute, and
process creation is expensive on this platform; Linux and macOS are expected to be far
cheaper since a fork there costs a fraction of the Windows figure, but only the Windows
number above has been measured. An earlier estimate of 73 ms came from a
simplified probe that did not exercise the real gate script and should not be
trusted.

A held hook (a tool call frozen at 95%+) costs two processes for its duration, not
one: Claude Code wraps each configured hook command in its own shell, so the gate
process runs inside a wrapper process for as long as the freeze lasts.

## Known limitations

- **The sensor invokes `claude -p "/usage"` in a child session.** That child session
  goes through Claude Code's normal SessionStart hook wiring like any other session,
  which would launch a second poller inside it, and that poller's own probe would
  launch a third, unbounded. The child session is marked with `USAGE_GUARD_PROBE=1`
  so its SessionStart poller and its PreToolUse gate both stand down immediately and
  do no work. `PROBE_MIN_INTERVAL` (default 30 seconds) backstops this machine-wide,
  capping probes to at most one per interval even if the marker were ever lost.
- **Timeout verified to 900 seconds, not the full 19800.** `HOOK_TIMEOUT_SECONDS`
  carries no documented maximum in the hook schema, and a 900-second hold has been
  observed to survive cleanly well past the 600-second default, so the full
  5.5-hour window is expected to work the same way. It has not been tested at that
  length, since a single such test takes six hours.
- **Esc against a sleeping hook is untested.** What happens if a user presses Esc
  while a tool call is frozen has not been verified.
- **The plugin reads an undocumented internal of the `claude` binary.** Specifically
  the `cachedUsageUtilization.utilization.five_hour` block in `~/.claude.json`,
  which has changed more than once in a single week during this project's
  development. Every JSON path is validated on read, and a mismatch makes the guard
  fail open (treat state as unknown, allow the call) rather than error.
- **The poller's lock-reclaim race is bounded, not eliminated.** A rename is atomic
  only against whatever currently occupies the lock path; there is no
  compare-and-swap against the directory state a racing poller inspected earlier,
  so two pollers can briefly both believe they hold the lock. An ownership recheck
  at the top of each loop caps the resulting damage at one wasted iteration before
  the loser exits.
- **Whether the background poller outlives its parent session is unresolved.** On
  this Windows machine, backgrounded poller children were observed to survive their
  parent process being killed and get reparented. That is supporting evidence, not
  a controlled experiment: killing a process is not the same signal Claude Code
  sends when a session exits normally. `GATE_IDLE_TIMEOUT` exists specifically to
  bound the case where the poller does survive its session, by giving it a way to
  notice no one is calling tools anymore and exit on its own.
- **`tool_name` extraction depends on hook payload key order.** The gate looks for
  the top-level `tool_name` key by pattern-matching the raw payload text, which
  assumes Claude Code emits `tool_name` before `tool_input` in the JSON it writes to
  the hook's stdin. JSON does not guarantee key order, so a future payload that
  reorders those keys would break the match. A structural fix needs a real JSON
  parser, which the zero-dependency design rule for this plugin forbids.
- **The 80% advisory's reach into the model's own context is unverified.** The
  `systemMessage` the gate emits on `PreToolUse` was confirmed visible under
  `--output-format stream-json`, arriving as its own `{"type":"system",
  "subtype":"informational"}` event positioned alongside the tool's completion
  notification rather than inside the `tool_result` that carries content back to the
  model. That is consistent with a UI and observability side-channel rather than
  context injection, so the model probably never sees the advisory, though this was
  not proven either way. `guard.log` is unaffected either way and records every warn
  regardless of output mode.

## Verified behavior

End-to-end verification against real `claude -p` sessions, via `test/e2e/run-e2e` and a
fabricated state file (`test/e2e/settings-e2e.json`, `test/e2e/noop-poller`). The checks
below are the full detail; the working report they were drafted from is preserved as a
historical record at [`docs/evidence-e2e-verification.md`](docs/evidence-e2e-verification.md).

**Check 1, below threshold, gate invisible.** `used_percentage=10`. Captured stdout:
model reported `alive`, elapsed 19s (target: roughly 5-15s; slightly over, plausibly
session-startup variance, not a gate artifact). Confirms the gate is silent at 10%
usage, below the drain threshold (`THRESHOLD_DRAIN=90`).

**Check 2, freeze then release.** `used_percentage=99`, reset fabricated 90s out. Rerun
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

**Check 3, drain band.** `used_percentage=92`. Evidence is `guard.log` only (no stdout
was captured for this check; see the incident note in
[`docs/evidence-e2e-verification.md`](docs/evidence-e2e-verification.md)):
```
deny spawn tool=Agent pct=92
```
No `freeze start` line appears, correctly, since 92 is below the freeze threshold (95).

**Check 4, escape hatch.** `used_percentage=99`, `DISABLE` file touched 25s after start.
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
after this work, at the commit these checks were run against. The suite has grown since
(150 assertions, 0 failed, as of this README revision); this number is a snapshot, not a
live count.

## Fan-out behavior

What happens when a freeze catches subagents already running, via
`test/e2e/run-fanout` (same fabricated-state mechanism as above). As with "Verified
behavior" above, the checks below are the full detail; the working report is preserved
as a historical record at [`docs/evidence-fanout-freeze.md`](docs/evidence-fanout-freeze.md).

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
appeared at that moment, as two parent/child pairs, one pair per concurrently held
`PreToolUse` hook invocation (Claude Code's hook runner wraps the configured `bash
"<ROOT>/hooks/usage-gate"` command in its own shell, so each held hook shows up as a
wrapper + the actual gate process). This count is confirmed, not assumed, from PID and
start-time correlation with `guard.log`. A raw `ps -W | grep -c bash` taken during the
same window returned 33-35, but that count is dominated by unrelated bash processes
belonging to the outer Claude Code session driving this experiment and is not a usable
signal on its own; it is reported here only so it isn't silently omitted.

**Outcome: all three agents finished successfully, but the freeze itself only caught
two of their tool calls.** AGENT-3's call landed and completed before the freeze began
and was never held at all, so this run confirms freeze/release survival for the calls
that froze concurrently, not that a freeze catching all three simultaneously
would behave the same way; that stronger claim is unconfirmed by this run and would
need a design (e.g. staggered `sleep` starts) that reliably lands every agent's first
tool call after the freeze begins.

Unit suite unaffected: 134 assertions, 0 failed, before and after this work, at the
commit this check was run against; see the note at the end of "Verified behavior" above
for the current count.
