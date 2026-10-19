#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BACKEND_PORT=3003
FRONTEND_PORT=5175

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="$(basename "$SCRIPT_DIR")"
cd "$SCRIPT_DIR" || exit 1

# Load nvm so npm/node are on PATH in this non-interactive shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Detect Windows (Git Bash / MSYS / Cygwin) - lsof is not available there
IS_WINDOWS=false
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=true ;;
esac

echo -e "${YELLOW}⚡ Starting EnergyPlus Application (Backend + Frontend)...${NC}"

# Print PIDs listening on a port (cross-platform)
get_port_pids() {
    local port=$1
    if $IS_WINDOWS; then
        netstat -ano 2>/dev/null \
            | grep -i "LISTENING" \
            | awk -v p=":$port" '$2 ~ p"$" {print $NF}' \
            | grep -v '^0$' | sort -u
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null
    elif command -v fuser >/dev/null 2>&1; then
        fuser "$port"/tcp 2>/dev/null
    fi
}

# Function to check if a port is in use
check_port() {
    [ -n "$(get_port_pids "$1")" ]
}

# Kill whatever is listening on a port (including child processes on Windows)
kill_port() {
    local port=$1
    local pids
    pids=$(get_port_pids "$port")
    [ -z "$pids" ] && return 0
    for pid in $pids; do
        if $IS_WINDOWS; then
            taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
        else
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
}

# Kill leftover node processes of THIS project (nodemon / ts-node / vite)
# so an orphaned nodemon cannot restart the backend and re-grab the port.
kill_project_node() {
    if $IS_WINDOWS; then
        powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and (\$_.CommandLine -like '*${PROJECT_NAME}\\backend\\node_modules*' -or \$_.CommandLine -like '*${PROJECT_NAME}\\frontend\\node_modules*') } | ForEach-Object { taskkill /PID \$_.ProcessId /T /F | Out-Null }" >/dev/null 2>&1 || true
    else
        pkill -9 -f "${SCRIPT_DIR}/backend/node_modules" 2>/dev/null || true
        pkill -9 -f "${SCRIPT_DIR}/frontend/node_modules" 2>/dev/null || true
    fi
}

# Wait until a port is free (max ~10s)
wait_port_free() {
    local port=$1
    for _ in $(seq 1 20); do
        check_port "$port" || return 0
        sleep 0.5
    done
    return 1
}

# Clean up any existing processes on the backend / frontend ports
echo -e "${YELLOW}🧹 Cleaning up previous instances...${NC}"
kill_project_node
for port in $BACKEND_PORT $FRONTEND_PORT; do
    if check_port "$port"; then
        echo -e "${RED}⚠️ Port $port is already in use. Cleaning up...${NC}"
        kill_port "$port"
    fi
    if ! wait_port_free "$port"; then
        echo -e "${RED}❌ Port $port is still in use. Please free it manually.${NC}"
        exit 1
    fi
done

# Function to handle script termination
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all running servers...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill -9 "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill -9 "$FRONTEND_PID" 2>/dev/null || true
    fi
    # On Windows, killing the bash job does not kill node children - clean by port too
    kill_project_node
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    echo -e "${GREEN}✅ Stopped backend and frontend successfully.${NC}"
    exit 0
}

# Trap Ctrl+C (SIGINT), SIGTERM and closing the terminal window (SIGHUP)
trap cleanup SIGINT SIGTERM SIGHUP

# Start Backend
echo -e "${BLUE}📦 Starting Backend Server with Nodemon (Port $BACKEND_PORT)...${NC}"
cd backend
npm run dev:watch &
BACKEND_PID=$!
cd ..

# Wait a second for backend to boot up
sleep 1.5

# Start Frontend (strictPort: fail instead of silently switching to 5176)
echo -e "${BLUE}🎨 Starting Frontend Dev Server (Port $FRONTEND_PORT)...${NC}"
cd frontend
npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT --strictPort &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}🚀 EnergyPlus is ready!${NC}"
echo -e "${GREEN}👉 Backend:  http://localhost:$BACKEND_PORT${NC}"
echo -e "${GREEN}👉 Frontend: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${YELLOW}Press [Ctrl+C] to stop both servers.${NC}\n"

# Wait for background processes to keep shell active
wait
