# Assertion helpers. Sourced by every test file.
# Each assertion increments ASSERT_TOTAL and, on failure, ASSERT_FAILED.

ASSERT_TOTAL=0
ASSERT_FAILED=0

assert_eq() {
  local actual="$1" expected="$2" msg="$3"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
  if [ "$actual" = "$expected" ]; then
    printf '  ok   %s\n' "$msg"
  else
    ASSERT_FAILED=$((ASSERT_FAILED + 1))
    printf '  FAIL %s\n       expected: [%s]\n       actual:   [%s]\n' "$msg" "$expected" "$actual"
  fi
}

assert_exit() {
  local expected="$1"; shift
  local msg="$1"; shift
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
  "$@" >/dev/null 2>&1
  local code=$?
  if [ "$code" = "$expected" ]; then
    printf '  ok   %s\n' "$msg"
  else
    ASSERT_FAILED=$((ASSERT_FAILED + 1))
    printf '  FAIL %s\n       expected exit: %s\n       actual exit:   %s\n' "$msg" "$expected" "$code"
  fi
}
