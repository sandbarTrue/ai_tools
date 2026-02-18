#!/bin/bash
# task-complete-notify.sh
# 任务完成后自动通知：飞书消息 + 看板数据更新 + OpenClaw wake
#
# 用法: task-complete-notify.sh <session> <status> <project> <type>
# 示例: task-complete-notify.sh direct-123 success /path/to/project run-direct

set -e
export PATH=/root/.nvm/versions/node/v24.10.0/bin:$PATH

SESSION="${1:-unknown}"
STATUS="${2:-unknown}"
PROJECT="${3:-unknown}"
TYPE="${4:-unknown}"
TIMESTAMP=$(date -Iseconds)

echo "[notify] Task completed: session=$SESSION status=$STATUS type=$TYPE"

# 1. 更新看板数据（触发 collector）
echo "[notify] Updating dashboard stats..."
cd /root/.openclaw/workspace/collectors && node index.js > /tmp/notify-collector.log 2>&1 || true
echo "[notify] Collector done"

# 2. 发飞书通知（走 webhook，不消耗 API 额度）
WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/b14e6155-5ed4-4321-ad57-31306f19f3fa"

if [ "$STATUS" = "success" ]; then
    EMOJI="✅"
    MSG="$EMOJI 任务完成: $TYPE\n📁 项目: $(basename $PROJECT)\n⏱ Session: $SESSION\n🕐 时间: $(date '+%H:%M')"
else
    EMOJI="❌"
    MSG="$EMOJI 任务失败: $TYPE\n📁 项目: $(basename $PROJECT)\n⏱ Session: $SESSION\n🕐 时间: $(date '+%H:%M')\n请检查日志: /tmp/openspec-bg-logs/${SESSION}.log"
fi

curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$MSG\"}}" > /dev/null 2>&1 || true
echo "[notify] Feishu webhook notification sent (0 API cost)"

# 3. 触发 OpenClaw wake（让 heartbeat 立即处理）
curl -s -X POST http://127.0.0.1:18789/gateway/wake \
    -H "Authorization: Bearer my-secret-token-123" \
    -H "Content-Type: application/json" \
    -d '{"text":"[task-done] '"$SESSION"' '"$STATUS"'","mode":"now"}' > /dev/null 2>&1 || true

echo "[notify] All notifications sent"
