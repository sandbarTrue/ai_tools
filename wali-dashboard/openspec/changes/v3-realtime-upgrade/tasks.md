# Tasks

- [x] 9.1 自动刷新机制：在 src/app/page.tsx、src/app/tasks/page.tsx、src/app/models/page.tsx 中，把 useEffect 一次性 fetch 改为 30 秒轮询（setInterval + clearInterval），并在页面右上角加"最后更新: XX:XX"标签（从 stats.generated_at 取时间）和绿色小圆点表示 live
- [x] 9.2 API 类型扩展：在 src/lib/api.ts 的 StatsData 接口增加 live_sessions（LiveSession[]）和 task_progress 字段。LiveSession: {id, kind, label, model, executor, lastActiveMinutes, lastAction, tokens, status}。task_progress: {total, completed, percentage, phases: [{name, tasks, done}]}
- [x] 9.3 任务进度条组件：在 src/app/tasks/page.tsx 实时 tab 中，增加一个"任务进度"区块。从 stats.wali_status.taskProgress 读取数据。显示：总进度条（percentage%）+ 每个 phase 的进度条（done/tasks）。用现有暗色主题风格
- [x] 9.4 活跃 Session 列表：在 src/app/tasks/page.tsx 实时 tab 最上方加"活跃 Session"表格，从 stats.live_sessions 读取。每行：label、kind（彩色标签 main=紫 group=蓝 subagent=绿）、executor、lastAction（50字截断）、状态圆点（active=绿 recent=黄 idle=灰）、lastActiveMinutes 格式化（"刚刚"/"5分钟前"/"1小时前"）
- [x] 9.5 Claude Code session 优化：src/app/tasks/page.tsx 中，相同 cwd 的 Claude Code session 合并为一行显示"N次执行"，展示最后一次时间和 tool 数。加展开按钮显示详情。无 ended 的显示"运行中"绿标签
- [x] 9.6 首页进度展示：在 src/components/AgentStatus.tsx 或 ActiveTasksCard.tsx 中，queue 列表旁加总进度统计：从 wali_status.taskProgress 读取，显示小进度条+"已完成/总数"文字
- [x] 9.7 移动端适配检查：确保所有新增 UI 在 375px 宽不溢出。表格小屏用卡片式或横向滚动。运行 npx next build 确保无报错
