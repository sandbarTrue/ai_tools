/**
 * OpenClaw Sessions Provider
 *
 * Scans OpenClaw session JSONL files to collect model usage data.
 * Implements incremental scanning with file offset tracking.
 *
 * @module collectors/providers/openclaw-sessions
 */

const fs = require('fs');
const path = require('path');

/**
 * Get time ranges for today/week/month/fiveHour windows
 * All times are calculated in UTC+8 timezone
 * @returns {Object} Time range timestamps
 */
function getTimeRanges() {
  const now = new Date();
  const utcOffset = 8 * 60 * 60 * 1000;

  // Today: start of day in UTC+8
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayUTC = new Date(todayStart.getTime() - utcOffset);

  // Week: Monday start (UTC+8)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  const weekUTC = new Date(weekStart.getTime() - utcOffset);

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthUTC = new Date(monthStart.getTime() - utcOffset);

  // 5-hour window (Claude Max usage window)
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  return {
    today: todayUTC.getTime(),
    week: weekUTC.getTime(),
    month: monthUTC.getTime(),
    fiveHour: fiveHoursAgo.getTime(),
  };
}

/**
 * Get cost rate for a model key
 * @param {string} modelKey - The model identifier (provider/model)
 * @param {Object} costRates - Cost rates configuration
 * @returns {Object} Cost rate with input and output prices per 1K tokens
 */
function getCostRate(modelKey, costRates) {
  if (costRates[modelKey]) return costRates[modelKey];

  // Try partial match
  for (const [key, rate] of Object.entries(costRates)) {
    if (modelKey.includes(key) || key.includes(modelKey)) return rate;
  }

  // If it contains 'opus' or 'claude', assume paid
  if (modelKey.toLowerCase().includes('opus') || modelKey.toLowerCase().includes('claude')) {
    return { input: 0.015, output: 0.075 };
  }

  return { input: 0, output: 0 };
}

/**
 * Create a new model usage entry
 * @returns {Object} Empty model usage object
 */
function createModelEntry() {
  return {
    calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cost: 0,
    today: { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 },
    week: { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 },
    month: { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 },
    fiveHour: { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 },
  };
}

/**
 * OpenClaw Sessions Provider implementation
 */
const openclawSessionsProvider = {
  name: 'openclaw-sessions',

  /**
   * Collect model usage data from OpenClaw session JSONL files
   * @param {Object} config - Collector configuration
   * @returns {Promise<Object>} Model usage map
   */
  async collectModelUsage(config) {
    const { paths, costRates } = config;
    const sessionsDir = paths.sessionsDir;
    const models = {};
    const timeRanges = getTimeRanges();

    let files;
    try {
      files = fs.readdirSync(sessionsDir).filter(f => f.includes('.jsonl'));
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [openclaw-sessions] Cannot read sessions directory: ${e.message}`);
      return models;
    }

    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      let currentProvider = null;
      let currentModel = null;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          if (entry.type === 'model_change') {
            currentProvider = entry.provider || '';
            currentModel = entry.modelId || '';
          }

          if (entry.type === 'message' && entry.message) {
            const msg = entry.message;
            if (msg.role === 'assistant' && msg.usage) {
              const usage = msg.usage;
              const provider = msg.provider || entry.provider || currentProvider || 'unknown';
              const model = msg.model || entry.model || currentModel || 'unknown';
              const modelKey = `${provider}/${model}`;
              const ts = new Date(msg.timestamp || entry.timestamp).getTime();

              if (!models[modelKey]) {
                models[modelKey] = createModelEntry();
              }

              const m = models[modelKey];
              const inputTokens = usage.input || 0;
              const outputTokens = usage.output || 0;
              const cacheRead = usage.cacheRead || 0;
              const rate = getCostRate(modelKey, costRates || {});
              const callCost = (inputTokens * rate.input + outputTokens * rate.output) / 1000;

              m.calls++;
              m.input_tokens += inputTokens;
              m.output_tokens += outputTokens;
              m.cache_read_tokens += cacheRead;
              m.cost += callCost;

              // Time-windowed aggregates
              if (ts >= timeRanges.today) {
                m.today.calls++;
                m.today.input_tokens += inputTokens;
                m.today.output_tokens += outputTokens;
                m.today.cost = (m.today.cost || 0) + callCost;
              }
              if (ts >= timeRanges.week) {
                m.week.calls++;
                m.week.input_tokens += inputTokens;
                m.week.output_tokens += outputTokens;
                m.week.cost = (m.week.cost || 0) + callCost;
              }
              if (ts >= timeRanges.month) {
                m.month.calls++;
                m.month.input_tokens += inputTokens;
                m.month.output_tokens += outputTokens;
                m.month.cost = (m.month.cost || 0) + callCost;
              }
              if (ts >= timeRanges.fiveHour) {
                m.fiveHour.calls++;
                m.fiveHour.input_tokens += inputTokens;
                m.fiveHour.output_tokens += outputTokens;
                m.fiveHour.cost = (m.fiveHour.cost || 0) + callCost;
              }
            }
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    console.log(`[${new Date().toISOString()}] [openclaw-sessions] Found ${Object.keys(models).length} models from ${files.length} session files`);
    return models;
  },

  /**
   * Collect session statistics
   * @param {Object} config - Collector configuration
   * @returns {Promise<Object>} Session statistics
   */
  async collectSessionStats(config) {
    const { paths } = config;
    const sessionsDir = paths.sessionsDir;

    let totalSessions = 0;
    let todaySessions = 0;

    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      // 统计有用户交互的对话（排除空文件和极小文件）
      const now = new Date();
      // UTC+8 today string
      const utc8Now = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const todayStr = utc8Now.toISOString().slice(0, 10);

      for (const f of files) {
        const fp = path.join(sessionsDir, f);
        const st = fs.statSync(fp);
        if (st.size < 500) continue;
        // 快速检查是否有用户消息（读最后 2KB 找 "role":"user"）
        let hasUserMsg = false;
        try {
          const fd = fs.openSync(fp, 'r');
          const readSize = Math.min(st.size, 2048);
          const buf = Buffer.alloc(readSize);
          fs.readSync(fd, buf, 0, readSize, Math.max(0, st.size - readSize));
          fs.closeSync(fd);
          hasUserMsg = buf.toString('utf8').includes('"role":"user"');
        } catch(e) {}
        if (!hasUserMsg) continue;
        totalSessions++;
        const mtime = new Date(st.mtimeMs + 8 * 60 * 60 * 1000);
        if (mtime.toISOString().slice(0, 10) === todayStr) todaySessions++;
      }
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [openclaw-sessions] Error collecting session stats: ${e.message}`);
    }

    return { total: totalSessions, today: todaySessions };
  },

  /**
   * Collect live session information for dashboard display
   * @param {Object} config - Collector configuration
   * @returns {Promise<Array>} Live session list
   */
  async collectLiveSessions(config) {
    const { paths } = config;
    const sessionsDir = paths.sessionsDir;
    const sessions = [];
    const now = Date.now();
    const UTC8 = 8 * 60 * 60 * 1000;

    // Build session ID → kind/label lookup from sessions.json
    const sessionMeta = {};
    try {
      const sessionsJsonPath = path.join(sessionsDir, 'sessions.json');
      const sessionsMap = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
      for (const [key, val] of Object.entries(sessionsMap)) {
        const sid = val.sessionId;
        if (!sid) continue;
        let kind = 'unknown';
        if (key.endsWith(':main') || key === 'main') kind = 'main';
        else if (key.includes(':cron:')) kind = 'cron';
        else if (key.includes(':group:')) kind = 'group';
        else if (key.includes(':dm:')) kind = 'dm';
        else if (key.includes(':channel:')) kind = 'channel';
        else if (key.includes(':subagent:') || key.includes('subagent')) kind = 'subagent';
        const label = val.label || val.displayName || '';
        // Friendly label mapping
        let friendlyLabel = label;
        if (kind === 'main') friendlyLabel = '后台引擎';
        else if (kind === 'dm') friendlyLabel = '私聊:搞钱大王';
        else if (kind === 'cron' && label) friendlyLabel = '定时:' + label.replace(/^Cron:\s*/, '');
        else if (kind === 'subagent' && label) friendlyLabel = '子任务:' + label;
        else if (kind === 'subagent') friendlyLabel = '子任务:' + sid.slice(0, 8);
        else if (kind === 'group') {
          // 群名从飞书 API 动态获取，先暂存 groupId
          const groupId = key.split(':group:')[1]?.split(':')[0] || '';
          friendlyLabel = groupId; // 占位，后面用 API 替换
        }
        sessionMeta[sid] = { kind, label: friendlyLabel, _groupId: kind === 'group' ? (key.split(':group:')[1]?.split(':')[0] || '') : '' };
      }
    } catch (e) {}

    // Fetch Feishu group names — with file cache (24h TTL) to minimize API calls
    const groupNames = {};
    const CACHE_FILE = '/tmp/feishu-group-names-cache.json';
    const CACHE_TTL_MS = Infinity; // 永久缓存，群名基本不变
    
    // Load cache
    let cache = {};
    try {
      if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch(e) {}
    
    // Collect group IDs that need lookup
    const groupIds = new Set();
    for (const meta of Object.values(sessionMeta)) {
      if (meta._groupId) {
        const gid = meta._groupId;
        // Use cache if fresh
        if (cache[gid] && cache[gid].ts && (Date.now() - cache[gid].ts < CACHE_TTL_MS)) {
          groupNames[gid] = cache[gid].name;
        } else {
          groupIds.add(gid);
        }
      }
    }
    
    // Only call Feishu API for uncached groups
    if (groupIds.size > 0) {
      try {
        const feishuConfig = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json', 'utf8'));
        const appId = 'cli_a9f77611ef785cd2';
        const appSecret = feishuConfig.channels?.feishu?.appSecret;
        if (appSecret) {
          const https = require('https');
          const tokenData = await new Promise((resolve) => {
            const body = JSON.stringify({ app_id: appId, app_secret: appSecret });
            const req = https.request({ hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, res => {
              let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
            });
            req.on('error', () => resolve({}));
            req.write(body); req.end();
          });
          const token = tokenData.tenant_access_token;
          if (token) {
            for (const gid of groupIds) {
              try {
                const name = await new Promise((resolve) => {
                  https.get({ hostname: 'open.feishu.cn', path: `/open-apis/im/v1/chats/${gid}`, headers: { 'Authorization': `Bearer ${token}` } }, res => {
                    let d = ''; res.on('data', c => d += c); res.on('end', () => {
                      try { resolve(JSON.parse(d).data?.name || ''); } catch(e) { resolve(''); }
                    });
                  }).on('error', () => resolve(''));
                });
                if (name) {
                  groupNames[gid] = name;
                  cache[gid] = { name, ts: Date.now() };
                }
              } catch(e) {}
            }
          }
        }
      } catch(e) {}
      
      // Save cache
      try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch(e) {}
    }

    // Update group labels with real names
    for (const meta of Object.values(sessionMeta)) {
      if (meta._groupId && groupNames[meta._groupId]) {
        meta.label = '群聊:' + groupNames[meta._groupId];
      } else if (meta._groupId) {
        meta.label = '群聊:' + meta._groupId.slice(0, 8);
      }
    }

    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const fp = path.join(sessionsDir, file);
        const stat = fs.statSync(fp);
        const modifiedAgo = (now - stat.mtimeMs) / 1000 / 60; // minutes ago

        // Only include sessions modified in last 60 minutes
        if (modifiedAgo > 60) continue;

        // Read last 4KB for recent info
        const size = stat.size;
        let tail = '';
        try {
          if (size <= 4096) {
            tail = fs.readFileSync(fp, 'utf8');
          } else {
            const fd = fs.openSync(fp, 'r');
            const buf = Buffer.alloc(4096);
            fs.readSync(fd, buf, 0, 4096, size - 4096);
            fs.closeSync(fd);
            tail = buf.toString('utf8');
          }
        } catch (e) { continue; }

        const lines = tail.split('\n').filter(l => l.trim());
        let lastModel = '';
        let lastProvider = '';
        let lastTs = 0;
        let sessionKind = 'unknown';
        let sessionLabel = '';
        let lastAction = '';
        let totalTokensInTail = 0;

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'session_meta') {
              sessionKind = entry.kind || 'unknown';
              sessionLabel = entry.label || entry.displayName || '';
            }
            if (entry.type === 'message' && entry.message) {
              const msg = entry.message;
              const ts = new Date(msg.timestamp || entry.timestamp).getTime();
              if (ts > lastTs) {
                lastTs = ts;
                if (msg.role === 'assistant') {
                  lastModel = msg.model || '';
                  lastProvider = msg.provider || '';
                  // Extract action
                  if (Array.isArray(msg.content)) {
                    for (const b of msg.content) {
                      if (b.type === 'toolCall') lastAction = b.name || '';
                      else if (b.type === 'text' && b.text) lastAction = b.text.slice(0, 60);
                    }
                  } else if (typeof msg.content === 'string') {
                    lastAction = msg.content.slice(0, 60);
                  }
                }
              }
              if (msg.usage) {
                totalTokensInTail += (msg.usage.input || 0) + (msg.usage.output || 0);
              }
            }
          } catch (e) {}
        }

        if (lastTs === 0) continue;

        const sessionId = file.replace('.jsonl', '');
        const lastActiveMin = Math.round((now - lastTs) / 1000 / 60);

        // Use sessions.json lookup for kind/label (more reliable than jsonl entries)
        const meta = sessionMeta[sessionId] || {};
        const finalKind = meta.kind || sessionKind || 'unknown';
        const finalLabel = meta.label || sessionLabel || sessionId.slice(0, 8);

        // Infer executor
        let executor = lastModel || 'unknown';
        const key = `${lastProvider}/${lastModel}`.toLowerCase();
        if (key.includes('opus') || key.includes('anthropic-oauth')) executor = '瓦力(Opus)';
        else if (key.includes('glm')) executor = 'GLM-5';
        else if (key.includes('minimax') || key.includes('coco')) executor = 'MiniMax';

        sessions.push({
          id: sessionId,
          kind: finalKind,
          label: finalLabel,
          model: lastModel,
          executor,
          lastActiveMinutes: lastActiveMin,
          lastAction: lastAction.replace(/\n/g, ' '),
          tokens: totalTokensInTail,
          status: lastActiveMin < 5 ? 'active' : lastActiveMin < 30 ? 'recent' : 'idle',
        });
      }
    } catch (e) {
      console.error(`[openclaw-sessions] Error collecting live sessions: ${e.message}`);
    }

    // Sort by last active
    sessions.sort((a, b) => a.lastActiveMinutes - b.lastActiveMinutes);
    return sessions;
  },
};

module.exports = openclawSessionsProvider;
