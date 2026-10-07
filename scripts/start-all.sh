#!/bin/sh
# ==============================================================================
# SecuAI Multi-Process Shell Supervisor
# Starts API and Background Worker in a single container
# ==============================================================================

set -e

echo "======================================================"
echo "🛡️  SecuAI Shell Supervisor Starting"
echo "======================================================"

# 1. Start Worker
node apps/api/dist/worker.js &
WORKER_PID=$!

# 2. Start API
START_WORKER=false node apps/api/dist/server.js &
API_PID=$!

cleanup() {
  echo "[Supervisor] Stopping child processes (PID: $WORKER_PID, $API_PID)..."
  kill -TERM "$WORKER_PID" "$API_PID" 2>/dev/null || true
  wait "$WORKER_PID" "$API_PID" 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM EXIT

# Wait for any process to finish/crash
wait -n "$WORKER_PID" "$API_PID"
EXIT_STATUS=$?

echo "[Supervisor] A process exited with status $EXIT_STATUS. Shutting down..."
kill -TERM "$WORKER_PID" "$API_PID" 2>/dev/null || true
exit $EXIT_STATUS
