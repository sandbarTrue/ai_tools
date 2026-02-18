# ai-tools 独立支付服务 — 创建记录

> 创建时间: 2025-02-15

## 项目位置

`/home/zhoujun.sandbar/workspace/ai-tools`

## 完成内容

### 1. 项目结构（已创建）

```
ai-tools/
├── package.json              # express, axios, dotenv, mysql2
├── .env.example              # 所有配置项模板
├── .gitignore
├── README.md                 # 完整 API 文档
├── src/
│   ├── index.js              # Express 入口，DB 可选连接
│   ├── config.js             # 统一配置，env-based，无硬编码
│   ├── routes/
│   │   ├── checkout.js       # Creem checkout + 支付页面（成功/失败/取消）
│   │   ├── webhook.js        # Creem webhook，写入 DB + 激活 premium
│   │   └── payout.js         # Wise 提现全流程
│   ├── services/
│   │   ├── creem.js          # Creem API 封装 + 签名验证
│   │   ├── wise.js           # Wise API 封装（profile/quote/recipient/transfer/balance）
│   │   └── payment.js        # 支付业务逻辑（DB 写入、状态更新）
│   ├── middleware/
│   │   └── auth.js           # requireAuth + requirePremium
│   ├── db/
│   │   └── schema.sql        # users + payment_records + payout_records
│   └── utils/
│       └── logger.js         # 日志工具（文件 + stdout）
```

### 2. 从 jun-ai-tools 抽取并改进

| 来源 | 改进 |
|------|------|
| payment.js 的 checkout/webhook/状态查询 | 拆分为 checkout.js + webhook.js，职责清晰 |
| paymentPages.js 的支付页面 | 合并到 checkout.js，**修复了 crypto 未导入 bug** |
| config.js 的环境切换 | 全部改为 env-based，移除硬编码测试 key |
| webhook 只记日志 | **新增：写入 payment_records + 激活用户 is_premium** |
| 支付成功页 requireAuth | **改为无需登录**，避免 session 过期看不到结果 |

### 3. 新增：Wise 提现模块

基于 Wise API 文档实现的完整提现流程：

**services/wise.js：**
- `getProfiles()` — 获取 Wise profile
- `getBalances()` — 查询余额（`/v4/profiles/{id}/balances`）
- `createQuote()` — 创建报价（`/v3/profiles/{id}/quotes`）
- `createRecipient()` — 创建收款人（`/v1/accounts`）
- `listRecipients()` — 列出收款人
- `createTransfer()` — 创建转账（`/v1/transfers`）
- `fundTransfer()` — 用余额付款（`/v3/profiles/{id}/transfers/{id}/payments`）
- `getTransfer()` — 查询转账状态

**routes/payout.js API：**
- `POST /api/payout/create` — 一键提现（自动 quote → transfer → fund）
- `GET /api/payout/status/:id` — 查询提现状态（同步更新 DB）
- `GET /api/payout/balance` — 查询 Wise 余额
- `POST /api/payout/recipient` — 创建收款人
- `GET /api/payout/recipients` — 列出收款人

**环境切换：**
- Sandbox: `https://api.sandbox.transferwise.tech`
- Production: `https://api.wise.com`
- 通过 `WISE_SANDBOX=true/false` 控制

### 4. 新增：支付业务逻辑

- `handleCheckoutCompleted()` — webhook checkout.completed 事件处理：
  - 事务性写入 payment_records（幂等，ON DUPLICATE KEY）
  - 更新 users.is_premium = 1
- `handleRefund()` — 退款事件处理
- `recordPayout()` — 提现记录写入
- `updatePayoutStatus()` — 提现状态同步
- `requirePremium()` 中间件 — 检查用户付费状态

### 5. 数据库

3 张表：`users`（含 is_premium）、`payment_records`、`payout_records`
- 数据库连接失败时服务仍可启动（non-fatal）
- 所有 DB 操作都有 null 检查，不会因为没有数据库而 crash

### 6. 验证

✅ `npm install` — 0 vulnerabilities
✅ `npm start` — 服务正常启动（端口 3001）
✅ 数据库未连接时不 crash，输出友好警告
✅ 健康检查 `/health` 返回环境、数据库、API 端点信息

## 下一步 TODO

- [ ] 在 `.env` 中填入真实的 Creem 生产 API Key 和 Product ID
- [ ] 在 `.env` 中填入 Wise API Token 和 Profile ID
- [ ] 执行 `schema.sql` 初始化数据库
- [ ] 配置 Creem Webhook URL 为 `https://junaitools.com/creem/webhook`
- [ ] 替换 auth.js 中的 placeholder 逻辑为真实的 JWT/session 验证
- [ ] 测试完整提现流程：创建收款人 → 发起提现 → 查询状态
