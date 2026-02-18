#!/bin/bash
# 飞书自定义机器人 webhook 发送脚本
# 用法: feishu-webhook.sh "消息内容"
# 不消耗飞书 API 调用量

WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/b14e6155-5ed4-4321-ad57-31306f19f3fa"

MSG="$1"
if [ -z "$MSG" ]; then
  echo "Usage: $0 <message>"
  exit 1
fi

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$MSG\"}}" 2>/dev/null
