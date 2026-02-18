/**
 * Claude Code Provider
 *
 * Scans Claude Code hooks JSONL files and openspec-bg logs to collect
 * model usage data and session statistics.
 *
 * @module collectors/providers/claude-code
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse Claude Code hooks JSONL file for session and tool statistics
 * @param {string} filePath - Path to the hooks JSONL file
 * @returns {Object} Parsed session and tool usage data
 */
function parseClaudeCodeStats(filePath) {
  const result = {
    sessions: [],
    tool_usage: {},
    total_events: 0,
  };

  try {
    if (!fs.existsSync(filePath)) return result;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const sessionsMap = {};

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        result.total_events++;

        if (entry.event === 'session_start') {
          sessionsMap[entry.session_id] = {
            id: entry.session_id,
            cwd: entry.cwd,
            started: entry.timestamp,
            ended: null,
            tools: 0,
            failures: 0,
          };
        } else if (entry.event === 'session_end') {
          if (sessionsMap[entry.session_id]) {
            sessionsMap[entry.session_id].ended = entry.timestamp;
          }
        } else if (entry.event === 'tool_use') {
          result.tool_usage[entry.tool] = (result.tool_usage[entry.tool] || 0) + 1;
          if (sessionsMap[entry.session_id]) {
            sessionsMap[entry.session_id].tools++;
          }
        } else if (entry.event === 'tool_failure') {
          result.tool_usage[entry.tool] = (result.tool_usage[entry.tool] || 0) + 1;
          if (sessionsMap[entry.session_id]) {
            sessionsMap[entry.session_id].failures++;
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    result.sessions = Object.values(sessionsMap).slice(-20); // Last 20 sessions
  } catch (e) {
    console.error(`[${new Date().toISOString()}] [claude-code] Error parsing stats: ${e.message}`);
  }

  return result;
}

/**
 * Parse openspec-bg log files for JSON results from claude -p commands
 * @param {string} logDir - Directory containing log files
 * @returns {Object} Token usage by model
 */
function parseOpenspecLogs(logDir) {
  const byModel = {};

  try {
    const logs = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));

    for (const f of logs) {
      try {
        const content = fs.readFileSync(path.join(logDir, f), 'utf8');
        // Find result JSON from claude -p --output-format json
        const matches = content.match(/\{"type":"result"[^\n]*\}/g);

        if (matches) {
          for (const m of matches) {
            try {
              const result = JSON.parse(m);

              if (result.usage) {
                const u = result.usage;
                const key = 'claude-code/aggregated';
                if (!byModel[key]) byModel[key] = { calls: 0, input: 0, output: 0, cache_read: 0 };
                byModel[key].calls += (result.num_turns || 1);
                byModel[key].input += (u.input_tokens || 0);
                byModel[key].output += (u.output_tokens || 0);
                byModel[key].cache_read += (u.cache_read_input_tokens || 0);
              }

              // Also extract per-model usage
              if (result.modelUsage) {
                for (const [model, usage] of Object.entries(result.modelUsage)) {
                  const key = 'claude-code/' + model;
                  if (!byModel[key]) byModel[key] = { calls: 0, input: 0, output: 0, cache_read: 0 };
                  byModel[key].calls += 1;
                  byModel[key].input += (usage.inputTokens || 0);
                  byModel[key].output += (usage.outputTokens || 0);
                  byModel[key].cache_read += (usage.cacheReadInputTokens || 0);
                }
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] [claude-code] Error reading openspec logs: ${e.message}`);
  }

  return byModel;
}

/**
 * Recursively scan Claude Code session JSONL files
 * @param {string} dir - Base directory to scan
 * @returns {Object} Token usage by model
 */
function scanClaudeCodeSessions(dir) {
  const byModel = {};

  function scanDir(d) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });

      for (const entry of entries) {
        const fp = path.join(d, entry.name);

        if (entry.isDirectory()) {
          scanDir(fp);
          continue;
        }

        if (!entry.name.endsWith('.jsonl')) continue;

        try {
          const lines = fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const j = JSON.parse(line);

              if (j.type === 'assistant' && j.message) {
                const model = j.message.model || 'unknown';
                const u = j.message.usage || {};
                const input = u.input_tokens || 0;
                const output = u.output_tokens || 0;
                const cache = u.cache_read_input_tokens || 0;

                // Only count if there's actual token data
                if (input > 0 || output > 0 || cache > 0) {
                  const key = 'claude-code/' + model;
                  if (!byModel[key]) byModel[key] = { calls: 0, input: 0, output: 0, cache_read: 0 };
                  byModel[key].calls++;
                  byModel[key].input += input;
                  byModel[key].output += output;
                  byModel[key].cache_read += cache;
                }
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        } catch (e) {
          // Skip unreadable files
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  scanDir(dir);
  return byModel;
}

/**
 * Claude Code Provider implementation
 */
const claudeCodeProvider = {
  name: 'claude-code',

  /**
   * Collect model usage data from Claude Code logs and sessions
   * @param {Object} config - Collector configuration
   * @returns {Promise<Object>} Model usage map
   */
  async collectModelUsage(config) {
    const { paths } = config;
    const byModel = {};

    // 1. Parse openspec-bg logs for JSON results
    const openspecTokens = parseOpenspecLogs(paths.openspecBgLogsDir);

    // 2. Parse Claude Code session JSONL files
    const ccTokens = scanClaudeCodeSessions(paths.claudeCodeProjectsDir);

    // Merge both sources
    for (const [key, data] of Object.entries(openspecTokens)) {
      if (!byModel[key]) {
        byModel[key] = { calls: 0, input: 0, output: 0, cache_read: 0 };
      }
      byModel[key].calls += data.calls;
      byModel[key].input += data.input;
      byModel[key].output += data.output;
      byModel[key].cache_read += (data.cache_read || 0);
    }

    for (const [key, data] of Object.entries(ccTokens)) {
      if (!byModel[key]) {
        byModel[key] = { calls: 0, input: 0, output: 0, cache_read: 0 };
      }
      byModel[key].calls += data.calls;
      byModel[key].input += data.input;
      byModel[key].output += data.output;
      byModel[key].cache_read += (data.cache_read || 0);
    }

    console.log(`[${new Date().toISOString()}] [claude-code] Found ${Object.keys(byModel).length} models from logs and sessions`);
    return byModel;
  },

  /**
   * Collect Claude Code session statistics
   * @param {Object} config - Collector configuration
   * @returns {Promise<Object>} Session statistics
   */
  async collectStats(config) {
    const { paths } = config;
    return parseClaudeCodeStats(paths.claudeCodeStats);
  }
};

module.exports = claudeCodeProvider;
