#!/bin/bash
#
# WebSocket Server Management Script
#
# Usage:
#   ./start-ws.sh start   - Start the WebSocket server
#   ./start-ws.sh stop    - Stop the WebSocket server
#   ./start-ws.sh restart - Restart the WebSocket server
#   ./start-ws.sh status  - Check server status
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/ws-server.js"
PID_FILE="${SCRIPT_DIR}/ws-server.pid"
LOG_FILE="${SCRIPT_DIR}/ws-server.log"
PORT="${WS_PORT:-3847}"
NODE_CMD="${NODE_CMD:-node}"

# Check if port is in use
check_port() {
    if lsof -i :$PORT > /dev/null 2>&1; then
        return 0  # Port in use
    else
        return 1  # Port available
    fi
}

# Get PID of process using the port
get_port_pid() {
    lsof -t -i :$PORT 2>/dev/null || echo ""
}

# Check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Start server
start() {
    echo "Starting WebSocket server..."

    # Check if already running
    if is_running; then
        echo "Server is already running (PID: $(cat $PID_FILE))"
        return 0
    fi

    # Check if port is occupied by another process
    if check_port; then
        local port_pid=$(get_port_pid)
        echo "ERROR: Port $PORT is already in use by process $port_pid"
        echo "Run: kill $port_pid  or use a different port (WS_PORT=xxx ./start-ws.sh start)"
        return 1
    fi

    # Check if node is available
    if ! command -v $NODE_CMD &> /dev/null; then
        echo "ERROR: Node.js not found. Please install Node.js or set NODE_CMD"
        return 1
    fi

    # Check if ws npm package is installed
    if [ ! -d "${SCRIPT_DIR}/node_modules/ws" ]; then
        echo "WARNING: 'ws' npm package not found. Installing..."
        cd "$SCRIPT_DIR" && npm install ws --save
    fi

    # Start server in background
    cd "$SCRIPT_DIR"
    nohup $NODE_CMD "$SERVER_SCRIPT" >> "$LOG_FILE" 2>&1 &
    local pid=$!

    # Save PID
    echo $pid > "$PID_FILE"

    # Wait a bit and verify
    sleep 2

    if kill -0 $pid 2>/dev/null && check_port; then
        echo "Server started successfully (PID: $pid)"
        echo "Listening on port $PORT"
        echo "Log file: $LOG_FILE"
        return 0
    else
        echo "ERROR: Server failed to start. Check log file: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Stop server
stop() {
    echo "Stopping WebSocket server..."

    if ! is_running; then
        echo "Server is not running"

        # Check if port is occupied
        if check_port; then
            local port_pid=$(get_port_pid)
            echo "Note: Port $PORT is still in use by process $port_pid"
            echo "You may need to kill it manually: kill $port_pid"
        fi

        rm -f "$PID_FILE"
        return 0
    fi

    local pid=$(cat "$PID_FILE")

    # Try graceful shutdown first
    kill $pid 2>/dev/null

    # Wait up to 5 seconds
    for i in {1..5}; do
        if ! kill -0 $pid 2>/dev/null; then
            break
        fi
        sleep 1
    done

    # Force kill if still running
    if kill -0 $pid 2>/dev/null; then
        echo "Force killing..."
        kill -9 $pid 2>/dev/null
        sleep 1
    fi

    rm -f "$PID_FILE"
    echo "Server stopped"
    return 0
}

# Restart server
restart() {
    echo "Restarting WebSocket server..."
    stop
    sleep 1
    start
}

# Show status
status() {
    echo "WebSocket Server Status"
    echo "======================="
    echo "Port: $PORT"
    echo "PID File: $PID_FILE"
    echo "Log File: $LOG_FILE"
    echo ""

    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "Status: RUNNING (PID: $pid)"

        # Show recent log entries
        if [ -f "$LOG_FILE" ]; then
            echo ""
            echo "Recent log entries:"
            echo "---"
            tail -5 "$LOG_FILE"
        fi
    else
        echo "Status: STOPPED"

        if check_port; then
            local port_pid=$(get_port_pid)
            echo ""
            echo "WARNING: Port $PORT is in use by another process ($port_pid)"
        fi
    fi
}

# Main
case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Environment variables:"
        echo "  WS_PORT      - Port to listen on (default: 3847)"
        echo "  WS_AUTH_TOKEN - Authentication token"
        echo "  NODE_CMD     - Node.js command (default: node)"
        exit 1
        ;;
esac
