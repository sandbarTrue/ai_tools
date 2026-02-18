# ai-tools

独立支付 + 提现服务，基于 **Creem** 收款和 **Wise** 提现。

## 快速开始

```bash
cp .env.example .env   # 编辑填入真实 key
npm install
npm start              # 默认 localhost:3001
```

## API 端点

### Creem 支付

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/create-checkout` | 创建 Checkout 会话 | ✅ |
| GET | `/payment/status/:checkoutId` | 查询支付状态 | ✅ |
| POST | `/creem/webhook` | Webhook 回调 | ✗ |
| GET | `/testPay` | 支付测试页面 | ✗ |
| GET | `/payment/success` | 支付成功页 | ✗ |
| GET | `/payment/cancel` | 支付取消页 | ✗ |
| GET | `/payment/failed` | 支付失败页 | ✗ |

### Wise 提现

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/payout/create` | 发起提现 | ✅ |
| GET | `/api/payout/status/:id` | 查询提现状态 | ✅ |
| GET | `/api/payout/balance` | 查询 Wise 余额 | ✅ |
| POST | `/api/payout/recipient` | 创建收款人 | ✅ |
| GET | `/api/payout/recipients` | 列出收款人 | ✅ |

### 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/` | 服务信息 |

## 提现流程

```
1. 创建收款人  POST /api/payout/recipient
2. 发起提现    POST /api/payout/create { amount, recipientId }
   → 内部：createQuote → createTransfer → fundTransfer
3. 查询状态    GET /api/payout/status/:transferId
```

## 环境配置

- **测试模式**（默认）：Creem 用 `test-api.creem.io`，Wise 用 sandbox
- **生产模式**：`NODE_ENV=production` 自动切换

## 数据库

```bash
mysql -u root < src/db/schema.sql
```

表：`users`、`payment_records`、`payout_records`

> 数据库未连接时服务仍可启动，但支付记录和提现记录不会持久化。
