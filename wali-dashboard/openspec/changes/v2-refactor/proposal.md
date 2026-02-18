# Wali Dashboard v2 Refactor — Provider 插件架构

## 背景
当前看板 stats-collector 是单文件脚本，数据采集逻辑硬编码，模型数据分散不合并，
任务状态靠手写 JSON mock。需要重构为可扩展的 Provider 插件架构。

## 目标
1. **Provider 插件系统**：每种数据来源是独立模块，统一接口
2. **模型数据合并**：同底层模型不同调用路径自动合并
3. **活跃任务自动检测**：从 screen 进程和日志自动判断任务状态
4. **配置驱动**：所有硬编码路径和规则可通过 config.json 配置
5. **前端组件化**：首页拆分为独立组件，数据自动关联

## 技术方案

### 后端 — Data Collector
```
collectors/
  index.js              # 主入口，加载 provider，合并输出
  config.json           # 路径配置 + 模型合并规则
  providers/
    openclaw-sessions.js  # OpenClaw session JSONL 扫描
    claude-code.js        # Claude Code hooks + screen logs
    screen-tasks.js       # screen -ls 活跃任务检测
```

### 模型合并规则
| 合并后名称 | 原始 key |
|-----------|---------|
| Claude Opus 4.6 | anthropic-oauth-proxy/claude-opus-4-6, anthropic/claude-opus-4-6 |
| GLM 系列 | zhipu/glm-4.7, zhipu/glm-5, claude-code/glm-5 |
| MiniMax M2.5 | coco-proxy/coco |
| 字节内部代理 | ai-agent-proxy-responses/*, ai-agent-proxy-google/* |
| Claude Haiku (CC) | claude-code/claude-haiku-* |
| OpenClaw 内部 | openclaw/delivery-mirror |

### 前端 — 组件拆分
- `AgentStatus.tsx` — 实时状态（自动从 active_tasks 读取）
- `TaskQueue.tsx` — 任务队列（自动从 tasks 数据读取）
- `ModelRanking.tsx` — 模型排行（读 merged_models）
- `BlockedAlert.tsx` — 卡点警告
- `CostOverview.tsx` — 费用概览

### 输出 stats.json 新增字段
```json
{
  "merged_models": [...],    // 合并后的模型排行
  "active_tasks": [...],     // 自动检测的活跃任务
  "raw_models": {...}        // 原始数据（向后兼容）
}
```

## 非目标
- 不做实时 WebSocket（保持 5 分钟轮询）
- 不做数据库（Phase 1 用 JSON 文件）
- 不做用户认证
