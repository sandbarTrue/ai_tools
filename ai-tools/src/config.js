// src/config.js — 统一配置（env-based）
require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

// ── Creem ───────────────────────────────────────────────
const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID;
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;
const CREEM_API_BASE_URL = isProduction
  ? 'https://api.creem.io'
  : 'https://test-api.creem.io';

// ── Wise ────────────────────────────────────────────────
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;
const WISE_SANDBOX = process.env.WISE_SANDBOX !== 'false'; // default true
const WISE_API_BASE_URL = WISE_SANDBOX
  ? 'https://api.sandbox.transferwise.tech'
  : 'https://api.wise.com';

// ── Database ────────────────────────────────────────────
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'ai_tools';

// ── App ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3001;
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

module.exports = {
  environment,
  isProduction,
  // Creem
  CREEM_API_KEY,
  CREEM_PRODUCT_ID,
  CREEM_WEBHOOK_SECRET,
  CREEM_API_BASE_URL,
  // Wise
  WISE_API_TOKEN,
  WISE_PROFILE_ID,
  WISE_SANDBOX,
  WISE_API_BASE_URL,
  // Database
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  // App
  PORT,
  APP_URL,
};
