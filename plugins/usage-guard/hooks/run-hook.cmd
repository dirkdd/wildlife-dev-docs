: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper. On Windows cmd.exe runs the batch portion,
REM which locates bash. On Unix the shell treats the block as a no-op.
REM
REM Hook scripts are extensionless because Claude Code prepends "bash" to any
REM command containing .sh on Windows, which double-wraps and breaks them.

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

REM Bare "exit /b" below, not "exit /b %ERRORLEVEL%": cmd.exe expands
REM %ERRORLEVEL% once, at parse time of the enclosing parenthesised block,
REM so it would have carried the errorlevel from BEFORE the bash call, not
REM after. A bare "exit /b" needs no expansion and just propagates whatever
REM the last command actually set.
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b
)

where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b
)

REM No bash found. Exit 0 so the absence of a guard never breaks tool calls.
exit /b 0
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
