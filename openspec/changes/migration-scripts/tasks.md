# migration-scripts 子任务

## export.sh
- [ ] T1: 创建 `scripts/migration/export.sh`，收集所有配置文件到临时目录
- [ ] T2: 导出 crontab (`crontab -l`) 和 iptables (`iptables-save`) 到文件
- [ ] T3: 记录 screen 服务列表和启动命令到 `services.sh`
- [ ] T4: 记录所有 git repo 路径和 remote URL 到 `repos.txt`
- [ ] T5: 打包 + openssl aes-256-cbc 加密，生成 manifest

## import.sh
- [ ] T6: 创建 `scripts/migration/import.sh`，接收加密包路径和密码
- [ ] T7: 安装 Node.js v24 (nvm) + openclaw (npm)
- [ ] T8: 解密解压，恢复 openclaw.json, .openspec-config, proxy, SSH keys
- [ ] T9: Clone GitHub repos (openclaw-skills, ai_tools wali-workspace branch)
- [ ] T10: 恢复 crontab + iptables + 启动 screen 服务
- [ ] T11: 启动 OpenClaw gateway + 验证

## switch-feishu.sh
- [ ] T12: 创建 `scripts/migration/switch-feishu.sh`，接收 appId/appSecret 参数
- [ ] T13: 用 jq 替换 openclaw.json 飞书配置，备份原文件
- [ ] T14: 更新环境变量 FEISHU_APP_ID/FEISHU_APP_SECRET
- [ ] T15: 重启 OpenClaw + 发送测试消息验证
