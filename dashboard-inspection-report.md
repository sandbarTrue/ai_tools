# 🔍 搞钱看板 v3 全面巡检验收报告

**巡检时间：** 2026-02-18 13:50 - 14:05
**巡检人：** 瓦力
**看板地址：** https://junaitools.com/dashboard/

---

## 📋 巡检发现 & 修复清单

### 🔴 P0 - 严重问题（影响功能）

| # | 问题 | 修复 | 状态 |
|---|------|------|------|
| 1 | **查看详情 404** — "查看详情→"链接跳转到 `/dashboard/dashboard/tasks/`（双重 basePath） | Link href 从 `/dashboard/tasks/` 改为 `/tasks/`（Next.js basePath 自动拼接） | ✅ 已修复 |
| 2 | **查看全部 404** — "查看全部 14 个→"用 `<a>` 标签，href="/tasks" 没有 basePath | 改为 `href="/dashboard/tasks/"`（`<a>` 标签不自动加 basePath） | ✅ 已修复 |
| 3 | **任务进度数据错误** — 显示 3/7（43%）但实际 7/7 已全部完成 | TASK.md 更新为实际完成状态 | ✅ 已修复 |

### 🟡 P1 - 数据质量问题

| # | 问题 | 修复 | 状态 |
|---|------|------|------|
| 4 | **当前任务显示 HEARTBEAT_OK** — 无意义信息 | extractAction 跳过 HEARTBEAT_OK/NO_REPLY，取最近有意义的操作 | ✅ 已修复 |
| 5 | **最近操作全是"执行命令"** — 看不出在干什么 | extractAction 重写：exec → `$ 具体命令`, write → `写入 文件名`, read → `读取 文件名` | ✅ 已修复 |
| 6 | **最近操作大量重复** — 同一分钟的操作全部列出 | 新增去重逻辑（同分钟同 action 前缀合并），展示上限 8 条 | ✅ 已修复 |
| 7 | **活跃 Session kind=unknown** — 不知道是什么类型 | 读取 sessions.json 映射表，正确推断 kind（main/group/dm/cron） | ✅ 已修复 |
| 8 | **活跃 Session label 只显示 UUID 前8位** — 不可读 | 用 sessions.json 映射友好名称：主会话、搞钱大群、周杨氏家族等 | ✅ 已修复 |
| 9 | **GLM-5 大小写重复** — `claude-code/GLM-5` 和 `claude-code/glm-5` 分别统计 | 后端 collector 添加 MODEL_KEY_NORMALIZE 合并 | ✅ 已修复 |

### 🟢 P2 - 功能增强

| # | 新增功能 | 状态 |
|---|---------|------|
| 10 | **30 秒自动刷新** + "最后更新: HH:MM" 标签 | ✅ 已上线 |
| 11 | **任务进度条** — 总进度 + 每 phase 子进度 | ✅ 已上线 |
| 12 | **活跃 Session 列表** — kind 彩色标签、executor、last action | ✅ 已上线 |
| 13 | **OpenSpec 任务历史** — 后端 openspecHistory 字段，20 条记录 | ✅ 已上线 |
| 14 | **操作视觉区分** — 命令=绿色等宽，文件=蓝色高亮 | ✅ 已上线 |
| 15 | **任务完成自动通知** — screen 跑完 → 飞书消息 + 看板数据刷新 | ✅ 已上线 |

---

## 🧪 测试验证

### 页面可访问性
| 页面 | URL | HTTP 状态 | 结果 |
|------|-----|-----------|------|
| 首页 | /dashboard/ | 200 | ✅ |
| 任务页 | /dashboard/tasks/ | 200 | ✅ |
| 模型页 | /dashboard/models/ | 200 | ✅ |
| 查看详情链接 | /dashboard/tasks/ | 200 | ✅ |
| 数据 API | /wali-api/stats.json | 200 | ✅ |

### 数据准确性
| 数据项 | 验证结果 |
|--------|---------|
| 任务进度 | TASK.md 9/9 完成，前端显示 100% ✅ |
| 活跃 Session | 搞钱大群(group) + 主会话(main) ✅ |
| GLM-5 合并 | 15 calls（合并了大小写变体）✅ |
| 当前任务 | 不再是 HEARTBEAT_OK ✅ |
| 最近操作 | 显示具体命令和文件名 ✅ |

### Build 验证
- `npx next build` → exit code 0 ✅
- 静态导出 → `out/` 目录完整 ✅
- tar + scp 部署 → DEPLOYED ✅

---

## 📸 验收截图

### 首页 - 总览仪表盘
- 顶部状态卡：具体任务描述（不是 HEARTBEAT_OK）
- 最近操作：具体命令（`$ cd /root/...`）和文件名（`编辑 run.sh`）
- 活跃任务快览：Screen 进程 + 最近操作 + Session 统计
- 任务进度条 + "查看详情→"链接
- 模型用量排行 + 费用统计

### 任务页 - 任务看板
- 活跃 Session：搞钱大群(group)、主会话(main)，彩色标签
- 任务进度：phase 子进度条
- Claude Code Session：4 个项目，按最后活跃时间排序
- 待办队列：7 项

### 模型页 - 模型监控
- 6 个 Provider 分组展示
- GLM-5 数据正确合并（无重复）
- Token 消耗趋势图

---

## 📂 修改文件清单

### 后端（Collector）
- `collectors/providers/wali-status.js` — extractAction 重写 + 去重 + openspecHistory + currentTask 过滤
- `collectors/providers/openclaw-sessions.js` — sessions.json 映射 kind/label
- `collectors/index.js` — MODEL_KEY_NORMALIZE 合并大小写

### 前端（Dashboard）
- `src/components/AgentStatus.tsx` — 查看详情链接修复
- `src/app/page.tsx` — 查看全部链接修复
- OpenSpec v3-realtime-upgrade（7 tasks）— 自动刷新 + 进度条 + Session 列表
- OpenSpec v3-info-upgrade（4 tasks）— 详情跳转 + 历史记录 + 视觉区分

### 基础设施
- `scripts/task-complete-notify.sh` — 新建，任务完成自动通知
- `skills/openspec-bg/scripts/run.sh` — 去掉 set -e + 添加通知调用

---

## 💰 本轮费用
| 执行 | 模型 | 费用 |
|------|------|------|
| OpenSpec v3-realtime-upgrade | GLM-5 | $1.57 |
| OpenSpec v3-info-upgrade | GLM-5 | $0.95 |
| 小任务测试 | GLM-5 | $0.03 |
| 巡检 + 修复 | Opus | ~$3.00 |
| **合计** | | **~$5.55** |
