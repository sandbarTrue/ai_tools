# 搞钱看板 v4 — 技术方案 + 任务拆分

---

## 一、现状问题（来自搞钱大王验收文档 10 条反馈）

1. 总览没有展示所有 session 正在做的任务
2. 待办队列"查看更多"无法点击
3. 任务进度"查看详情"看不到任务明细
4. session 和任务混在一起，概念不清
5. Screen 进程显示 0 个
6. Claude Code session 有失败但不知道原因
7. 最近操作 `python -c` 看不懂
8. Session 统计不知道是哪些 session
9. 任务统计 22 个数量不对
10. 模型用量一直没变

**根因：没有设计，概念不清晰。**

---

## 二、核心实体关系（6 个实体）

（见图1：实体关系图）

```
USER (搞钱大王)
 └─ SESSION (对话上下文) ─── 1:N
     ├─ 后台引擎(main)
     ├─ 群聊:XXX(group) — 群名飞书API动态获取
     ├─ 私聊:搞钱大王(dm)
     ├─ 定时:XXX(cron)
     └─ 子任务(subagent)
         │
         └─ TASK (业务任务, 仅来自 TASK.md) ─── 1:N
             │
             └─ EXECUTION (一次执行)
                 ├─ type: openspec → 有 proposal + tasks[]
                 ├─ type: direct → 有 task_description
                 ├─ type: subagent → sessions_spawn
                 └─ 使用 → MODEL
```

**关键规则：**
- Session 1:N Task — 一个会话可以下达多个任务
- Task 1:N Execution — 一个任务可多次执行（重试/多阶段）
- Claude Code 是底层工具，不单独作为实体
- OpenSpec 是工作流，体现为 Execution.type=openspec

---

## 三、通信架构：WebSocket + PHP 反向代理

（见图2：通信架构图）
（见图3：数据流时序图）

### 数据流
```
Agent (本地) → WS Client → WSS → PHP代理 → Node.js WS Server(3847) → 前端
                                                    ↓
                                              stats.json (兜底)
```

### WS 事件协议
```
task_created      — 新任务创建
task_updated      — 任务状态变更
execution_started — 开始执行
execution_progress — 进度更新（x/y 完成）
execution_done    — 执行完成/失败
session_activity  — session 活动
stats_update      — 全量统计更新
```

### PHP 代理
- 路径: `junaitools.com/ws/` → ws-proxy.php
- 内部: localhost:3847 (Node.js WS Server)
- 前端: `wss://junaitools.com/ws/` 连接

---

## 四、OpenSpec 提案和任务可视化

（见图4：OpenSpec 全流程图）

### 看板展示
每条 Execution 记录可展开看：
- **提案** — proposal.md 内容
- **任务明细** — tasks.md 的 checkbox 列表
- **失败原因** — 从 log 提取
- **运行中进度** — WS 实时推送

---

## 五、任务拆分

### Phase 1: 基础设施 — WS 通信链路

- [ ] T1.1 Spaceship Node.js WS Server (ws-server.js)
  - 监听 localhost:3847
  - 接收事件 → 广播给所有连接的前端
  - 同时写入 stats.json 兜底
  - 心跳机制保活
  
- [ ] T1.2 Spaceship PHP WebSocket 代理 (ws-proxy.php)
  - 处理 /ws/ 路径的 WebSocket 升级请求
  - 转发到 localhost:3847
  
- [ ] T1.3 本地 WS Client (stats-pusher.js)
  - 替代现有 SCP 管道
  - 连接 wss://junaitools.com/ws/
  - 发送事件：session_activity / execution_started / execution_done / stats_update
  - 断线自动重连
  
- [ ] T1.4 验证 WS 链路端到端通畅
  - 本地发送测试事件 → Spaceship WS Server → 前端收到

### Phase 2: 后端数据重构

- [ ] T2.1 统一 EXECUTION 数据结构
  - 合并 openspecHistory + screen 进程 + subagent 为 executions[]
  - 每条包含: id, type, project, model, status, cost, duration, failReason
  - openspec 类型额外读取 proposal.md + tasks.md
  - direct 类型读取 prompt.txt 第一行

- [ ] T2.2 清理不准确数据源
  - 删除 parseTodoItems（不再从 memory 读待办）
  - 任务只来自 TASK.md
  - 删除"任务统计 22 个"
  
- [ ] T2.3 recentActions 进一步优化
  - python3 -c → 提取用途描述
  - 长命令智能截断 50 字符
  - 去掉无意义操作（sleep, echo 等）

- [ ] T2.4 Session label 完善
  - 后台引擎(main) / 群聊:真实群名(group) / 私聊:搞钱大王(dm)
  - 定时:任务名(cron) / 子任务:描述(subagent)

### Phase 3: 前端重构

- [ ] T3.1 首页重构 — "正在执行的工作"统一展示
  - 替换现有分散的 session/screen/任务区块
  - 统一卡片列表：type标签 + 任务描述 + 时间
  - 数据来源: executions[] + live_sessions[]
  
- [ ] T3.2 首页 — 删除不准确区块
  - 删除"待办队列"（来自 memory 的不准确数据）
  - 删除"任务统计 22 个"
  - 保留：任务进度(TASK.md) + 模型排行 + 费用统计

- [ ] T3.3 任务页重构 — Execution 记录区块
  - 每条记录可展开看提案(proposal)和任务明细(tasks[])
  - 失败的显示失败原因
  - 运行中的显示实时进度
  - openspec/direct/subagent 三种类型不同展示

- [ ] T3.4 任务页 — 当前 TASK.md 任务树
  - 直接展示 TASK.md 的 checkbox 结构
  - phase 分组 + 子任务状态

- [ ] T3.5 WS 实时连接
  - 前端连接 wss://junaitools.com/ws/
  - 收到事件实时更新 UI
  - 断线降级到 30 秒轮询 stats.json
  - 连接状态指示器（🟢实时/🟡轮询）

- [ ] T3.6 Build 验证 + 移动端适配 + 部署

### Phase 4: 验收

- [ ] T4.1 对照 10 条问题逐项验证
- [ ] T4.2 截图 + 验收文档
- [ ] T4.3 飞书通知搞钱大王

---

## 六、执行分工

| Phase | 任务 | 执行者 | 方式 |
|-------|------|--------|------|
| 1 | WS 基础设施 (T1.1-T1.4) | Claude Code(GLM-5) | OpenSpec |
| 2 | 后端数据重构 (T2.1-T2.4) | 瓦力直接改 | 手动 |
| 3 | 前端重构 (T3.1-T3.6) | Claude Code(GLM-5) | OpenSpec |
| 4 | 验收 (T4.1-T4.3) | 瓦力 | 手动 |

**预计总耗时：** Phase 1 (20min) + Phase 2 (15min) + Phase 3 (20min) + Phase 4 (10min) ≈ 1 小时
