#!/bin/bash
# 异步任务巡检脚本 — 每5分钟由 cron 调用
# 检查 screen sessions + Claude Code 进程
# 只在有活跃任务时输出（供 cron agentTurn 判断是否发消息）

export PATH=/root/.nvm/versions/node/v24.10.0/bin:$PATH

RESULT=""
HAS_ACTIVE=false

# 1. 检查 screen sessions (openspec-/direct-)
SCREENS=$(screen -ls 2>/dev/null | grep -E "openspec-|direct-" | awk '{print $1}')
if [ -n "$SCREENS" ]; then
    HAS_ACTIVE=true
    for s in $SCREENS; do
        SESSION_NAME=$(echo "$s" | sed 's/^[0-9]*\.//')
        # 找对应 log
        LOG=$(ls -t /tmp/openspec-bg-logs/${SESSION_NAME}*.log 2>/dev/null | head -1)
        if [ -n "$LOG" ]; then
            LAST_MOD=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
            NOW=$(date +%s)
            AGE=$(( (NOW - LAST_MOD) / 60 ))
            LAST_LINE=$(tail -1 "$LOG" 2>/dev/null | strings | head -1)
            if [ $AGE -gt 10 ]; then
                RESULT="${RESULT}⚠️ ${SESSION_NAME}: ${AGE}分钟无输出，可能卡死\n最后: ${LAST_LINE}\n"
            else
                RESULT="${RESULT}🔄 ${SESSION_NAME}: ${AGE}分钟前活跃\n最后: ${LAST_LINE}\n"
            fi
        else
            RESULT="${RESULT}🔄 ${SESSION_NAME}: 运行中(无log)\n"
        fi
    done
fi

# 2. 检查 claude 进程
CLAUDE_COUNT=$(ps aux | grep "^zhoujun.*claude$" | grep -v grep | wc -l)
if [ "$CLAUDE_COUNT" -gt 0 ]; then
    HAS_ACTIVE=true
    RESULT="${RESULT}🤖 Claude Code: ${CLAUDE_COUNT}个进程\n"
fi

# 3. 检查文件变化（5分钟内）
CHANGED=$(find /home/zhoujun.sandbar/workspace/wali-dashboard/src -newer /tmp/wali-stats.json \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | wc -l)
if [ "$CHANGED" -gt 0 ]; then
    RESULT="${RESULT}📝 ${CHANGED}个文件在最近5分钟被修改\n"
fi

# 4. 输出结果
if [ "$HAS_ACTIVE" = true ]; then
    echo -e "ACTIVE\n${RESULT}"
else
    echo "IDLE"
fi
