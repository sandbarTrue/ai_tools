# 瓦力搬迁指南

## 文件清单

| 脚本 | 用途 | 在哪跑 |
|------|------|--------|
| `export.sh` | 导出所有配置/密钥/状态 | 旧机器 |
| `import.sh` | 一键部署新环境 | 新机器 |
| `switch-feishu.sh` | 只换飞书 App（解决 API 额度） | 当前机器 |
| `shutdown.sh` | 停止旧机器所有服务 | 旧机器 |

---

## 场景 A：只换飞书机器人（最快，解决 API 额度）

**前提**：搞钱大王已注册好新的飞书 App，拿到 appId 和 appSecret

```bash
# 一行搞定
bash scripts/migration/switch-feishu.sh \
  --app-id cli_新的appId \
  --app-secret 新的appSecret
```

脚本会自动：备份旧配置 → 替换 appId/Secret → 重启 OpenClaw → 发测试消息验证

---

## 场景 B：整机搬迁

### 第 1 步：旧机器导出（2 分钟）

```bash
bash scripts/migration/export.sh
# 输入加密密码（记住它！）
# → 生成 /tmp/wali-export-YYYYMMDD-HHMMSS.tar.gz.enc
```

### 第 2 步：传包到新机器

```bash
scp /tmp/wali-export-*.tar.gz.enc user@新机器:/tmp/
```

### 第 3 步：新机器部署（5 分钟）

```bash
# 先把 import.sh 传过去（或从 GitHub 下载）
git clone -b wali-workspace git@github.com:sandbarTrue/ai_tools.git /tmp/wali-ws
bash /tmp/wali-ws/scripts/migration/import.sh /tmp/wali-export-*.tar.gz.enc
```

### 第 4 步：配置飞书回调

二选一：
- **同一个 App**：去飞书开放平台 → 事件订阅 → 改 Request URL 为新机器地址
- **新建 App**：`bash switch-feishu.sh --app-id xxx --app-secret xxx`

### 第 5 步：验证新机器

```bash
openclaw status          # 看 gateway 是否运行
curl localhost:8089      # 看 proxy 是否正常
screen -ls               # 看 screen 服务是否启动
```

### 第 6 步：停旧机器

```bash
bash scripts/migration/shutdown.sh
```

---

## 导出包内容

| 文件 | 说明 |
|------|------|
| `config/openclaw.json` | OpenClaw 配置（含飞书密钥） |
| `config/.openspec-config` | 模型配置（含 API Key） |
| `scripts/anthropic-oauth-proxy.js` | 代理脚本（含 MiniMax Key） |
| `ssh/spaceship_rsa` | SSH 私钥 |
| `collectors/config.json` | Collector 配置 |
| `crontab.txt` | 定时任务 |
| `iptables.rules` | 防火墙规则 |
| `services.sh` | Screen 服务重建脚本 |
| `repos.txt` | Git 仓库列表 |
| `manifest.txt` | 文件清单 + MD5 校验 |

## GitHub 仓库

| 仓库 | 内容 |
|------|------|
| `sandbarTrue/openclaw-skills` | 5 个 Skill（脱敏） |
| `sandbarTrue/ai_tools` (wali-workspace 分支) | Workspace 全量（memory/collectors/docs） |
| `sandbarTrue/ai_tools` (main 分支) | Dashboard 前端 |
| `code.byted.org:zhoujun.sandbar/ai_magic` (feat/wali-migration) | OpenSpec-bg 原始版 |
