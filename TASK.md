# 业务任务清单

## [完成] 看板 v4 重构
- 来源: 搞钱大王 02-18
- 目标: 重构搞钱看板，6 实体模型 + 实时通信 + 任务可视化

## [完成] 数据管道重构
- 来源: 搞钱大王 02-18
- 目标: 去掉 SCP，用 HTTP POST 实现实时数据推送到前端
### 执行记录
- [x] Spaceship PHP 接收端 push.php | 工具: Opus 手动 | token 验证 + JSON 校验
- [x] collector index.js 改用 HTTP POST | 工具: Opus 手动 | pushToRemote() 替代 scpToRemote()
- [x] config.json 新增 push 配置 | 工具: Opus 手动 | scp.enabled: false
- [x] stats-pusher.js 改用 HTTP POST | 工具: Opus 手动 | 延迟从 5-6s 降到 1.5s
- [x] 端到端验证通过 | 工具: Opus 手动 | collector → HTTP push → 前端 fetch 正常

## [活跃] 搬迁系统
- 来源: 搞钱大王 02-18
- 目标: 实现一键搬迁到新机器/新飞书机器人，所有依赖 GitHub 管理
### 执行记录
- [x] Phase 1: 依赖盘点 | 工具: Opus 手动 | 5 skills, collectors, openspec-bg, memory, config 等
- [x] Phase 1: 字节内部分支 | 工具: Opus 手动 | ai_magic → feat/wali-migration 分支
- [x] Phase 1: GitHub Skills 同步 | 工具: Opus 手动 | openclaw-skills 5 个 skill 已脱敏推送
- [x] Phase 1: Workspace 全量备份 | 工具: Opus 手动 | ai_tools → wali-workspace 分支 49 文件
- [x] Phase 1: .gitignore + 敏感信息脱敏 | 工具: Opus 手动 | 排除密钥/临时文件
- [x] Phase 2: 搬迁脚本 3 件套 | 工具: Claude Code + GLM-5 | export.sh(168行) + import.sh(267行) + switch-feishu.sh(212行)
- [x] Phase 2: export.sh 验证通过 | 工具: Opus 手动 | 11KB 加密包，10 个文件，MD5 校验
- [ ] Phase 3: 看板搬迁页面 | 工具: 待派发 Claude Code | 搬迁状态可视化

## [活跃] 飞书 API 优化
- 来源: 搞钱大王 02-18
- 目标: 减少 API 调用量，50000/月限额下生存
### 执行记录
- [x] 关闭 typing indicator（改 typing.ts 源码） | 工具: Opus 手动 | 省 2 次 API/条消息
- [x] 关闭 ackReaction | 工具: config.patch | 省 1 次 API/条消息
- [x] 配置 Webhook 通知 | 工具: Opus 手动 | 主动通知 0 API
- [x] Block streaming + coalesce | 工具: config.patch | 回复合并为 1-2 条
- [x] Collector 群名永久缓存 | 工具: Opus 手动 | 群名查询从 ~864/天降到 ~0
- [ ] 多条消息问题 | 未完成：回复仍然分多条发送

## [完成] 备婚手册 v4
- 来源: 搞钱大王 02-15
- 目标: 尚景庄园备婚手册 + 6 月排期表 + 紫雪 7 条修正

## [完成] PainRadar 后端迁移
- 来源: 搞钱大王 02-17
- 目标: Node.js+MySQL+PHP 代理迁移到 Spaceship

## [完成] 搞钱看板 v3
- 来源: 搞钱大王 02-17
- 目标: 实时数据看板 + 模型统计 + 自动状态推断

## [完成] 备婚管理网站
- 来源: 搞钱大王 02-16
- 目标: wedding-planner Vercel 站点 + 飞书日历同步

## [完成] OpenSpec-bg 工具链
- 来源: 瓦力 02-16
- 目标: Claude Code 后台任务 skill，GLM-5 免费编码
