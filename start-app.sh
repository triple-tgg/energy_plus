#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚡ Starting EnergyPlus Application (Backend + Frontend)...${NC}"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0 # Port in use
    else
        return 1 # Port free
    fi
}

# Clean up any existing processes on port 3000 or 5173
if check_port 3000; then
    echo -e "${RED}⚠️ Port 3000 is already in use. Cleaning up...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

if check_port 5173; then
    echo -e "${RED}⚠️ Port 5173 is already in use. Cleaning up...${NC}"
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

# Function to handle script termination
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all running servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill -9 $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill -9 $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Stopped backend and frontend successfully.${NC}"
    exit 0
}

# Trap Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${BLUE}📦 Starting Backend Server with Nodemon (Port 3000)...${NC}"
cd backend
npm run dev:watch &
BACKEND_PID=$!
cd ..

# Wait a second for backend to boot up
sleep 1.5

# Start Frontend
echo -e "${BLUE}🎨 Starting Frontend Dev Server (Port 5173)...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}🚀 EnergyPlus is ready!${NC}"
echo -e "${GREEN}👉 Backend:  http://localhost:3000${NC}"
echo -e "${GREEN}👉 Frontend: http://localhost:5173${NC}"
echo -e "${YELLOW}Press [Ctrl+C] to stop both servers.${NC}\n"

# Wait for background processes to keep shell active
wait
