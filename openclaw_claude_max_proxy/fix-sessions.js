#!/usr/bin/env node
/*
  Fix OpenClaw session routing so Feishu sessions won't stick to provider=anthropic.

  - Rewrites modelProvider/provider "anthropic" -> "anthropic-oauth-proxy" for feishu sessions
  - Rewrites authProfileOverride "anthropic:*" -> "anthropic-oauth-proxy:*" (or deletes if unsafe)
  - Creates a timestamped backup
*/

const fs = require('fs');
const os = require('os');
const path = require('path');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const sessionsPath = process.env.OPENCLAW_SESSIONS_PATH || path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
if (!fs.existsSync(sessionsPath)) {
  console.error(`sessions.json not found: ${sessionsPath}`);
  process.exit(0);
}

const raw = fs.readFileSync(sessionsPath, 'utf8');
const sessions = JSON.parse(raw);

const backupPath = `${sessionsPath}.bak.${nowStamp()}`;
fs.copyFileSync(sessionsPath, backupPath);

let changed = 0;
for (const [key, s] of Object.entries(sessions)) {
  const isFeishu = key.includes(':feishu:') || s?.deliveryContext?.channel === 'feishu' || s?.origin?.provider === 'feishu';
  if (!isFeishu) continue;

  if (s.modelProvider === 'anthropic') {
    s.modelProvider = 'anthropic-oauth-proxy';
    changed++;
  }
  if (s.systemPromptReport && s.systemPromptReport.provider === 'anthropic') {
    s.systemPromptReport.provider = 'anthropic-oauth-proxy';
    changed++;
  }

  if (typeof s.authProfileOverride === 'string' && s.authProfileOverride.startsWith('anthropic:')) {
    s.authProfileOverride = s.authProfileOverride.replace(/^anthropic:/, 'anthropic-oauth-proxy:');
    changed++;
  }
}

if (!changed) {
  console.log('No session changes needed.');
  console.log(`Backup: ${backupPath}`);
  process.exit(0);
}

fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2) + '\n');
console.log(`OK: updated ${changed} field(s) in ${sessionsPath}`);
console.log(`Backup: ${backupPath}`);

