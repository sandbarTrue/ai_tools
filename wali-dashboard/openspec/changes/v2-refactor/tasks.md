# Tasks — v2-refactor

## Phase 1: Data Collector Provider 架构

- [x] Task 1: 创建 collectors/config.json 配置文件
  - 定义所有路径（sessions dir, claude code dir, log dir, output file）
  - 定义模型合并规则（modelGroups 数组）
  - 定义 SCP 上传配置
  - 定义 screen session 前缀列表

- [x] Task 2: 创建 collectors/providers/openclaw-sessions.js
  - 扫描 OpenClaw session JSONL 文件
  - 提取每个模型的 calls, input_tokens, output_tokens, cost
  - 支持时间窗口聚合（today, week, month, fiveHour）
  - 导出 collectModelUsage() 函数

- [x] Task 3: 创建 collectors/providers/claude-code.js
  - 扫描 Claude Code session JSONL（~/.claude/projects/）
  - 扫描 openspec-bg logs（/tmp/openspec-bg-logs/）解析 result JSON
  - 提取 token 用量
  - 扫描 hooks JSONL 获取 session/tool 信息
  - 导出 collectModelUsage() 和 collectSessions()

- [x] Task 4: 创建 collectors/providers/screen-tasks.js
  - 运行 screen -ls 找活跃 session（openspec-/direct- 前缀）
  - 读取对应 log 文件的修改时间
  - 判断 status: running（<5min）/ stale（>5min）/ completed
  - 读取 log 最后几行作为 logTail
  - 导出 collectActiveTasks()

- [x] Task 5: 创建 collectors/index.js 主入口
  - 加载 config.json
  - 调用每个 provider 的采集函数
  - 合并所有 provider 的模型数据
  - 按 config.json 的 modelGroups 规则合并模型
  - 读取 /tmp/wali-status.json 合并瓦力状态
  - 输出到 /tmp/wali-stats.json
  - SCP 上传到 spaceship
  - 每个 provider 失败不影响其他 provider

- [x] Task 6: 测试并替换旧 stats-collector.js
  - 运行 collectors/index.js 验证输出格式
  - 对比旧 stats-collector.js 的输出确保兼容
  - 更新 cron 指向新的 collector

## Phase 2: 前端组件化重构

- [x] Task 7: 创建 src/components/AgentStatus.tsx
  - 从 stats.json 的 active_tasks 自动显示当前任务
  - 无活跃任务时显示 idle
  - 显示 executor, model, duration, status

- [x] Task 8: 创建 src/components/TaskQueue.tsx
  - 从 tasks 数据自动提取 in-progress + planned + blocked
  - 按优先级排序
  - blocked 任务红色标注
  - 不再依赖 wali-status.json 的 queue 字段

- [x] Task 9: 创建 src/components/ModelRanking.tsx
  - 从 stats.json 的 merged_models 渲染排行表
  - 按调用次数排序
  - 显示费用、tokens、调用次数
  - 可展开看子模型明细

- [x] Task 10: 创建 src/components/CostOverview.tsx
  - 今日/本周/本月费用卡片
  - 从 merged_models 汇总

- [x] Task 11: 重构 src/app/page.tsx 首页
  - 用新组件替换现有硬编码
  - AgentStatus + TaskQueue + ModelRanking + CostOverview
  - 卡点数量提示

- [x] Task 12: 重构 src/app/models/page.tsx 模型监控页
  - 顶部用 ModelRanking 组件（合并后数据）
  - 下方保留按供应商分组（用 raw_models 数据）

## ⚠️ 验证清单（每次部署前必做）

- [ ] 本地 `npm run build` 通过（类型检查+编译）
- [ ] 数据兼容性：用 node 脚本模拟前端读取 stats.json，验证：
  - merged_models 是 array 不是 object
  - 字段名一致（displayName vs name）
  - 数值字段不是 undefined/NaN（用 `|| 0` 保护）
- [ ] 新组件 import 的模块都存在
- [ ] 改了 collector 输出格式时，前端必须同步更新
- [ ] 部署后 30 秒内打开 https://wali-dashboard.vercel.app 验证不崩
