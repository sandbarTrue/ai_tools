// src/index.js — Express 服务入口
const express = require('express');
const config = require('./config');
const { logToFile } = require('./utils/logger');

const app = express();

// ── 中间件 ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 数据库连接（可选，连接失败不 crash） ────────────────
let db = null;

async function initDB() {
  try {
    const mysql = require('mysql2/promise');
    db = await mysql.createPool({
      host: config.DB_HOST,
      user: config.DB_USER,
      password: config.DB_PASS,
      database: config.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    // 测试连接
    await db.execute('SELECT 1');
    logToFile('Database connected', { host: config.DB_HOST, database: config.DB_NAME }, 'SUCCESS');
  } catch (err) {
    logToFile('Database connection failed (non-fatal)', { error: err.message }, 'WARN');
    db = null;
  }
}

// ── 路由 ────────────────────────────────────────────────
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const payoutRoutes = require('./routes/payout');

app.use(checkoutRoutes);
app.use(webhookRoutes);
app.use(payoutRoutes);

// ── 健康检查 ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: config.environment,
    db: db ? 'connected' : 'disconnected',
    creem_api: config.CREEM_API_BASE_URL,
    wise_api: config.WISE_API_BASE_URL,
    uptime: process.uptime(),
  });
});

// 首页
app.get('/', (req, res) => {
  res.json({
    service: 'ai-tools',
    version: '1.0.0',
    endpoints: {
      checkout: 'POST /api/create-checkout',
      payment_status: 'GET /payment/status/:checkoutId',
      webhook: 'POST /creem/webhook',
      payout_create: 'POST /api/payout/create',
      payout_status: 'GET /api/payout/status/:id',
      payout_balance: 'GET /api/payout/balance',
      payout_recipient: 'POST /api/payout/recipient',
      payout_recipients: 'GET /api/payout/recipients',
      health: 'GET /health',
    },
  });
});

// ── 启动 ────────────────────────────────────────────────
async function start() {
  await initDB();
  app.set('db', db);

  app.listen(config.PORT, () => {
    logToFile(`ai-tools server started`, {
      port: config.PORT,
      env: config.environment,
      creem: config.CREEM_API_BASE_URL,
      wise: config.WISE_API_BASE_URL,
      db: db ? 'connected' : 'no-db',
    }, 'SUCCESS');
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
