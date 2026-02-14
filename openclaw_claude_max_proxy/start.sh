#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_HOST="${PROXY_HOST:-127.0.0.1}"
PROXY_PORT="${PROXY_PORT:-8089}"

if [ -z "${ANTHROPIC_OAUTH_TOKEN:-}" ]; then
  echo "ERROR: 需要先设置 ANTHROPIC_OAUTH_TOKEN" >&2
  exit 1
fi

# 避免本机访问 127.0.0.1 被系统代理劫持
export NO_PROXY="${NO_PROXY:-}.byted.org,.bytedance.net,localhost,127.0.0.1"
export no_proxy="$NO_PROXY"

PROXY_LOG="${PROXY_LOG:-$ROOT_DIR/anthropic-oauth-proxy.log}"
PROXY_PID_FILE="${PROXY_PID_FILE:-$ROOT_DIR/anthropic-oauth-proxy.pid}"

if [ -f "$PROXY_PID_FILE" ] && kill -0 "$(cat "$PROXY_PID_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "Proxy 已在运行 (PID: $(cat "$PROXY_PID_FILE"))"
else
  echo "启动 Proxy: http://${PROXY_HOST}:${PROXY_PORT}"
  nohup node "$ROOT_DIR/anthropic-oauth-proxy.js" > "$PROXY_LOG" 2>&1 &
  echo $! > "$PROXY_PID_FILE"
  sleep 0.3
fi

echo "探测 Proxy /health..."
curl --noproxy 127.0.0.1 -fsS "http://${PROXY_HOST}:${PROXY_PORT}/health" >/dev/null
echo "Proxy OK"

if command -v openclaw >/dev/null 2>&1; then
  echo "OpenClaw 已安装：$(openclaw --version | head -n 1)"
  echo "提示：Gateway 建议用你自己的 supervisor/systemd 管理；容器环境可用前台运行。"
else
  echo "WARN: 未检测到 openclaw 命令（仅启动了本地 proxy）。"
fi

