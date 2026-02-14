#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_PID_FILE="${PROXY_PID_FILE:-$ROOT_DIR/anthropic-oauth-proxy.pid}"

if [ -f "$PROXY_PID_FILE" ]; then
  PID="$(cat "$PROXY_PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    echo "Stopped proxy PID=$PID"
  fi
  rm -f "$PROXY_PID_FILE"
else
  echo "No proxy pid file found."
fi

