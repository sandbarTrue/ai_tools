#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/3] 安装 Node 依赖 (https-proxy-agent)..."
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 未找到 node，请先安装 Node.js" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: 未找到 npm，请先安装 npm" >&2
  exit 1
fi

(cd "$ROOT_DIR" && npm install --no-fund --no-audit)

echo "[2/3] 配置 OpenClaw provider (anthropic-oauth-proxy)..."
node "$ROOT_DIR/configure-openclaw.js"

echo "[3/3] 修复 Feishu session 可能粘连的 provider (可选但推荐)..."
node "$ROOT_DIR/fix-sessions.js" || true

cat <<'EOF'

OK: 安装完成。

下一步：
  1) export ANTHROPIC_OAUTH_TOKEN="..."   # Claude Max OAuth token
  2) 一键启动：bash ./bootstrap.sh
     或仅启动 proxy：bash ./start.sh

EOF
