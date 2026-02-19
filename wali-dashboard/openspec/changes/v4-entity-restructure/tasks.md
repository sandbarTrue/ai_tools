# v4-entity-restructure 子任务

## 后端重构
- [x] T1: parseTaskTree 重写 — 解析 `## [活跃] xxx` 格式的业务任务
- [x] T2: 手动执行记录解析 — 解析 `### 执行记录` 下的 checklist
- [x] T3: Execution 加 project/tool 字段 — 从 log 提取项目路径和执行工具
- [x] T4: Task → Execution 关联 — 关键词 + TASK_PROJECT_MAP 双重匹配
- [x] T5: Session 统计修正 — 只统计有用户消息的对话
- [x] T6: 操作翻译 — extractAction 把命令翻译为人话
- [x] T7: OpenSpec proposal/tasks 读取 — 优先从 openspec changes 目录读
- [x] T8: Result JSON 子任务提取 — fallback 从 result 摘要提取
- [x] T9: promptContent 作用域修复 — let 提升到外层

## 前端重构
- [x] T10: AgentStatus 重写 — 显示活跃业务任务而非 AI 推断操作
- [x] T11: 首页任务卡 — 从 Phase 列表改为业务任务列表（只显示 active）
- [x] T12: 任务页双栏布局 — 左栏业务任务，右栏 Execution 详情
- [x] T13: Execution 可展开 — 工具/模型/时间/proposal/子任务/失败原因
- [x] T14: 手动执行记录展示 — manualExecs 在 Execution 列表顶部展示

## 待修复
- [ ] T15: 首页"最近操作"仍显示 shell 命令原文（部分未翻译）
- [ ] T16: Execution proposal 展示优化 — 太长需要截断 + 展开
- [ ] T17: 飞书多条消息问题 — renderMode=card 后需验证效果
