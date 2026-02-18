#!/bin/bash
set -euo pipefail

# 旧机器停机脚本 — 搬迁完成后在旧机器上运行
# 用法: bash shutdown.sh [--force]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

echo "=========================================="
echo "  瓦力旧机器停机脚本"
echo "=========================================="
echo ""

if [[ "$FORCE" != "true" ]]; then
    log_warn "即将停止以下服务："
    echo "  1. OpenClaw gateway"
    echo "  2. 所有 screen 会话（stats-pusher, painradar, wali-api 等）"
    echo "  3. Collector cron job"
    echo "  4. anthropic-oauth-proxy"
    echo ""
    read -p "确认停机？新机器已验证OK？(y/N) " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "已取消"
        exit 0
    fi
fi

# 1. 停止 OpenClaw gateway
log_info "停止 OpenClaw gateway..."
if command -v openclaw &>/dev/null; then
    openclaw gateway stop 2>/dev/null && log_info "  gateway 已停止" || log_warn "  gateway 可能未运行"
else
    # 尝试直接 kill
    pkill -f "openclaw" 2>/dev/null && log_info "  openclaw 进程已终止" || log_warn "  未找到 openclaw 进程"
fi

# 2. 停止所有 screen 会话
log_info "停止 screen 会话..."
SCREENS=$(screen -ls 2>/dev/null | grep -oP '\d+\.\S+' || true)
if [[ -n "$SCREENS" ]]; then
    while IFS= read -r s; do
        screen -S "$s" -X quit 2>/dev/null
        log_info "  已停止: $s"
    done <<< "$SCREENS"
else
    log_info "  无活跃 screen 会话"
fi

# 3. 停止 anthropic-oauth-proxy
log_info "停止 anthropic-oauth-proxy..."
pkill -f "anthropic-oauth-proxy" 2>/dev/null && log_info "  proxy 已停止" || log_info "  proxy 未运行"

# 4. 移除 collector cron job
log_info "移除 collector cron..."
CURRENT_CRON=$(crontab -l 2>/dev/null || true)
if [[ -n "$CURRENT_CRON" ]]; then
    # 备份
    echo "$CURRENT_CRON" > /tmp/crontab-backup-shutdown.txt
    log_info "  crontab 已备份到 /tmp/crontab-backup-shutdown.txt"
    # 注释掉 wali 相关的 cron
    echo "$CURRENT_CRON" | sed 's|^\(.*/wali-.*\)|# DISABLED: \1|' | \
                           sed 's|^\(.*/openspec.*\)|# DISABLED: \1|' | \
                           sed 's|^\(.*/monitor_real_openclaw.*\)|# DISABLED: \1|' | \
                           crontab -
    log_info "  wali 相关 cron 已禁用"
fi

# 5. 最终确认
echo ""
log_info "=========================================="
log_info "停机完成！"
log_info "=========================================="
echo ""
log_info "已停止的服务："
echo "  ✅ OpenClaw gateway"
echo "  ✅ Screen 会话: ${SCREENS:-无}"
echo "  ✅ anthropic-oauth-proxy"
echo "  ✅ Collector cron（已注释，可恢复）"
echo ""
log_warn "如需恢复，运行："
echo "  crontab /tmp/crontab-backup-shutdown.txt"
echo "  openclaw gateway start"
