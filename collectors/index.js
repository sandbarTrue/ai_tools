#!/usr/bin/env node
/**
 * Wali Stats Collector - Main Entry Point
 *
 * Provider-based architecture for collecting model usage and task data.
 * Loads all providers, merges model data according to configuration,
 * and outputs a unified stats.json file.
 *
 * @module collectors/index
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error(`[${new Date().toISOString()}] Failed to load config.json: ${e.message}`);
  process.exit(1);
}

// Load providers
const providersDir = path.join(__dirname, 'providers');
const providers = {};

try {
  const providerFiles = fs.readdirSync(providersDir).filter(f => f.endsWith('.js'));
  for (const file of providerFiles) {
    const providerName = path.basename(file, '.js');
    providers[providerName] = require(path.join(providersDir, file));
    console.log(`[${new Date().toISOString()}] Loaded provider: ${providerName}`);
  }
} catch (e) {
  console.error(`[${new Date().toISOString()}] Failed to load providers: ${e.message}`);
}

/**
 * Create an empty model entry with all required fields
 * @returns {Object} Empty model entry
 */
function createEmptyModelEntry() {
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
 * Merge two model entries
 * @param {Object} target - Target entry to merge into
 * @param {Object} source - Source entry to merge from
 * @returns {Object} Merged entry
 */
function mergeModelEntries(target, source) {
  target.calls += source.calls || 0;
  target.input_tokens += source.input_tokens || source.input || 0;
  target.output_tokens += source.output_tokens || source.output || 0;
  target.cache_read_tokens += source.cache_read_tokens || source.cache_read || 0;
  target.cost += source.cost || 0;

  // Merge time windows if present
  for (const window of ['today', 'week', 'month', 'fiveHour']) {
    if (source[window]) {
      if (!target[window]) target[window] = { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 };
      target[window].calls += source[window].calls || 0;
      target[window].input_tokens += source[window].input_tokens || 0;
      target[window].output_tokens += source[window].output_tokens || 0;
      target[window].cost += source[window].cost || 0;
    }
  }

  return target;
}

/**
 * Check if a model key matches a pattern (supports wildcards)
 * @param {string} key - The model key to check
 * @param {string} pattern - The pattern (may contain *)
 * @returns {boolean} True if matches
 */
function matchesPattern(key, pattern) {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
  return key === pattern;
}

/**
 * Merge raw models into grouped models based on configuration
 * @param {Object} rawModels - Raw model usage data
 * @param {Array} modelGroups - Model grouping configuration
 * @returns {Object} Merged model data by group ID
 */
function mergeModelsByGroup(rawModels, modelGroups) {
  const merged = {};
  const matchedKeys = new Set();

  for (const group of modelGroups) {
    const entry = createEmptyModelEntry();

    for (const pattern of group.keys) {
      for (const [key, data] of Object.entries(rawModels)) {
        if (matchesPattern(key, pattern)) {
          mergeModelEntries(entry, data);
          matchedKeys.add(key);
        }
      }
    }

    if (entry.calls > 0) {
      merged[group.id] = {
        ...entry,
        displayName: group.displayName,
        vendor: group.vendor,
      };
    }
  }

  return merged;
}

/**
 * Fetch brain status from OpenClaw
 * @param {string} url - Brain status URL
 * @returns {Object|null} Brain status or null
 */
function fetchBrainStatus(url) {
  try {
    const output = execSync(`curl -s --max-time 3 ${url}`, { encoding: 'utf8', timeout: 5000 });
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

/**
 * Push stats to remote server via HTTP POST
 * Replaces SCP — no SSH dependency, works through WAF
 * @param {Object} pushConfig - Push configuration (url, token)
 * @param {string} localFile - Local file path
 */
function pushToRemote(pushConfig, localFile) {
  if (!pushConfig || !pushConfig.enabled) {
    console.log(`[${new Date().toISOString()}] HTTP push is disabled in config`);
    return;
  }

  try {
    const url = `${pushConfig.url}?token=${pushConfig.token}`;
    execSync(
      `curl -s -X POST "${url}" -H "Content-Type: application/json" -d @${localFile} --connect-timeout 10 --max-time 30`,
      { timeout: 35000 }
    );
    console.log(`[${new Date().toISOString()}] HTTP push to ${pushConfig.url}: OK`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] HTTP push failed: ${e.message}`);
  }
}

/**
 * Legacy SCP (kept as fallback)
 */
function scpToRemote(scpConfig, localFile) {
  if (!scpConfig || !scpConfig.enabled) return;
  try {
    const { host, port, user, keyFile, remotePath } = scpConfig;
    execSync(
      `scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P ${port} -i ${keyFile} ${localFile} ${user}@${host}:${remotePath}`,
      { timeout: 30000 }
    );
    console.log(`[${new Date().toISOString()}] SCP to ${host}:${port}: OK`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] SCP failed: ${e.message}`);
  }
}

/**
 * Main collector function
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Stats collector starting...`);

  const output = {
    generated_at: new Date().toISOString(),
    raw_models: {},
    merged_models: {},
    active_tasks: [],
    brain_status: null,
    claude_code: null,
    zhipu_quota: null,
    claude_quota: null,
    claude_max: null,
    sessions: null,
    wali_status: null,
  };

  // Collect model usage from all providers
  const allModelUsage = {};

  for (const [name, provider] of Object.entries(providers)) {
    if (provider.collectModelUsage) {
      try {
        const modelUsage = await provider.collectModelUsage(config);
        for (const [key, data] of Object.entries(modelUsage)) {
          if (!allModelUsage[key]) {
            allModelUsage[key] = createEmptyModelEntry();
          }
          mergeModelEntries(allModelUsage[key], data);
        }
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Provider ${name} failed: ${e.message}`);
      }
    }
  }

  // Normalize model keys (merge case variants like claude-code/GLM-5 → claude-code/glm-5)
  const MODEL_KEY_NORMALIZE = {
    'claude-code/GLM-5': 'claude-code/glm-5',
  };
  for (const [from, to] of Object.entries(MODEL_KEY_NORMALIZE)) {
    if (allModelUsage[from] && from !== to) {
      if (!allModelUsage[to]) allModelUsage[to] = createEmptyModelEntry();
      mergeModelEntries(allModelUsage[to], allModelUsage[from]);
      delete allModelUsage[from];
    }
  }

  output.raw_models = allModelUsage;
  // Backward compatibility: frontend reads stats.models
  output.models = allModelUsage;

  // Merge models by group
  if (config.modelGroups && config.modelGroups.length > 0) {
    const mergedObj = mergeModelsByGroup(allModelUsage, config.modelGroups);
    // Convert to sorted array (frontend expects array with .map())
    output.merged_models = Object.entries(mergedObj)
      .sort((a, b) => b[1].calls - a[1].calls)
      .map(([id, data]) => ({ id, ...data }));
    // Also keep object format for backward compat
    output.merged_models_map = mergedObj;
  }

  // Collect active tasks from screen-tasks provider
  if (providers['screen-tasks'] && providers['screen-tasks'].collectActiveTasks) {
    try {
      output.active_tasks = await providers['screen-tasks'].collectActiveTasks(config);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] screen-tasks provider failed: ${e.message}`);
    }
  }

  // Collect session stats from openclaw-sessions provider
  if (providers['openclaw-sessions'] && providers['openclaw-sessions'].collectSessionStats) {
    try {
      output.sessions = await providers['openclaw-sessions'].collectSessionStats(config);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] openclaw-sessions session stats failed: ${e.message}`);
    }
  }

  // Collect Claude Code stats
  if (providers['claude-code'] && providers['claude-code'].collectStats) {
    try {
      output.claude_code = await providers['claude-code'].collectStats(config);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] claude-code stats failed: ${e.message}`);
    }
  }

  // Fetch brain status
  output.brain_status = fetchBrainStatus(config.paths.brainStatusUrl);

  // Load quota data from files
  try {
    if (fs.existsSync(config.paths.zhipuQuotaFile)) {
      const zhipuData = JSON.parse(fs.readFileSync(config.paths.zhipuQuotaFile, 'utf8'));
      output.zhipu_quota = zhipuData?.zhipu || null;
    }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] Zhipu quota not available: ${e.message}`);
  }

  try {
    if (fs.existsSync(config.paths.claudeQuotaFile)) {
      const claudeData = JSON.parse(fs.readFileSync(config.paths.claudeQuotaFile, 'utf8'));
      output.claude_quota = claudeData?.claude || null;
    }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] Claude quota not available: ${e.message}`);
  }

  // Calculate Claude Max 5h window usage
  const claudeModels = Object.entries(allModelUsage).filter(([k]) =>
    k.includes('claude') || k.includes('anthropic')
  );

  const claude5h = {
    calls: claudeModels.reduce((a, [,m]) => a + (m.fiveHour?.calls || 0), 0),
    input_tokens: claudeModels.reduce((a, [,m]) => a + (m.fiveHour?.input_tokens || 0), 0),
    output_tokens: claudeModels.reduce((a, [,m]) => a + (m.fiveHour?.output_tokens || 0), 0),
    cost: claudeModels.reduce((a, [,m]) => a + (m.fiveHour?.cost || 0), 0),
  };

  output.claude_max = {
    plan: 'Max 20x',
    price: '$200/mo',
    window_hours: 5,
    window_usage: claude5h,
    total_cost: claudeModels.reduce((a, [,m]) => a + m.cost, 0),
  };

  // Collect live sessions for dashboard
  if (providers['openclaw-sessions'] && providers['openclaw-sessions'].collectLiveSessions) {
    try {
      output.live_sessions = await providers['openclaw-sessions'].collectLiveSessions(config);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] live sessions collection failed: ${e.message}`);
    }
  }

  // Auto-detect wali status from runtime data
  if (providers['wali-status'] && providers['wali-status'].collectWaliStatus) {
    try {
      output.wali_status = await providers['wali-status'].collectWaliStatus(config);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] wali-status provider failed: ${e.message}`);
    }
  }

  // Write output
  const outputFile = config.paths.outputFile;
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`[${new Date().toISOString()}] Stats written to ${outputFile}`);

  // Log model summary
  console.log(`[${new Date().toISOString()}] Raw models found: ${Object.keys(allModelUsage).join(', ')}`);
  for (const [key, m] of Object.entries(allModelUsage)) {
    console.log(`  ${key}: ${m.calls} calls, ${m.input_tokens} in, ${m.output_tokens} out, $${m.cost.toFixed(4)}`);
  }

  console.log(`[${new Date().toISOString()}] Merged models:`);
  for (const [key, m] of Object.entries(output.merged_models)) {
    console.log(`  ${m.displayName || key}: ${m.calls} calls, ${m.input_tokens} in, ${m.output_tokens} out, $${m.cost.toFixed(4)}`);
  }

  // Push to remote via HTTP POST (replaces SCP)
  pushToRemote(config.push, outputFile);

  // Legacy SCP fallback (disabled by default)
  scpToRemote(config.scp, outputFile);

  console.log(`[${new Date().toISOString()}] Done.`);
}

// Run main
main().catch(e => {
  console.error(`[${new Date().toISOString()}] Fatal error: ${e.message}`);
  process.exit(1);
});
