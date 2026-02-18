#!/bin/bash
set -euo pipefail

# switch-feishu.sh - 切换飞书 App 配置
# 用法: bash switch-feishu.sh --app-id <新appId> --app-secret <新appSecret> [--webhook-url <新URL>]

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
fail() { log_error "$1"; exit 1; }

# 默认值
APP_ID=""
APP_SECRET=""
WEBHOOK_URL=""

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --app-id)
            APP_ID="$2"
            shift 2
            ;;
        --app-secret)
            APP_SECRET="$2"
            shift 2
            ;;
        --webhook-url)
            WEBHOOK_URL="$2"
            shift 2
            ;;
        -h|--help)
            echo "用法: bash switch-feishu.sh --app-id <appId> --app-secret <appSecret> [--webhook-url <URL>]"
            echo ""
            echo "参数:"
            echo "  --app-id      新的飞书 App ID"
            echo "  --app-secret  新的飞书 App Secret"
            echo "  --webhook-url 新的 Webhook URL (可选)"
            exit 0
            ;;
        *)
            fail "未知参数: $1"
            ;;
    esac
done

# 验证必要参数
if [[ -z "$APP_ID" ]]; then
    fail "缺少参数: --app-id"
fi
if [[ -z "$APP_SECRET" ]]; then
    fail "缺少参数: --app-secret"
fi

# 配置文件路径
OPENCLAW_JSON="/root/.openclaw/openclaw.json"
ENV_FILE="/root/.openclaw/.env"
WEBHOOK_SH="/root/.openclaw/workspace/scripts/feishu-webhook.sh"
BACKUP_SUFFIX=$(date +%Y%m%d)

log_info "开始切换飞书 App 配置..."
log_info "新 App ID: ${APP_ID:0:8}..."

# 检查 openclaw.json 存在
if [[ ! -f "$OPENCLAW_JSON" ]]; then
    fail "配置文件不存在: $OPENCLAW_JSON"
fi

# 1. 备份 openclaw.json
log_info "备份 openclaw.json..."
cp "$OPENCLAW_JSON" "${OPENCLAW_JSON}.bak.${BACKUP_SUFFIX}"
log_info "  备份到: ${OPENCLAW_JSON}.bak.${BACKUP_SUFFIX}"

# 2. 用 node 替换 feishu 配置 (不用 jq，可能没安装)
log_info "更新 openclaw.json 飞书配置..."

node -e "
const fs = require('fs');
const configPath = '$OPENCLAW_JSON';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!config.channels) config.channels = {};
if (!config.channels.feishu) config.channels.feishu = {};

config.channels.feishu.appId = '$APP_ID';
config.channels.feishu.appSecret = '$APP_SECRET';

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('  已更新 channels.feishu.appId 和 channels.feishu.appSecret');
"

log_info "  openclaw.json 已更新"

# 3. 更新 webhook URL (如果提供)
if [[ -n "$WEBHOOK_URL" ]]; then
    log_info "更新 webhook URL..."

    if [[ -f "$WEBHOOK_SH" ]]; then
        # 备份
        cp "$WEBHOOK_SH" "${WEBHOOK_SH}.bak.${BACKUP_SUFFIX}"

        # 更新 WEBHOOK_URL 变量
        if grep -q 'WEBHOOK_URL=' "$WEBHOOK_SH"; then
            sed -i "s|WEBHOOK_URL=.*|WEBHOOK_URL=\"$WEBHOOK_URL\"|" "$WEBHOOK_SH"
        else
            echo "WEBHOOK_URL=\"$WEBHOOK_URL\"" >> "$WEBHOOK_SH"
        fi
        log_info "  webhook 已更新: $WEBHOOK_SH"
    else
        log_warn "  webhook 脚本不存在: $WEBHOOK_SH"
    fi
fi

# 4. 设置环境变量 (写入 .env 文件)
log_info "更新环境变量..."

mkdir -p /root/.openclaw

# 创建或更新 .env 文件
if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "${ENV_FILE}.bak.${BACKUP_SUFFIX}"
fi

# 移除旧的 FEISHU 相关变量，添加新的
if [[ -f "$ENV_FILE" ]]; then
    grep -v '^FEISHU_APP_ID=' "$ENV_FILE" | grep -v '^FEISHU_APP_SECRET=' > "${ENV_FILE}.tmp" || true
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
fi

echo "" >> "$ENV_FILE"
echo "# Feishu config - updated $(date)" >> "$ENV_FILE"
echo "FEISHU_APP_ID=\"$APP_ID\"" >> "$ENV_FILE"
echo "FEISHU_APP_SECRET=\"$APP_SECRET\"" >> "$ENV_FILE"

log_info "  环境变量已写入: $ENV_FILE"

# 导出环境变量到当前 shell
export FEISHU_APP_ID="$APP_ID"
export FEISHU_APP_SECRET="$APP_SECRET"

# 5. 重启 OpenClaw gateway
log_info "重启 OpenClaw gateway..."
if command -v openclaw &> /dev/null; then
    openclaw gateway restart 2>/dev/null || openclaw gateway start 2>/dev/null || log_warn "  gateway 重启可能失败，请手动检查"
    log_info "  gateway 已重启"
else
    log_warn "  openclaw 命令不可用，跳过 gateway 重启"
fi

# 6. 验证 - 发送测试消息
log_info "验证飞书配置..."
sleep 5

log_info "尝试发送测试消息..."

# 构造测试消息
TEST_MSG="飞书 App 切换测试 - $(date '+%Y-%m-%d %H:%M:%S')"

# 尝试通过 API 发送测试消息
if command -v openclaw &> /dev/null; then
    if openclaw feishu send "$TEST_MSG" 2>/dev/null; then
        log_info "  测试消息发送成功！"
    else
        # 尝试 curl 方式
        log_warn "  openclaw feishu send 失败，尝试 curl..."

        # 从 openclaw.json 获取 webhook URL
        WEBHOOK_FROM_CONFIG=$(node -e "
            try {
                const config = require('$OPENCLAW_JSON');
                console.log(config.channels?.feishu?.webhookUrl || '');
            } catch(e) {
                console.log('');
            }
        " 2>/dev/null || echo "")

        if [[ -n "$WEBHOOK_FROM_CONFIG" ]]; then
            curl -s -X POST "$WEBHOOK_FROM_CONFIG" \
                -H 'Content-Type: application/json' \
                -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$TEST_MSG\"}}" > /dev/null 2>&1 && \
                log_info "  测试消息通过 webhook 发送成功！" || \
                log_warn "  webhook 发送失败，请检查配置"
        else
            log_warn "  无法获取 webhook URL，跳过测试消息"
        fi
    fi
else
    log_warn "  openclaw 不可用，跳过验证"
fi

# 完成
echo ""
log_info "=========================================="
log_info "飞书 App 配置切换完成！"
log_info "=========================================="
echo ""
log_info "配置摘要:"
log_info "  App ID: ${APP_ID:0:8}****"
log_info "  配置文件: $OPENCLAW_JSON"
log_info "  环境变量: $ENV_FILE"
if [[ -n "$WEBHOOK_URL" ]]; then
    log_info "  Webhook: $WEBHOOK_URL"
fi
echo ""
log_info "如需回滚，备份文件位于:"
log_info "  ${OPENCLAW_JSON}.bak.${BACKUP_SUFFIX}"
