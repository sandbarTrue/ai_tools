# junaitools.com 项目架构分析

> 更新时间: 2025-02-15

## 1. 项目概况

| 属性 | 值 |
|------|-----|
| 项目名 | jun-ai-tools |
| 框架 | Express.js (Node.js) |
| 模块系统 | CommonJS |
| 版本 | 1.0.0 |
| 作者 | 周军 |
| 部署路径 | `/home/zhoujun.sandbar/workspace/jun-ai-tools/` |
| 数据库 | MySQL (InnoDB, utf8mb4) |
| 域名 | junaitools.com |
| 生产日志 | `/home/ztshkzhkyl/log/app-YYYY-MM-DD.log` |

---

## 2. 功能模块

### 核心产品

```
junaitools.com
├── 📝 MLA 引文生成器 (/mla)          ← 主要产品
│     支持 Book / Website / Journal
│     本地即时生成 + 后端 API 生成
│     MLA 9 格式，支持多作者
│
├── 🧠 AI 心理咨询师 (/counselor)      ← 多个变体
│     ├── 默认版 (/counselor)
│     ├── 兔子版 (/bunny-counselor)
│     ├── 真实美女版 (/real-counselor)
│     ├── 超逼真版 (/realistic-counselor)
│     ├── 代码版 (/code-counselor)
│     ├── 2D版 (/2d-counselor)
│     ├── 简化虚拟版 (/simple-counselor)
│     └── 3D虚拟版 (/virtual-counselor)
│
├── 🤖 LLM API 代理 (/api/v1/chat/completions)
│     Gemini API 转发，对外提供 OpenAI 风格接口
│
├── 💳 支付系统 (/testPay)
│     Creem 支付网关，$4.49 一次性付款
│
└── 🔗 AV导航 (/av)
      成人网站导航页面
```

### 基础设施

```
├── 🔐 认证系统
│     ├── Google OAuth 登录 (/auth/google)
│     ├── 本地账号注册/登录 (/register, /login)
│     ├── 密码重置 (/forgot, /reset-password)
│     └── Session + Cookie 认证中间件
│
├── 👤 用户管理
│     ├── 用户表 (users)
│     ├── 会话表 (user_sessions)
│     └── 密码重置表 (password_resets)
│
├── 📊 管理后台
│     ├── 管理员面板 (/admin)
│     ├── 活动日志 (/activity-logs)
│     ├── 页面统计 (/page-stats)
│     └── 管理员权限中间件 (requireAdmin)
│
├── 🌐 国际化 (i18n)
│     ├── 前端 i18n.js 语言切换
│     └── 测试页面 (/test-i18n)
│
├── 📄 法律页面
│     ├── 服务条款 (/terms, /mla/terms)
│     ├── 隐私政策 (/privacy, /mla/privacy)
│     └── 定价页 (/mla/pricing)
│
└── 📝 日志系统
      ├── 按日期分割日志文件
      ├── 活动日志中间件 (activityLogger)
      └── API 使用记录表 (api_usage_logs)
```

---

## 3. 技术架构

### 目录结构

```
jun-ai-tools/
├── server.js                    # 主入口，Express 应用
├── package.json
├── .env / .env.production       # 环境配置
├── public/                      # 前端静态文件
│   ├── index.html               # 首页/导航
│   ├── mla.html                 # MLA 引文生成器
│   ├── login.html / register.html
│   ├── counselor.html           # AI 咨询师 (多个变体)
│   ├── bunny-counselor.html
│   ├── real-counselor.html
│   ├── realistic-counselor.html
│   ├── code-counselor.html
│   ├── 2d-counselor.html
│   ├── simple-counselor.html
│   ├── virtual-counselor.html
│   ├── av.html                  # AV 导航
│   ├── admin.html               # 管理后台
│   ├── activity-logs.html       # 活动日志
│   ├── page-stats.html          # 页面统计
│   ├── payment-test.html        # 支付测试
│   ├── api-docs.html            # API 文档
│   ├── api-test.html            # API 测试
│   ├── terms.html / privacy.html / pricing.html
│   ├── forgot.html / reset-password.html / google-error.html
│   ├── test-i18n.html
│   ├── styles.css / script.js
│   ├── config.js / i18n.js / language-switcher.js
│   └── (共 30 个文件)
└── src/
    ├── config.js                # 配置管理（环境切换）
    ├── citation.js              # MLA 引文生成核心逻辑
    ├── logger.js                # 日志工具
    ├── database/
    │   ├── config.js            # 数据库连接配置
    │   ├── init.js              # 数据库初始化
    │   └── schema.sql           # 表结构定义
    ├── middleware/
    │   ├── auth.js              # 认证中间件 (requireAuth, optionalAuth)
    │   ├── adminAuth.js         # 管理员认证 (requireAdmin)
    │   └── activityLogger.js    # 活动日志中间件
    ├── routes/
    │   ├── pages.js             # 页面路由（20+ 路由）
    │   ├── api.js               # 业务 API（引文生成等）
    │   ├── auth.js              # Google OAuth 路由
    │   ├── userAuth.js          # 本地认证 API
    │   ├── counselor.js         # AI 咨询师 API
    │   ├── llmApi.js            # LLM API 代理
    │   ├── payment.js           # 支付 API
    │   ├── paymentPages.js      # 支付页面
    │   └── admin.js             # 管理员 API
    ├── auth/                    # 认证辅助
    ├── models/                  # 数据模型
    ├── services/                # 服务层
    │   └── geminiService.js     # Gemini API 服务
    └── docs/                    # 文档
```

### 数据库表

| 表名 | 用途 |
|------|------|
| `users` | 用户信息 (Google OAuth + 本地注册) |
| `user_sessions` | 登录会话管理 |
| `password_resets` | 密码重置令牌 |
| `counselor_conversations` | AI 咨询对话记录 |
| `citation_records` | 引文生成记录 |
| `payment_records` | 支付记录 |
| `user_activity_logs` | 用户活动日志 |
| `api_usage_logs` | API 调用记录 |

数据库名: `ztshkzhkyl_jun_ai_tools`

### 依赖

关键依赖包括：
- `express`, `cors`, `cookie-parser`, `express-session`
- `axios` (HTTP 请求)
- `@google/generative-ai` (Gemini API)
- `bcryptjs` (密码哈希)
- `dotenv` (环境变量)
- `mysql2` (数据库连接, 从 schema 推断)
- `nodemon` (开发热重载)

### 外部 API

| 服务 | 用途 | Key 来源 |
|------|------|---------|
| Google OAuth | 用户登录 | 环境变量 |
| Gemini API | AI 咨询师 + LLM 代理 | 硬编码/环境变量 |
| Creem | 支付网关 | 硬编码/环境变量 |

---

## 4. 路由完整列表

### 公开路由（无需登录）

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 首页导航 |
| `/login` | GET | 登录页 |
| `/register` | GET | 注册页 |
| `/forgot` | GET | 忘记密码 |
| `/reset-password` | GET | 重置密码 |
| `/google-error` | GET | Google 登录错误 |
| `/auth/google` | GET | Google OAuth 入口 |
| `/api/auth/*` | - | 本地认证 API |
| `/hello` | GET | 健康检查 |
| `/test-i18n` | GET | i18n 测试 |
| `/terms`, `/privacy` | GET | 法律页面 |
| `/api-docs`, `/api-test` | GET | API 文档和测试 |
| `/creem/webhook` | POST | 支付 Webhook |
| `/api/v1/chat/completions` | POST | LLM API (开放) |

### 需要登录

| 路由 | 说明 |
|------|------|
| `/mla` | MLA 引文生成器 |
| `/counselor`, `/bunny-counselor`, `/real-counselor` 等 | AI 咨询师 |
| `/av` | AV 导航 |
| `/testPay` | 支付页 |
| `/payment/*` | 支付相关 |
| `/mla/terms`, `/mla/privacy`, `/mla/pricing` | 法律页 (MLA 子路径) |

### 需要管理员

| 路由 | 说明 |
|------|------|
| `/admin` | 管理面板 |
| `/activity-logs` | 活动日志 |
| `/page-stats` | 页面统计 |

---

## 5. 搞钱相关分析

### 当前变现方式
- **Citation Generator Pro** — $4.49 一次性付款（Creem，测试模式）

### 潜在变现机会

1. **AI 咨询师** — 已有 7 个变体，是最有变现潜力的功能
   - 可按次收费或订阅制
   - 不同风格的咨询师可作为不同产品定价

2. **LLM API 代理** — 已有 OpenAI 兼容接口
   - 可按 token 计费
   - 已有 api_usage_logs 追踪

3. **引文生成器** — 已有付费墙设计
   - 免费/Pro 分层已设计
   - 需要完善权限检查逻辑

### 待改进

- 付费后实际权限解锁逻辑未实现
- 没有用户付费状态字段
- 咨询师功能免费开放，无付费墙
- API 无限制调用，无 rate limiting
