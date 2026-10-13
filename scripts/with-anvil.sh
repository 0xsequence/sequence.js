#!/usr/bin/env bash
# Runs the given command with an Anvil fork listening on localhost:8545.
# Reuses an already-running node; otherwise starts one and stops it on exit.
set -euo pipefail

PORT="${ANVIL_PORT:-8545}"
FORK_URL="${ANVIL_FORK_URL:-https://nodes.sequence.app/arbitrum}"

is_up() {
  (echo >"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
}

if is_up; then
  exec "$@"
fi

if ! command -v anvil >/dev/null 2>&1; then
  echo "with-anvil: 'anvil' not found. Install Foundry (https://getfoundry.sh) to run the tests." >&2
  exit 1
fi

LOG="$(mktemp -t anvil.XXXXXX.log)"
echo "with-anvil: starting anvil fork of $FORK_URL on :$PORT (log: $LOG)"
anvil --fork-url "$FORK_URL" --port "$PORT" >"$LOG" 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true; wait "$ANVIL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  is_up && break
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    echo "with-anvil: anvil exited before becoming ready:" >&2
    cat "$LOG" >&2
    exit 1
  fi
  sleep 0.5
done

if ! is_up; then
  echo "with-anvil: anvil did not start listening on :$PORT within 30s" >&2
  cat "$LOG" >&2
  exit 1
fi

"$@"
