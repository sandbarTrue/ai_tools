# 搞钱看板 v4 — 最终设计方案

## 一、核心实体（6个）

### 实体关系
```
USER (搞钱大王)
 └─ SESSION (对话上下文) ──── 1:N
     ├─ 后台引擎(main)
     ├─ 群聊:XXX(group) — 群名从飞书API动态获取
     ├─ 私聊:搞钱大王(dm)
     ├─ 定时:XXX(cron)
     └─ 子任务:XXX(subagent)
         │
         └─ TASK (业务任务) ──── 1:N
             │ 来源：TASK.md（唯一来源）
             │
             └─ EXECUTION (一次执行) 
                 ├─ type: openspec → 有 proposal + tasks[]
                 ├─ type: direct → 有 task_description
                 ├─ type: subagent → sessions_spawn
                 ├─ model / cost / duration / status / fail_reason
                 └─ 使用 → MODEL
```

### 关键说明
- **Session 1:N Task**：一个 session（如搞钱大群）可以接收多个任务
- **Task 1:N Execution**：一个任务可以多次执行（重试、多阶段）
- **Claude Code 是底层工具**，不单独作为实体，被 EXECUTION 包含
- **OpenSpec 是工作流**，体现为 EXECUTION.type=openspec 时的 proposal + tasks

---

## 二、通信架构：WebSocket + PHP 反向代理

### 架构图
```
Agent (OpenClaw 本地服务器)
 │
 ├─ OpenClaw Session 活动
 ├─ Screen 进程事件
 ├─ 子Agent 状态
 ├─ TASK.md 变更
 └─ OpenSpec changes/
     │
     ▼
 WS Client (stats-pusher.js)
     │ WSS 推送事件
     ▼
 Spaceship (junaitools.com)
 ┌─────────────────────────┐
 │ PHP WS 代理             │
 │ (ws-proxy.php)          │
 │    │ WebSocket 升级     │
 │    ▼                    │
 │ Node.js WS Server       │
 │ (localhost:3847)        │
 │    │                    │
 │    ├─ 广播 → 前端页面   │
 │    └─ 写入 → stats.json │
 └─────────────────────────┘
     │
     ▼
 搞钱大王浏览器
 ├─ WSS 连接 → 实时更新 (0延迟)
 └─ 断线降级 → 轮询 stats.json (30秒)
```

### WS 事件类型
```json
{"event": "task_created", "task": {...}}
{"event": "task_updated", "task": {...}}
{"event": "execution_started", "execution": {...}}
{"event": "execution_progress", "execution": {..., "completed": 3, "total": 7}}
{"event": "execution_done", "execution": {..., "status": "success"}}
{"event": "session_activity", "session": {...}}
{"event": "stats_update", "stats": {...}}
```

### PHP 反向代理实现
- 用 `ws-proxy.php` 处理 WebSocket 升级请求
- 外部访问: `wss://junaitools.com/ws/`
- 内部转发到: `ws://localhost:3847`
- 同端口复用 HTTPS，不需要额外端口

---

## 三、OpenSpec 提案和任务进度可视化

### 数据采集
Collector 从两个来源读取 OpenSpec 数据：

**1. 执行记录**：`/tmp/openspec-bg-logs/*.log`
- 提取：session名、项目、模型、耗时、费用、状态
- 提取结果摘要和失败原因

**2. 提案和任务明细**：`{project}/openspec/changes/{name}/`
- `proposal.md` → 提案内容
- `tasks.md` → checkbox 任务列表（带完成状态）

### stats.json 输出
```json
{
  "executions": [
    {
      "id": "openspec-v3-info-upgrade-1771391741",
      "type": "openspec",
      "project": "wali-dashboard",
      "changeName": "v3-info-upgrade",
      "model": "GLM-5",
      "status": "success",
      "cost": 0.95,
      "durationMs": 444000,
      "completedAt": "2026-02-18T13:23",
      "failReason": null,
      "proposal": "看板信息质量优化\n## 三个问题\n1. ...",
      "tasks": [
        {"id": "10.1", "title": "任务进度查看详情跳转", "completed": true},
        {"id": "10.2", "title": "OpenSpec 任务记录区块", "completed": true},
        {"id": "10.3", "title": "最近操作视觉区分", "completed": true},
        {"id": "10.4", "title": "build 验证", "completed": true}
      ]
    }
  ]
}
```

### 前端展示
**任务页 - 执行记录区块**
- 每条可展开看**提案内容**（proposal.md）
- 每条可展开看**任务明细**（tasks 的 checkbox 列表）
- 失败的显示**失败原因**
- 运行中的显示**实时进度**（通过 WS 推送）

---

## 四、执行计划

| 阶段 | 内容 | 执行者 |
|------|------|--------|
| 1 | 后端 Collector 改造：统一 EXECUTION 数据结构 | 瓦力直接改 |
| 2 | Spaceship WS Server + PHP 代理 | OpenSpec(GLM-5) |
| 3 | 本地 WS Client (stats-pusher.js) | OpenSpec(GLM-5) |
| 4 | 前端重构：首页+任务页 | OpenSpec(GLM-5) |
| 5 | 验收测试 + 部署 | 瓦力 |
