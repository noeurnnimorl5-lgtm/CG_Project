#!/bin/bash
# setup.sh — One-time setup for Smart Attendance System

echo "========================================"
echo "  Smart Attendance System — Setup"
echo "========================================"

# ── Backend ──────────────────────────────────
echo ""
echo "📦 Setting up Python backend..."
cd backend

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Backend dependencies installed"
cd ..

# ── Frontend ─────────────────────────────────
echo ""
echo "📦 Setting up React frontend..."
cd frontend

npm install

echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "========================================"
echo "  Setup complete! Run the app:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd backend && source venv/bin/activate"
echo "    python main.py"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Open: http://localhost:5173"
echo "  API:  http://localhost:8000/docs"
echo "========================================"
