#!/bin/bash
echo "========================================"
echo " Open-Terminal — Starting..."
echo "========================================"
echo ""

echo "[1/2] Starting Backend (port 8000)..."
cd backend
source venv/bin/activate
python run.py &
BACKEND_PID=$!
cd ..

echo "[2/2] Starting Frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Terminal: http://localhost:3000"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
