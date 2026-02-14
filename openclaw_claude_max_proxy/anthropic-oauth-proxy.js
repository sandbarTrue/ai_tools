#!/usr/bin/env node
/*
  Anthropic OAuth proxy for Claude Max subscriptions.

  - Listens on http://127.0.0.1:${PROXY_PORT:-8089}
  - Forwards requests to https://api.anthropic.com
  - Injects Authorization: Bearer $ANTHROPIC_OAUTH_TOKEN
  - Supports enterprise proxy egress via HTTPS_PROXY / HTTP_PROXY

  Notes:
  - Never prints the token.
  - Use NO_PROXY/no_proxy to bypass proxy for 127.0.0.1.
*/

const http = require('http');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const ANTHROPIC_API = 'api.anthropic.com';

const OAUTH_TOKEN = process.env.ANTHROPIC_OAUTH_TOKEN;
const PORT = Number(process.env.PROXY_PORT || 8089);
const HOST = process.env.PROXY_HOST || '127.0.0.1';

if (!OAUTH_TOKEN) {
  console.error('Missing ANTHROPIC_OAUTH_TOKEN.');
  console.error('Example: export ANTHROPIC_OAUTH_TOKEN="<your_oauth_token>"');
  process.exit(1);
}

if (!Number.isFinite(PORT) || PORT <= 0 || PORT >= 65536) {
  console.error(`Invalid PROXY_PORT: ${process.env.PROXY_PORT}`);
  process.exit(1);
}

const OUTBOUND_PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  '';

const NO_PROXY = process.env.NO_PROXY || process.env.no_proxy || '';

function shouldBypassProxy(hostname) {
  if (!NO_PROXY) return false;
  const list = NO_PROXY.split(',').map(s => s.trim()).filter(Boolean);
  for (const entry of list) {
    if (entry === '*') return true;
    if (entry === hostname) return true;
    const normalized = entry.startsWith('.') ? entry.slice(1) : entry;
    if (hostname === normalized || hostname.endsWith(`.${normalized}`)) return true;
  }
  return false;
}

const outboundAgent =
  OUTBOUND_PROXY_URL && !shouldBypassProxy(ANTHROPIC_API)
    ? new HttpsProxyAgent(OUTBOUND_PROXY_URL)
    : undefined;

function sanitizeHeaders(inHeaders) {
  const headers = {};
  for (const [k, v] of Object.entries(inHeaders || {})) {
    const key = String(k).toLowerCase();
    if (key === 'host' || key === 'authorization' || key === 'x-api-key') continue;
    headers[k] = v;
  }
  headers.host = ANTHROPIC_API;
  headers.authorization = `Bearer ${OAUTH_TOKEN}`;
  // Ensure api version present
  if (!headers['anthropic-version'] && !headers['Anthropic-Version']) {
    headers['anthropic-version'] = '2023-06-01';
  }
  // Keep beta flags compatible with Claude Code/OpenClaw flows
  if (!headers['anthropic-beta'] && !headers['Anthropic-Beta']) {
    headers['anthropic-beta'] =
      'claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14';
  }
  headers['x-app'] = headers['x-app'] || 'cli';
  headers['user-agent'] = headers['user-agent'] || 'openclaw-claude-max-proxy/0.1';
  return headers;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const options = {
      hostname: ANTHROPIC_API,
      port: 443,
      path: req.url,
      method: req.method,
      headers: sanitizeHeaders(req.headers),
      agent: outboundAgent
    };

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    const upstream = https.request(options, (upRes) => {
      res.writeHead(upRes.statusCode || 500, upRes.headers);
      upRes.pipe(res);
    });

    upstream.on('error', (e) => {
      console.error(`Proxy error: ${e.message}`);
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(`Proxy error: ${e.message}`);
    });

    if (body.length) upstream.write(body);
    upstream.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Anthropic OAuth proxy running on http://${HOST}:${PORT}`);
  console.log(`Outbound proxy: ${OUTBOUND_PROXY_URL ? (outboundAgent ? 'enabled' : 'disabled (NO_PROXY match)') : 'disabled'}`);
});

