// src/utils/logger.js — 日志工具
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// 确保日志目录存在
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}

/**
 * 写日志到文件 + stdout
 * @param {string} message
 * @param {object} [data]
 * @param {'INFO'|'ERROR'|'SUCCESS'|'WARN'} [level]
 */
function logToFile(message, data = {}, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, ...data };
  const line = JSON.stringify(entry);

  // stdout
  const prefix = { INFO: 'ℹ️', ERROR: '❌', SUCCESS: '✅', WARN: '⚠️' }[level] || 'ℹ️';
  console.log(`${prefix}  [${timestamp}] ${message}`, Object.keys(data).length ? data : '');

  // 文件
  const dateStr = timestamp.slice(0, 10);
  const logFile = path.join(LOG_DIR, `${dateStr}.log`);
  try { fs.appendFileSync(logFile, line + '\n'); } catch (_) {}
}

module.exports = { logToFile };
