#!/usr/bin/env node
/**
 * Stats Pusher — watches /tmp/wali-stats.json and pushes to remote via HTTP POST.
 * No SCP/SSH dependency. ~1-2 second end-to-end latency.
 */

const fs = require('fs');
const { execSync } = require('child_process');

const STATS_FILE = '/tmp/wali-stats.json';
const PUSH_URL = 'https://junaitools.com/wali-api/push.php';
const PUSH_TOKEN = process.env.WALI_PUSH_TOKEN || 'wali-push-2026';

let lastPush = 0;
let debounceTimer = null;
const MIN_INTERVAL_MS = 2000;

function pushStats() {
  const now = Date.now();
  if (now - lastPush < MIN_INTERVAL_MS) return;
  
  try {
    if (!fs.existsSync(STATS_FILE)) return;
    
    execSync(
      `curl -s -X POST "${PUSH_URL}?token=${PUSH_TOKEN}" -H "Content-Type: application/json" -d @${STATS_FILE} --connect-timeout 5 --max-time 15`,
      { timeout: 20000, stdio: 'pipe' }
    );
    lastPush = Date.now();
    const size = fs.statSync(STATS_FILE).size;
    console.log(`[${new Date().toISOString()}] Pushed ${Math.round(size/1024)}KB via HTTP (${Date.now() - now}ms)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Push failed: ${err.message}`);
  }
}

function debouncePush() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(pushStats, 500);
}

console.log(`[${new Date().toISOString()}] Watching ${STATS_FILE}...`);
console.log(`[${new Date().toISOString()}] Push target: ${PUSH_URL}`);

if (fs.existsSync(STATS_FILE)) {
  console.log(`[${new Date().toISOString()}] Initial push...`);
  pushStats();
}

fs.watchFile(STATS_FILE, { interval: 1000 }, (curr, prev) => {
  if (curr.mtime > prev.mtime) debouncePush();
});

try {
  fs.watch(STATS_FILE, () => debouncePush());
} catch (e) {}

setInterval(() => {}, 60000);
console.log(`[${new Date().toISOString()}] Stats pusher running (HTTP mode). Ctrl+C to stop.`);
