# v4-data-pipeline: 数据管道重构 — SCP → HTTP Push

## 背景
看板数据从本地服务器推送到 Spaceship（junaitools.com），之前用 SCP（SSH 文件传输），延迟 5-6 秒，且依赖 SSH 密钥。

## 方案
改用 HTTP POST 推送 JSON 到 PHP 接收端，无 SSH 依赖，延迟 ~1.5 秒。

### 架构
```
本地 collector (每5分钟) → /tmp/wali-stats.json
stats-pusher (file watch) → curl POST → junaitools.com/wali-api/push.php → stats.json
前端 → fetch stats.json (30s 轮询)
```

### 安全
- PHP 端 token 验证（`?token=wali-push-2026`）
- 验证 JSON 合法性后才写入
- HTTPS 传输加密

## 结果
- SCP 完全禁用（config.json `scp.enabled: false`）
- collector + stats-pusher 都走 HTTP POST
- 延迟从 5-6s 降到 ~1.5s
