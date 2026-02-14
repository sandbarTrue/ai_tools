#!/usr/bin/env node
/*
  Patch ~/.openclaw/openclaw.json to add anthropic-oauth-proxy provider and
  set default model to anthropic-oauth-proxy/claude-opus-4-6.

  Safe behavior:
  - Creates a timestamped .bak file next to the config.
  - Only touches model/provider fields.
*/

const fs = require('fs');
const os = require('os');
const path = require('path');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

const cfgPath = process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), '.openclaw', 'openclaw.json');
if (!fs.existsSync(cfgPath)) {
  console.error(`OpenClaw config not found: ${cfgPath}`);
  console.error('Run `openclaw setup` once, or set OPENCLAW_CONFIG_PATH.');
  process.exit(1);
}

const cfg = readJson(cfgPath);
const backupPath = `${cfgPath}.bak.${nowStamp()}`;
fs.copyFileSync(cfgPath, backupPath);

cfg.models = cfg.models || {};
cfg.models.providers = cfg.models.providers || {};

cfg.models.providers['anthropic-oauth-proxy'] = cfg.models.providers['anthropic-oauth-proxy'] || {
  baseUrl: 'http://127.0.0.1:8089',
  apiKey: 'proxy',
  api: 'anthropic-messages',
  models: []
};

// Always set/refresh baseUrl so it matches local proxy.
cfg.models.providers['anthropic-oauth-proxy'].baseUrl = 'http://127.0.0.1:8089';
cfg.models.providers['anthropic-oauth-proxy'].api = 'anthropic-messages';
cfg.models.providers['anthropic-oauth-proxy'].apiKey = cfg.models.providers['anthropic-oauth-proxy'].apiKey || 'proxy';

const defaultModels = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6 (OAuth Proxy)',
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 16000
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5 (OAuth Proxy)',
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 16000
  }
];

const byId = new Map((cfg.models.providers['anthropic-oauth-proxy'].models || []).map(m => [m.id, m]));
for (const m of defaultModels) {
  byId.set(m.id, { ...byId.get(m.id), ...m });
}
cfg.models.providers['anthropic-oauth-proxy'].models = Array.from(byId.values());

cfg.agents = cfg.agents || {};
cfg.agents.defaults = cfg.agents.defaults || {};
cfg.agents.defaults.model = cfg.agents.defaults.model || {};

const primary = process.env.OPENCLAW_PRIMARY_MODEL || 'anthropic-oauth-proxy/claude-opus-4-6';
cfg.agents.defaults.model.primary = primary;

cfg.agents.defaults.models = cfg.agents.defaults.models || {};
cfg.agents.defaults.models[primary] = cfg.agents.defaults.models[primary] || {};

writeJson(cfgPath, cfg);
console.log(`OK: patched ${cfgPath}`);
console.log(`Backup: ${backupPath}`);

