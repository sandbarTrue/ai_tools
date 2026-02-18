#!/bin/bash
# GLM-5 Agent - 用于执行子任务，节省 Opus token
# 用法: glm5-agent.sh "你的任务描述"
# 或: glm5-agent.sh --file task.md (从文件读取任务)

export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="a2edcf152e764abea7b37b946eeca113.UQPKI6PnRU3g4fea"

TASK="$1"

if [ "$1" == "--file" ] && [ -n "$2" ]; then
    TASK=$(cat "$2")
fi

if [ -z "$TASK" ]; then
    echo "用法: glm5-agent.sh \"任务描述\" 或 glm5-agent.sh --file task.md"
    exit 1
fi

# 调用 GLM-5 API
curl -s -X POST "${ANTHROPIC_BASE_URL}/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ANTHROPIC_AUTH_TOKEN}" \
  -H "anthropic-version: 2023-06-01" \
  -d "$(jq -n --arg task "$TASK" '{
    model: "GLM-5",
    max_tokens: 8000,
    messages: [{role: "user", content: $task}]
  }')" | jq -r '.content[0].text'
