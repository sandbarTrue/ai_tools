# v4-data-pipeline 子任务

- [x] T1: Spaceship PHP 接收端 — push.php（token 验证 + JSON 校验 + 写入 stats.json）
- [x] T2: collector index.js — 新增 pushToRemote() 函数，用 curl POST 替代 SCP
- [x] T3: config.json — 新增 push 配置，禁用 scp
- [x] T4: stats-pusher.js — 从 SCP 改为 HTTP POST（file watch → curl）
- [x] T5: 端到端验证 — collector → HTTP push → 前端 fetch 正常
- [ ] T6: 清理 Spaceship 上的 SSH authorized_keys（可选，SCP 不再需要）
- [ ] T7: push.php 安全加固 — rate limit + IP 白名单（可选）
