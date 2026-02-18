# migration-scripts: 搬迁脚本

## 背景
瓦力运行在字节内网机器上，需要支持搬迁到新机器或切换飞书机器人。
所有代码已 GitHub 化（Phase 1 完成），现在需要自动化导出/导入。

## 目标
创建 3 个脚本放在 `/root/.openclaw/workspace/scripts/migration/` 下：

### 1. export.sh — 导出当前环境
打包所有敏感配置和本地状态到一个加密压缩包。

导出内容：
- `/root/.openclaw/openclaw.json` — OpenClaw 配置（含飞书密钥）
- `/root/.openspec-config` — OpenSpec 模型配置（含 API Key）
- `/root/anthropic-oauth-proxy.js` — 代理脚本（含 MiniMax Key）
- `/root/.ssh/spaceship_rsa` — SSH 私钥（如果存在）
- crontab 导出
- iptables 规则导出
- Screen 服务列表 + 启动命令
- `/root/.openclaw/workspace/collectors/config.json` — collector 配置
- Git repo 列表和 remote URLs

输出：`/tmp/wali-export-YYYYMMDD.tar.gz.enc`（openssl aes-256-cbc 加密）
同时生成 `/tmp/wali-export-manifest.txt`（内容清单，不加密）

### 2. import.sh — 新机器一键部署
在全新机器上运行，从加密包恢复。

步骤：
1. 安装 Node.js (v24 LTS via nvm)
2. `npm i -g openclaw`
3. 解密并解压导出包
4. 恢复 openclaw.json
5. Clone GitHub repos（openclaw-skills, ai_tools/wali-workspace branch）
6. 恢复 .openspec-config, anthropic-oauth-proxy.js, SSH keys
7. 恢复 crontab, iptables 规则
8. 启动 OpenClaw gateway
9. 启动 screen 服务（stats-pusher 等）
10. 验证：openclaw status, curl localhost:8089

### 3. switch-feishu.sh — 切换飞书 App
只替换飞书相关配置，不动其他。

步骤：
1. 接收参数：新的 appId, appSecret, webhook URL（可选）
2. 备份当前 openclaw.json
3. 用 jq 替换 channels.feishu.appId 和 channels.feishu.appSecret
4. 如果有 webhook URL，更新 feishu-webhook.sh
5. 更新 lark_manager.js 的 APP_ID/APP_SECRET（环境变量方式）
6. 重启 OpenClaw gateway
7. 发送测试消息验证

## 技术约束
- 脚本用 bash 编写，兼容 Ubuntu 20.04+
- 加密用 openssl aes-256-cbc -pbkdf2（用户输入密码）
- 不硬编码任何密钥，从当前环境读取
- import.sh 需要 root 权限
- 所有操作前先备份，失败可回滚
