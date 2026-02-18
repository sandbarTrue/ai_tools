# 搞钱看板 v4 — 架构设计文档

## 一、实体关系图

### 核心实体（8个）

**USER** → 搞钱大王，通过飞书发起对话
↓ 发起
**SESSION** → OpenClaw 的一个对话上下文
- kind: 后台引擎(main) / 群聊:XXX(group) / 私聊(dm) / 定时任务(cron) / 子任务(subagent)
- 群聊名称从飞书 API 动态获取（不硬编码）
↓ 执行
**TASK** → 业务任务（唯一来源：TASK.md）
- status: 待办 / 进行中 / 完成 / 失败 / 阻塞
- 每个 task 有 completed/total 子项进度
↓ 分两条路执行
**OPENSPEC_CHANGE** → OpenSpec 管理的一次变更（proposal.md + tasks.md）
- 包含多个 OPENSPEC_TASK（checkbox 子任务）
- 有提案内容、任务清单、执行状态、费用

**SCREEN_PROCESS** → screen 后台的 Claude Code 进程
- 有任务描述（从 prompt.txt 读取）、模型、运行时间、失败原因
- 产生 CC_EVENT（Claude Code Hooks 记录的使用事件）

**SUBAGENT** → sessions_spawn 创建的隔离子会话
- 有任务描述、模型、状态、运行时间

**MODEL** → 使用的 AI 模型
- Claude Opus 4.6 / GLM-5 / MiniMax M2.5 等
- 统计：调用次数、token 用量、费用

---

## 二、Agent ↔ 管理后台 通信架构

### 数据流

```
Agent 端 (OpenClaw Server)
├── Session JSONL (对话记录)
├── Screen 进程 (Claude Code 后台)
├── 子Agent (sessions_spawn)
├── Claude Code Hooks (usage-tracker)
├── TASK.md (任务进度)
└── OpenSpec changes/ (提案+任务)
         │
         ▼
    事件总线 (文件系统)
    ├── /tmp/wali-events/*.json (通用事件)
    └── /tmp/task-done-*.json (完成回调)
         │
    ┌────┴────┐
    ▼         ▼
即时通知      Collector (每5分钟)
├── task-complete-notify.sh    ├── openclaw-sessions.js
├── 飞书 API → 搞钱大王       │   → 模型统计/Session列表
└── 触发 Collector             ├── wali-status.js
                               │   → 任务进度/Screen/操作
                               └── index.js
                                   → 合并输出 stats.json
                                        │
                                        ▼ SCP
                               管理后台 (junaitools.com)
                               ├── stats.json (全量数据)
                               └── 前端页面 (30秒轮询)
                                        │
                                        ▼
                                   搞钱大王浏览器
```

### 通信方式

**当前方案：文件队列 + SCP**
- Agent 写文件 → Collector 读文件 → SCP 到远端 → 前端轮询
- 优点：简单、无依赖、共享主机可用
- 缺点：最快 5 秒延迟（Collector 间隔），不支持双向通信

**升级方案：WebSocket 实时推送**（下一阶段）
- Agent → WebSocket Server → 前端实时接收
- 支持双向：前端可以向 Agent 发送控制指令（暂停/取消/重试）
- 需要在 junaitools.com 跑一个 Node.js WS 服务

**终极方案：Redis MQ**（更远期）
- Agent → Redis Stream → Collector/前端 都消费
- 支持消息持久化、重放、多消费者
- 需要 Redis 实例（共享主机不支持，需 VPS）

### 当前选择

**先用"文件队列 + SCP + 即时通知回调"**，因为：
1. 共享主机只能用文件和 PHP，不能跑长进程
2. task-done 回调已经实现了即时飞书通知
3. 30 秒前端轮询 + 5 分钟 Collector 已经够用
4. 等搬到 VPS 后再升级 WebSocket

---

## 三、OpenSpec 提案和任务进度 — 看板可视化设计

### 数据采集

Collector 读取 `{project}/openspec/changes/{name}/` 目录：

```json
{
  "openspecHistory": [
    {
      "changeName": "v3-info-upgrade",
      "project": "wali-dashboard",
      "proposal": "看板信息质量优化\n## 三个问题\n1. 执行命令看不出在干啥...",
      "tasks": [
        {"id": "10.1", "title": "任务进度查看详情跳转链接", "completed": true},
        {"id": "10.2", "title": "OpenSpec 任务记录区块", "completed": true},
        {"id": "10.3", "title": "最近操作视觉区分", "completed": true},
        {"id": "10.4", "title": "build 验证 + 移动端适配", "completed": true}
      ],
      "model": "GLM-5",
      "status": "success",
      "cost": 0.95,
      "durationMs": 444000,
      "completedAt": "2026-02-18T13:23",
      "failReason": null,
      "logExcerpt": "Completed 4 tasks..."
    }
  ]
}
```

### 前端展示

**任务页 - OpenSpec 执行记录区块：**

```
┌─────────────────────────────────────────────────┐
│ 🔧 OpenSpec 执行记录                              │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ✅ v3-info-upgrade | wali-dashboard           │ │
│ │ GLM-5 · 7分24秒 · $0.95 · 2026-02-18 13:23  │ │
│ │ ┌─ 展开提案 ─────────────────────────────┐   │ │
│ │ │ 看板信息质量优化                         │   │ │
│ │ │ 1. 执行命令看不出在干啥                   │   │ │
│ │ │ 2. 完成的任务没法跳转看详情               │   │ │
│ │ │ 3. 最近操作没有信息增量                   │   │ │
│ │ └──────────────────────────────────────────┘   │ │
│ │ ┌─ 任务明细 (4/4) ───────────────────────┐   │ │
│ │ │ ✅ 10.1 任务进度查看详情跳转链接          │   │ │
│ │ │ ✅ 10.2 OpenSpec 任务记录区块             │   │ │
│ │ │ ✅ 10.3 最近操作视觉区分                  │   │ │
│ │ │ ✅ 10.4 build 验证 + 移动端适配           │   │ │
│ │ └──────────────────────────────────────────┘   │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ❌ painradar-fix | painradar-backend          │ │
│ │ GLM-5 · 3分12秒 · $0.12 · 13:55             │ │
│ │ 失败原因: API 超时 (exit code 1)              │ │
│ │ [展开提案] [展开任务明细 2/5]                 │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**关键点：**
- 每条记录可展开看**提案内容**（proposal.md）
- 每条记录可展开看**任务明细**（tasks.md 的 checkbox 列表）
- 失败的记录显示**失败原因**
- 按时间倒序排列

---

## 四、实体关系总结

```
USER (搞钱大王)
 └─ SESSION (对话上下文)
     ├─ 后台引擎(main) — heartbeat/系统调度
     ├─ 群聊:XXX(group) — 飞书群，名称从API获取
     ├─ 私聊:搞钱大王(dm) — 飞书1v1
     ├─ 定时:XXX(cron) — 定时任务
     └─ 子任务:XXX(subagent) — 派发的后台任务
         │
         └─ TASK (业务任务，来源：TASK.md)
             ├─ OPENSPEC_CHANGE (OpenSpec变更)
             │   ├─ proposal.md (提案)
             │   └─ tasks.md → OPENSPEC_TASK[] (子任务)
             │
             └─ SCREEN_PROCESS (Claude Code后台)
                 ├─ task_description (任务描述)
                 ├─ fail_reason (失败原因)
                 └─ CC_EVENT[] (Hook事件)

MODEL (AI模型) — 被 SESSION/SCREEN/SUBAGENT 使用
```
