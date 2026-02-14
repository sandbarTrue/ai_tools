#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${ANTHROPIC_OAUTH_TOKEN:-}" ]; then
  echo "ERROR: 需要先设置 ANTHROPIC_OAUTH_TOKEN（Claude Max OAuth token）" >&2
  exit 1
fi

bash "$ROOT_DIR/install.sh"
bash "$ROOT_DIR/start.sh"

