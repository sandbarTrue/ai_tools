# PainRadar v4 完成 - 2026-02-16

## 架构（最终版）
- **服务器常驻服务**：`screen -S painradar` 运行 `/root/.openclaw/workspace/painradar-server.js`
  - HTTP API: localhost:3847 (GET /status, POST /trigger, GET /result)
  - 全量分析：130 条数据 → GLM-4-Flash → 18 个商机（~2 分钟）
  - 分析完成后自动 git push + vercel deploy
  - ZHIPU_API_KEY 通过 env 传入

- **Vercel 前端**：https://painradar.vercel.app
  - 首次加载：读 `/data/latest.json`（静态预生成文件）
  - 手动刷新：前端调 `/api/trigger` 抓数据 → 分批调 `/api/analyze` → 前端组装
  - 双模式：预生成优先，手动刷新做 fallback

- **每日 Cron**：9:00 AM 自动触发服务器分析（cron id: 7df8583f-f4be-466a-9669-1847d84d605d）

## 关键修复
- GLM 返回 JSON 可能是裸数组 `[{...}]` 而非 `{"items":[{...}]}`，解析器要兼容两种格式
- `.gitignore` 中 `data/` 会挡 `public/data/`，需要 `!public/data/` 排除
- GLM-5 推理模型在 Vercel 60s 限制下不可用（50-90s），用 GLM-4-Flash
- Node 24 内置 fetch，服务器脚本不需要 require('node-fetch')
- http.createServer 的 res 没有 .status().json() 方法（不是 Express），用原生 writeHead + end

## 文件位置
- 服务器脚本：`/root/.openclaw/workspace/painradar-server.js`
- 数据目录：`/root/.openclaw/workspace/painradar-data/`
- debug 响应：`/root/.openclaw/workspace/painradar-data/debug-response.txt`
- 项目目录：`/home/zhoujun.sandbar/workspace/painradar/`
- 最新 commit：`c291e6d` (v4.1)
