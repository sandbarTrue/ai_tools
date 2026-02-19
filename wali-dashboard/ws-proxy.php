<?php
/**
 * WebSocket Proxy for Shared Hosting
 *
 * This script proxies WebSocket connections from frontend to the Node.js WS server.
 * Since PHP on shared hosting may have limitations with persistent connections,
 * it provides a fallback to SSE (Server-Sent Events) mode.
 *
 * Usage:
 * - WebSocket mode: Client sends Upgrade header
 * - SSE mode: Add ?sse=1 parameter for Server-Sent Events fallback
 * - Status check: GET request without Upgrade header returns JSON status
 */

// Configuration
define('WS_HOST', '127.0.0.1');
define('WS_PORT', 3847);
define('WS_TIMEOUT', 60);
define('AUTH_TOKEN', getenv('WS_AUTH_TOKEN') ?: 'changeme');

// Logging helper
function log_msg($msg) {
    error_log("[ws-proxy] " . $msg);
}

// Check if this is a WebSocket upgrade request
function is_websocket_upgrade() {
    return isset($_SERVER['HTTP_UPGRADE']) &&
           strtolower($_SERVER['HTTP_UPGRADE']) === 'websocket';
}

// Check for SSE mode
function is_sse_mode() {
    return isset($_GET['sse']) && $_GET['sse'] === '1';
}

// Get token from query string
function get_token() {
    // Parse token from query string
    $query = $_SERVER['QUERY_STRING'] ?? '';
    parse_str($query, $params);
    return $params['token'] ?? '';
}

// Authenticate request
function authenticate($token) {
    return $token === AUTH_TOKEN;
}

// Return JSON response
function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_PRETTY_PRINT);
    exit;
}

// WebSocket key encoding for Sec-WebSocket-Accept
function ws_encode_key($key) {
    $magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return base64_encode(sha1($key . $magic, true));
}

/**
 * Handle SSE (Server-Sent Events) fallback
 * Polls stats.json and pushes updates to client
 */
function handle_sse() {
    $statsFile = dirname(__DIR__) . '/wali-api/stats.json';
    $lastMtime = 0;
    $lastContent = '';

    // Set SSE headers
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Disable nginx buffering

    // Disable time limit
    set_time_limit(0);

    // Send initial connection message
    echo "event: connected\ndata: {\"status\":\"connected\"}\n\n";
    flush();

    $iterations = 0;
    $maxIterations = 1200; // ~20 minutes at 1s interval

    while ($iterations < $maxIterations) {
        // Check if client disconnected
        if (connection_aborted()) {
            log_msg("SSE client disconnected");
            break;
        }

        // Check stats file
        if (file_exists($statsFile)) {
            $mtime = filemtime($statsFile);

            if ($mtime > $lastMtime) {
                $content = file_get_contents($statsFile);

                if ($content !== $lastContent) {
                    // Send stats update event
                    echo "event: stats_update\n";
                    echo "data: " . $content . "\n\n";
                    flush();

                    $lastContent = $content;
                    $lastMtime = $mtime;
                    log_msg("SSE sent stats update");
                }
            }
        }

        // Wait before next check
        sleep(1);
        $iterations++;
    }

    echo "event: disconnected\ndata: {\"reason\":\"timeout\"}\n\n";
    flush();
    log_msg("SSE connection ended");
}

/**
 * Attempt WebSocket proxy
 * Note: This may not work on all shared hosting environments
 */
function handle_websocket_proxy() {
    $token = get_token();

    if (!authenticate($token)) {
        log_msg("Authentication failed");
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    // Get WebSocket key from client
    $wsKey = $_SERVER['HTTP_SEC_WEBSOCKET_KEY'] ?? '';

    if (empty($wsKey)) {
        log_msg("Missing WebSocket key");
        header('HTTP/1.1 400 Bad Request');
        echo json_encode(['error' => 'Missing WebSocket key']);
        exit;
    }

    // Connect to backend WebSocket server
    $backendUrl = "tcp://" . WS_HOST . ":" . WS_PORT;
    $socket = @stream_socket_client(
        $backendUrl,
        $errno,
        $errstr,
        WS_TIMEOUT,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        log_msg("Failed to connect to backend: $errstr ($errno)");
        header('HTTP/1.1 502 Bad Gateway');
        echo json_encode(['error' => 'Backend unavailable', 'details' => $errstr]);
        exit;
    }

    // Build WebSocket handshake request
    $request = "GET /?token=" . urlencode($token) . "&type=frontend HTTP/1.1\r\n";
    $request .= "Host: " . WS_HOST . ":" . WS_PORT . "\r\n";
    $request .= "Upgrade: websocket\r\n";
    $request .= "Connection: Upgrade\r\n";
    $request .= "Sec-WebSocket-Key: " . $wsKey . "\r\n";
    $request .= "Sec-WebSocket-Version: 13\r\n";
    $request .= "\r\n";

    // Send handshake
    fwrite($socket, $request);

    // Read handshake response
    $response = fread($socket, 4096);

    if (strpos($response, '101') === false) {
        log_msg("Backend handshake failed: " . $response);
        header('HTTP/1.1 502 Bad Gateway');
        echo json_encode(['error' => 'Backend handshake failed']);
        fclose($socket);
        exit;
    }

    // Send 101 Switching Protocols to client
    header('HTTP/1.1 101 Switching Protocols');
    header('Upgrade: websocket');
    header('Connection: Upgrade');
    header('Sec-WebSocket-Accept: ' . ws_encode_key($wsKey));

    // Flush headers
    if (function_exists('fastcgi_finish_request')) {
        // Can't use fastcgi_finish_request here as we need to keep connection
    }

    log_msg("WebSocket proxy established");

    // Proxy data between client and backend
    // Note: This is the tricky part on shared hosting
    // PHP may time out or the connection may be terminated

    stream_set_blocking($socket, 0);
    stream_set_blocking(STDIN, 0);

    $buffer = '';
    $lastActivity = time();

    while (true) {
        // Check timeout
        if (time() - $lastActivity > WS_TIMEOUT) {
            log_msg("WebSocket proxy timeout");
            break;
        }

        // Read from backend
        $data = fread($socket, 8192);
        if ($data !== false && strlen($data) > 0) {
            echo $data;
            flush();
            $lastActivity = time();
            log_msg("Proxied " . strlen($data) . " bytes from backend");
        }

        // Read from client (php://input for WebSocket frames)
        $input = file_get_contents('php://input');
        if ($input !== false && strlen($input) > 0) {
            fwrite($socket, $input);
            $lastActivity = time();
            log_msg("Proxied " . strlen($input) . " bytes from client");
        }

        // Small sleep to prevent busy loop
        usleep(10000); // 10ms
    }

    fclose($socket);
    log_msg("WebSocket proxy closed");
}

// Main handler
try {
    // Check authentication first
    $token = get_token();

    // SSE mode for fallback
    if (is_sse_mode()) {
        if (!authenticate($token)) {
            json_response(['error' => 'Unauthorized'], 401);
        }
        handle_sse();
        exit;
    }

    // WebSocket upgrade
    if (is_websocket_upgrade()) {
        handle_websocket_proxy();
        exit;
    }

    // Regular GET request - return status
    json_response([
        'status' => 'ws-proxy',
        'server' => WS_HOST . ':' . WS_PORT,
        'mode' => 'websocket_or_sse',
        'sse_endpoint' => '?sse=1&token=YOUR_TOKEN',
        'authenticated' => authenticate($token)
    ]);

} catch (Exception $e) {
    log_msg("Error: " . $e->getMessage());
    json_response(['error' => 'Internal error'], 500);
}
