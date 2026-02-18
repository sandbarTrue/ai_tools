# 搬迁系统 Proposal

## 背景
瓦力当前运行在字节内网机器上，飞书 API 月限额 50000 次不够用。需要支持：
1. **飞书机器人搬迁** — 换一个飞书 App（新的 50000 额度）
2. **整机搬迁** — 搬到另一台机器上

## 现状盘点

### 需要搬迁的组件
| 组件 | 当前位置 | 是否在 GitHub | 搬迁方式 |
|------|---------|--------------|---------|
| OpenClaw 核心 | npm 全局安装 | ✅ 公开 | `npm i -g openclaw` |
| openclaw.json | `/root/.openclaw/openclaw.json` | ❌ | 需导出（含密钥） |
| 飞书插件 | `/root/.openclaw/extensions/feishu/` | ✅ npm | `openclaw plugin install` |
| Skills（5个） | `/root/.openclaw/workspace/skills/` | ⚠️ 部分在 sandbarTrue/openclaw-skills | 需全部上 GitHub |
| openspec-bg | `/root/ai_magic/openspec-bg/` | ⚠️ 只在字节内部 code.byted.org | 需同步到 GitHub |
| Collectors | `/root/.openclaw/workspace/collectors/` | ❌ | 需上 GitHub |
| Memory | `/root/.openclaw/workspace/memory/` + MEMORY.md | ⚠️ sandbarTrue/wali-memory | 需完善 |
| TASK.md/SOUL.md/USER.md | workspace 根目录 | ⚠️ 在 wali-memory | 需确认 |
| oauth-proxy | `/root/anthropic-oauth-proxy.js` | ⚠️ 在 openclaw_claude_max_proxy | ✅ |
| Dashboard | `/home/zhoujun.sandbar/workspace/wali-dashboard/` | ✅ sandbarTrue/wali-dashboard | ✅ |
| SSH keys | `/root/.ssh/spaceship_rsa` | ❌ | 手动迁移 |
| Cron jobs | crontab | ❌ | 需导出 |
| iptables 规则 | `@reboot` crontab | ❌ | 需导出 |
| Screen 服务 | stats-pusher, painradar, wali-api | ❌ | 需 systemd 化或脚本化 |
| .openspec-config | API keys | ❌ | 需导出（含密钥） |

### 两种搬迁场景

#### 场景 A：只换飞书机器人
- 创建新的飞书 App（新的 appId/appSecret）
- 更新 openclaw.json 的 feishu 配置
- Webhook URL 不变（同一台机器）
- **不需要搬代码/数据**

#### 场景 B：整机搬迁
- 新机器安装 OpenClaw + Node.js
- 从 GitHub clone 所有组件
- 导入配置（openclaw.json, .openspec-config, crontab）
- 恢复 memory
- 配置飞书机器人指向新机器

## 搞钱大王的要求
1. **所有依赖用 GitHub 管理** — skills, openspec-bg, collectors 都要有 repo
2. **openspec-bg 双轨提交** — 先提交字节内部 codebase（MR），再同步 GitHub（脱敏）
3. **管理系统自动搬迁** — 一键搬迁，包括停止旧机器

## 实施计划

### Phase 1: GitHub 化（先做）
1. 整理 `sandbarTrue/openclaw-skills` — 补全 5 个 skill
2. openspec-bg 提交字节 MR + GitHub 同步
3. 新建 `sandbarTrue/wali-collectors` — collectors + config
4. 完善 `sandbarTrue/wali-memory` — workspace 文件

### Phase 2: 搬迁脚本
1. `export.sh` — 导出配置、密钥、cron、memory
2. `import.sh` — 在新机器上一键安装 + 恢复
3. `switch-feishu.sh` — 只切换飞书 App 配置

### Phase 3: 管理看板集成
1. 看板增加"搬迁"页面
2. 显示搬迁状态（哪些组件已同步/未同步）
3. 一键触发搬迁
