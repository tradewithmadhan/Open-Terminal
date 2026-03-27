@echo off
echo ========================================
echo  Open-Terminal — Starting...
echo ========================================
echo.

echo [1/2] Starting Backend (port 8000)...
cd backend
start "Open-Terminal Backend" cmd /k "venv\Scripts\activate && python run.py"
cd ..

echo [2/2] Starting Frontend (port 3000)...
cd frontend
start "Open-Terminal Frontend" cmd /k "npm run dev"
cd ..

echo.
echo Terminal will be available at http://localhost:3000
echo Make sure OpenAlgo is running at http://127.0.0.1:5000
echo.
pause
