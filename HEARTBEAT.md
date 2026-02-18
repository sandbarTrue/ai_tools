# HEARTBEAT.md

## ⚠️ 限流自动休眠规则
如果上次触发了429限流（检查 memory/rate-limit-state.json），且距离限流时间不足5小时，直接回复 HEARTBEAT_OK，不执行任何操作。

## ⚠️ 省 token 模式
为节省 Opus token，heartbeat 只做最轻量的检查：
1. 不截图，不用浏览器（除非有明确的 @瓦力 需要回复）
2. 群聊监控降级：只检查飞书 API 消息通知，不用浏览器截图
3. 如果没有紧急事项且没有异步任务在跑，直接 HEARTBEAT_OK

## 🔍 异步任务巡检（每次 heartbeat 必做）

### 第一步：检查完成回调文件（最重要！）
```bash
ls /tmp/task-done-*.json 2>/dev/null
```
- **有文件 → 立即读取并汇报给搞钱大王**，然后删除文件
- 这是 Claude Code / OpenSpec-bg 完成后自动写入的
- 不管成功还是失败都要汇报

### 第二步：检查活跃任务
1. **GLM-5 子agent**：`sessions_list` 看是否有 active 子 session
2. **Screen 会话**：`screen -ls | grep -E "openspec-|direct-"`
   - 有 → 看最后日志时间，超 10 分钟无输出 = 可能卡了

### 判断逻辑
- 🎉 有 task-done 文件 → **必须汇报**（不许回 HEARTBEAT_OK）
- ⚠️ 活跃任务超 10 分钟无输出 → 通知搞钱大王
- ❌ 进程消失但无 task-done 文件 → 异常退出，通知
- ✅ 无任务/任务正常进行 → HEARTBEAT_OK

## 飞书群聊监控（轻量模式）
只在以下情况下用浏览器检查群聊：
- 收到飞书 @瓦力 的通知
- 搞钱大王明确要求检查

其他情况直接 HEARTBEAT_OK。
