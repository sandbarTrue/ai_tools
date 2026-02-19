#!/usr/bin/env node
/**
 * WebSocket Server for Wali Dashboard
 *
 * Listens on localhost:3847
 * - Receives events from local stats-pusher
 * - Broadcasts to all connected frontend clients
 * - Writes latest stats to stats.json as fallback
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.WS_PORT || 3847;
const AUTH_TOKEN = process.env.WS_AUTH_TOKEN || 'changeme';
const STATS_FILE = process.env.STATS_FILE || path.join(process.env.HOME || '/root', 'junaitools.com/wali-api/stats.json');
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000;  // 60 seconds

// Server state
const wss = new WebSocket.Server({ port: PORT });
let latestStats = null;

// Log helper
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

// Write stats to file as fallback
function writeStatsToFile(data) {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    log(`Stats written to ${STATS_FILE}`);
  } catch (err) {
    log(`Error writing stats file: ${err.message}`);
  }
}

// Broadcast to all clients except sender
function broadcast(data, sender = null) {
  const message = JSON.stringify(data);
  let clientCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(message);
      clientCount++;
    }
  });

  log(`Broadcast to ${clientCount} clients, event: ${data.event}`);
}

// Authenticate client by token
function authenticate(token) {
  return token === AUTH_TOKEN;
}

// Setup heartbeat for a client
function setupHeartbeat(ws) {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });
}

// Heartbeat check interval
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      log(`Client terminated (heartbeat timeout)`);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Handle new connections
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const clientType = url.searchParams.get('type') || 'frontend'; // 'pusher' or 'frontend'

  // Authentication
  if (!authenticate(token)) {
    log(`Rejected connection from ${clientIp} - invalid token`);
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Mark client type
  ws.clientType = clientType;
  ws.isAlive = true;

  log(`Client connected: ${clientIp}, type: ${clientType}`);

  // Setup heartbeat
  setupHeartbeat(ws);

  // Send latest stats to new frontend clients
  if (clientType === 'frontend' && latestStats) {
    ws.send(JSON.stringify({
      event: 'stats_update',
      data: latestStats
    }));
    log(`Sent latest stats to new frontend client`);
  }

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      log(`Received: ${message.event} from ${ws.clientType}`);

      // Handle different event types
      switch (message.event) {
        case 'stats_update':
          latestStats = message.data;
          writeStatsToFile(message.data);
          broadcast(message, ws);
          break;

        case 'task_created':
        case 'execution_progress':
        case 'execution_done':
        case 'session_activity':
          broadcast(message, ws);
          break;

        case 'ping':
          ws.send(JSON.stringify({ event: 'pong' }));
          break;

        default:
          log(`Unknown event: ${message.event}`);
      }
    } catch (err) {
      log(`Error parsing message: ${err.message}`);
    }
  });

  // Handle close
  ws.on('close', (code, reason) => {
    log(`Client disconnected: ${clientIp}, code: ${code}, reason: ${reason || 'none'}`);
  });

  // Handle errors
  ws.on('error', (err) => {
    log(`Client error: ${err.message}`);
  });
});

// Cleanup on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
  log('Server closed');
});

// Start server
log(`WebSocket server started on port ${PORT}`);
log(`Stats file: ${STATS_FILE}`);
log(`Auth token configured: ${AUTH_TOKEN !== 'changeme' ? 'yes' : 'no (using default)'}`);
