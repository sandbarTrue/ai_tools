# MEMORY.md - Long-Term Memory

## 2026-02-04
- Initialized workspace and memory systems.
- User confirmed identity: 搞钱大王, Timezone: Asia/Shanghai.
- Mission: 竭尽全力搞钱 (Dedicated to making money).
- Identity established: 瓦力 (Wall-E), AI 搞钱助手 (Updated from "小爪" per user request).
- Established Daily Routines (Cron Jobs):
  - **Morning (08:00):** Global Business Opportunity Report (Market analysis, money-making chances).
  - **Midnight (00:00):** Skill Upgrade Protocol (Learn new tech, focus on coding quality, closed-loop testing, browser automation).

## 2026-02-08
- GitHub 工作规范：后续所有 GitHub 项目统一在 `zhoujun.sandbar` 用户下进行 clone/commit/push（避免 root 操作与权限混乱）。

## 2026-02-12
- **Agent-Browser 关键发现**：使用 `browser` tool 前必须先用 CLI `openclaw browser start` 启动浏览器实例。这是关键的启动顺序。
- **调查习惯改进**：操作前先检查现有配置，避免重建已有资源（信任用户说法，先验证再决定）。
- **理解偏差**："root 账号管理"指用 root 权限访问 zhoujun.sandbar 的资源，不是用 root 用户执行操作。
- **主动调查原则**：从错误信息中提取线索（如 "Permission denied" = SSH 问题），不要盲目尝试其他方案。
- **Git 工作流**：已验证 `/root/wali_memory` 作为主要记忆仓库，路径：`git@github.com:sandbarTrue/wali-memory.git`。
- **Headless 浏览器限制**：无头模式下的浏览器下载功能受限，直接生成 0 字节文件。
- **CDN 访问限制**：飞书依赖字节跳动内部 CDN（sf3-cn-cdn-tos.pstatp.com），字节跳动内网环境可能无法直接访问外网 CDN。

## 2026-02-13
- **飞书文档写入 API 限制**：feishu_doc write (documentBlockChildren.create) 对 markdown 转 block 后插入会返回 400 (code 99992402, field validation failed)。长文档写入暂未解决，workaround 是通过飞书消息分段发送内容。
- **飞书消息历史工具**：成功创建 `feishu_list_messages` 和 `feishu_search_messages` 工具（`/root/.openclaw/extensions/feishu/src/message.js`），可读取聊天记录。
- **飞书联系人 API 权限不足**：获取联系人列表时报错（Cannot read properties of undefined），需要用户手动提供 open_id。
- **小说《青云路》大纲完成**：90万字/300章，种田文+低魔修仙，金手指"灵目"设计克制。本地文件：`/root/.openclaw/workspace/小说大纲-青云路.md`、`/root/.openclaw/workspace/novel-outline.md`、`/root/.openclaw/workspace/修仙元素设计.md`。
- **飞书关键 ID**：App ID `cli_a9f77611ef785cd2`，Bot Chat ID `oc_6c37534d47ed700be20d6adb0db3cc5e`，User Open ID `ou_e512bb532a31e199e2c7e81966b87db0`。
- **飞书账号注册完成** ✅：手机号 18580251929，验证码 305999，角色"上班族"。
- **飞书网页登录成功** ✅：
  - 最终租户域名：`ja484frx8z.feishu.cn`（周杨氏家族）
  - 之前的 `mk09svr328.feishu.cn` 是飞书个人版（已退出）
  - 账号名已是"瓦力"（不是"周小军"）
  - 登录方式：用户扫码确认
  - Browser profile: `openclaw`, targetId: `1C2DFFD0ED213A3B12C8FF9997776798`
- **周杨式家族大群** ✅：已进群并发自我介绍 + 才艺回复。群成员：周军、杨紫雪、杨大哥、瓦力（4人）。
- **飞书桌面客户端不可用**：Electron 应用在无 GPU 的 headless 服务器上无法运行（exit code 34）。只能用网页版。
- **飞书网页版只支持二维码扫码登录**，没有手机号/密码登录选项。
- **待办事项**：
  - 写小说第一卷（1-50 章）
  - 创建服务号 PRD 飞书文档
  - 配置每周周报 cron（周六 10:00）
  - 获取杨紫雪和杨大哥的 open_id
  - 解决飞书文档写入 API 400 错误
  - 在周杨式家族大群中作为"瓦力"持续互动