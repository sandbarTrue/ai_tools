/**
 * Screen Tasks Provider
 *
 * Detects active screen sessions with specific prefixes (openspec-, direct-)
 * and monitors their log files to determine activity status.
 *
 * @module collectors/providers/screen-tasks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Parse screen -ls output to extract session names
 * @param {string} output - Raw output from screen -ls
 * @returns {Array<string>} List of session names
 */
function parseScreenList(output) {
  const sessions = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match lines like:
    //  12345.openspec-task-name  (Detached)
    //  67890.direct-another-task  (Attached)
    const match = line.match(/^\s*\d+\.(\S+)\s+\(/);
    if (match) {
      sessions.push(match[1]);
    }
  }

  return sessions;
}

/**
 * Get last N lines from a file
 * @param {string} filePath - Path to the file
 * @param {number} n - Number of lines to read
 * @returns {string} Last N lines of the file
 */
function getTail(filePath, n = 10) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n).join('\n');
  } catch (e) {
    return '';
  }
}

/**
 * Screen Tasks Provider implementation
 */
const screenTasksProvider = {
  name: 'screen-tasks',

  /**
   * Collect active tasks from screen sessions
   * @param {Object} config - Collector configuration
   * @returns {Promise<Array>} List of active tasks
   */
  async collectActiveTasks(config) {
    const { screenTasks, paths } = config;
    const prefixes = screenTasks?.prefixes || ['openspec-', 'direct-'];
    const staleThresholdMinutes = screenTasks?.staleThresholdMinutes || 5;
    const logDir = paths?.openspecBgLogsDir || '/tmp/openspec-bg-logs';

    const tasks = [];

    try {
      // Run screen -ls to get all sessions
      const screenOutput = execSync('screen -ls 2>/dev/null || true', {
        encoding: 'utf8',
        timeout: 5000
      });

      const allSessions = parseScreenList(screenOutput);

      // Filter by prefixes
      const matchingSessions = allSessions.filter(name =>
        prefixes.some(prefix => name.startsWith(prefix))
      );

      const now = Date.now();
      const staleThresholdMs = staleThresholdMinutes * 60 * 1000;

      for (const sessionName of matchingSessions) {
        // Determine log file path
        // Convention: log file is /tmp/openspec-bg-logs/<session-name>.log
        const logFile = path.join(logDir, `${sessionName}.log`);

        let lastActivity = null;
        let status = 'unknown';
        let logTail = '';

        try {
          if (fs.existsSync(logFile)) {
            const stat = fs.statSync(logFile);
            lastActivity = stat.mtime.toISOString();
            const timeSinceModification = now - stat.mtime.getTime();

            if (timeSinceModification > staleThresholdMs) {
              status = 'stale';
            } else {
              status = 'running';
            }

            logTail = getTail(logFile, 5);
          } else {
            status = 'no_log';
          }
        } catch (e) {
          status = 'error';
        }

        // Extract task type from session name
        let executor = 'unknown';
        if (sessionName.startsWith('openspec-')) {
          executor = 'openspec-bg';
        } else if (sessionName.startsWith('direct-')) {
          executor = 'direct';
        }

        tasks.push({
          id: sessionName,
          name: sessionName,
          executor,
          startedAt: null, // We don't have start time from screen -ls
          lastActivity,
          status,
          logTail: logTail ? logTail.slice(-500) : null, // Truncate to 500 chars
        });
      }

      console.log(`[${new Date().toISOString()}] [screen-tasks] Found ${tasks.length} active tasks (${tasks.filter(t => t.status === 'running').length} running, ${tasks.filter(t => t.status === 'stale').length} stale)`);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [screen-tasks] Error collecting tasks: ${e.message}`);
    }

    return tasks;
  }
};

module.exports = screenTasksProvider;
