#!/usr/bin/env node
/**
 * 飞书群聊监控脚本
 * 
 * 通过 OpenClaw browser CDP 连接监控飞书群聊页面变化。
 * 当检测到新消息时，写入状态文件供主 agent 读取。
 * 
 * 运行方式: node scripts/feishu-chat-monitor.js
 * 需要: 浏览器已启动且已登录飞书，并且在群聊页面
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'memory', 'feishu-chat-state.json');
const CHECK_INTERVAL = 10000; // 10秒

// 读取状态
function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastMessagePreview: '', lastChecked: null, newMessages: [] };
  }
}

// 写入状态
function writeState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// 主逻辑说明:
// 这个脚本需要配合 OpenClaw 的 browser tool 使用
// 实际运行时，通过 cron systemEvent 触发 agent 检查
// agent 读取 STATE_FILE 判断是否有新消息

console.log('飞书群聊监控 - 状态文件方案');
console.log('状态文件:', STATE_FILE);
console.log('检查间隔:', CHECK_INTERVAL, 'ms');
console.log('');
console.log('此脚本仅作为状态管理工具。');
console.log('实际监控由 cron + agent 的 browser tool 完成。');

// 初始化状态文件
const state = readState();
if (!state.lastChecked) {
  state.lastChecked = new Date().toISOString();
  state.lastMessagePreview = '';
  state.newMessages = [];
  state.needsResponse = false;
  writeState(state);
  console.log('状态文件已初始化:', STATE_FILE);
}
