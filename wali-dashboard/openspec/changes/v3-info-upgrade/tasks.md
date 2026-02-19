# Tasks

- [x] 10.1 首页任务进度区增加"查看详情"链接：在 src/components/AgentStatus.tsx 或 ActiveTasksCard.tsx 中，任务进度 100%(7/7) 旁边加一个蓝色文字链接"查看详情 →"，点击跳转到 /dashboard/tasks/ 页面。用 Next.js 的 Link 组件（import Link from 'next/link'），href="/dashboard/tasks/"
- [x] 10.2 任务管理页增加 OpenSpec 任务详情区块：在 src/app/tasks/page.tsx 实时 tab 中，在任务进度条下方增加一个"OpenSpec 任务记录"区块。数据来源：stats.json 新增的 openspec_history 字段（后端已提供）。如果 stats.openspec_history 不存在就不显示。每条记录显示：change名称、任务数(completed/total)、耗时、费用、状态(success/failed)。展开后显示 tasks 列表（每个 task 的标题和完成状态）
- [x] 10.3 首页最近操作信息增量优化：在 AgentStatus 或 ActiveTasksCard 的 recentActions 展示中，如果 action 以"$"开头（命令），用等宽字体(font-mono)显示，颜色用绿色(text-green-400)。如果 action 包含文件名（"编辑"/"写入"/"读取"开头），文件名部分用高亮色(text-blue-400)。其他操作正常灰色文字。这样不同类型的操作视觉上一眼就能区分
- [x] 10.4 确保 npm run build 通过，检查移动端适配
