#!/usr/bin/env node
/**
 * Stats Pusher - Local WebSocket Client
 *
 * Watches /tmp/wali-stats.json for changes and pushes updates
 * to the remote WebSocket server.
 *
 * Location: /root/.openclaw/workspace/collectors/stats-pusher.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const STATS_FILE = process.env.STATS_FILE || '/tmp/wali-stats.json';
const WS_URL = process.env.WS_URL || 'wss://junaitools.com/ws/';
const WS_TOKEN = process.env.WS_AUTH_TOKEN || 'changeme';
const RECONNECT_BASE_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const DEBOUNCE_DELAY = 500; // 500ms debounce for file changes

// State
let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let fileWatcher = null;
let lastPushTime = 0;
let isConnecting = false;
let pendingData = null;
let debounceTimeout = null;

// Log helper
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

// Calculate reconnect delay with exponential backoff
function getReconnectDelay() {
  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY
  );
  reconnectAttempts++;
  return delay;
}

// Reset reconnect attempts on successful connection
function resetReconnectAttempts() {
  reconnectAttempts = 0;
}

// Fallback to SCP if WS fails
function fallbackToSCP(data) {
  log('Falling back to SCP...');
  const remotePath = process.env.SCP_PATH || 'junaitools.com:wali-api/stats.json';
  const localFile = '/tmp/wali-stats-scp.json';

  // Write to temp file
  try {
    fs.writeFileSync(localFile, JSON.stringify(data, null, 2));
  } catch (err) {
    log(`Error writing temp file for SCP: ${err.message}`);
    return;
  }

  // Execute SCP
  exec(`scp ${localFile} ${remotePath}`, (error, stdout, stderr) => {
    if (error) {
      log(`SCP error: ${error.message}`);
      return;
    }
    log(`SCP fallback successful: ${remotePath}`);
  });
}

// Push data via WebSocket
function pushData(data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('WebSocket not connected, queuing data');
    pendingData = data;

    // If not connecting, start connection
    if (!isConnecting) {
      connect();
    }
    return false;
  }

  const message = JSON.stringify({
    event: 'stats_update',
    data: data
  });

  try {
    ws.send(message);
    const dataSize = Buffer.byteLength(message, 'utf8');
    log(`Pushed stats update: ${dataSize} bytes`);
    lastPushTime = Date.now();
    return true;
  } catch (err) {
    log(`Error sending data: ${err.message}`);
    return false;
  }
}

// Read and push stats file
function readAndPushStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      log(`Stats file not found: ${STATS_FILE}`);
      return;
    }

    const content = fs.readFileSync(STATS_FILE, 'utf8');
    const data = JSON.parse(content);

    log(`Read stats file: ${STATS_FILE}, keys: ${Object.keys(data).join(', ')}`);
    pushData(data);
  } catch (err) {
    log(`Error reading stats file: ${err.message}`);
  }
}

// Debounced file change handler
function handleFileChange(eventType, filename) {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(() => {
    log(`File changed: ${eventType} on ${filename}`);
    readAndPushStats();
    debounceTimeout = null;
  }, DEBOUNCE_DELAY);
}

// Setup file watcher
function setupFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
  }

  try {
    // Watch the directory for the file (more reliable than watching file directly)
    const dir = path.dirname(STATS_FILE);
    const basename = path.basename(STATS_FILE);

    fileWatcher = fs.watch(dir, (eventType, filename) => {
      if (filename === basename) {
        handleFileChange(eventType, filename);
      }
    });

    fileWatcher.on('error', (err) => {
      log(`File watcher error: ${err.message}`);
      // Try to restart watcher
      setTimeout(setupFileWatcher, 5000);
    });

    log(`Watching file: ${STATS_FILE}`);
  } catch (err) {
    log(`Failed to setup file watcher: ${err.message}`);
  }
}

// Connect to WebSocket server
function connect() {
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;

  const url = `${WS_URL}?token=${encodeURIComponent(WS_TOKEN)}&type=pusher`;
  log(`Connecting to ${WS_URL}...`);

  try {
    ws = new WebSocket(url);

    ws.on('open', () => {
      log('WebSocket connected');
      isConnecting = false;
      resetReconnectAttempts();

      // Push any pending data
      if (pendingData) {
        pushData(pendingData);
        pendingData = null;
      }

      // Also push current stats on connect
      readAndPushStats();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        log(`Received: ${message.event}`);
      } catch (err) {
        log(`Received raw message: ${data.toString().substring(0, 100)}`);
      }
    });

    ws.on('close', (code, reason) => {
      log(`WebSocket closed: code=${code}, reason=${reason || 'none'}`);
      isConnecting = false;
      ws = null;
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`);
      isConnecting = false;
    });

  } catch (err) {
    log(`Connection error: ${err.message}`);
    isConnecting = false;
    scheduleReconnect();
  }
}

// Schedule reconnection
function scheduleReconnect() {
  if (reconnectTimeout) {
    return;
  }

  const delay = getReconnectDelay();
  log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, delay);
}

// Cleanup on exit
function cleanup() {
  log('Shutting down...');

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }

  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  process.exit(0);
}

// Handle signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main
log('Stats Pusher starting...');
log(`Stats file: ${STATS_FILE}`);
log(`WebSocket URL: ${WS_URL}`);

// Start file watcher
setupFileWatcher();

// Initial read
readAndPushStats();

// Start connection
connect();

// Keep process alive
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memMB = Math.round(memUsage.rss / 1024 / 1024);
  if (memMB > 100) {
    log(`Memory usage: ${memMB}MB`);
  }
}, 60000); // Log memory every minute
