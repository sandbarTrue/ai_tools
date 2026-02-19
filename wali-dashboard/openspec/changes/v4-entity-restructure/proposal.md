# v4-entity-restructure: 看板 v4 实体重构

## 背景
搞钱看板从工程子任务视角重构为业务任务视角。6 实体模型：USER → SESSION → TASK → EXECUTION → MODEL。

## 目标
1. 首页显示当前活跃的业务任务（不是 AI 推断的操作描述）
2. 任务页：左栏业务任务列表，右栏点击后展示 Execution 详情
3. Execution 展示：OpenSpec proposal + tasks.md 子任务 + 工具/模型/费用/耗时
4. 手动执行记录（TASK.md 中的 `### 执行记录`）也在任务页展示

## 数据来源
- **业务任务**：`TASK.md`（`## [活跃] xxx` 格式）
- **Execution**：`/tmp/openspec-bg-logs/*.log`（Claude Code 执行日志）
- **Proposal**：OpenSpec `proposal.md`（优先）或 prompt 文件
- **子任务**：OpenSpec `tasks.md`（优先）或 result JSON 提取

## 技术方案

### 后端 (collectors/providers/wali-status.js)
- `parseTaskTree`：解析 TASK.md 业务任务 + 手动执行记录
- `collectOpenspecHistory`：从 log 文件提取 Execution，含 project/tool/proposal/tasks
- Task → Execution 关联：关键词 + project 路径双重匹配
- Session 统计：只计有用户消息的对话

### 前端
- `AgentStatus.tsx`：显示活跃业务任务（标题+目标+执行次数）
- `ActiveTasksCard.tsx`：Screen 进程 + 最近操作 + 对话统计
- `page.tsx`（首页）：当前任务卡 + 执行记录概览
- `tasks/page.tsx`：双栏布局，左任务列表右 Execution 详情（可展开）

### 操作翻译
最近操作从 shell 命令翻译为人话（`next build` → "构建前端项目"）
