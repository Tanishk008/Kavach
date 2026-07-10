#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kavach — start both backend and frontend locally (no Docker needed)
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"

# ── colours ──────────────────────────────────────────────────────────────────
BLUE="\033[1;34m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo -e "\n${BLUE}╔══════════════════════════════════════════╗"
echo -e "║        Kavach — Local Dev Server         ║"
echo -e "╚══════════════════════════════════════════╝${RESET}\n"

# ── 1. Backend (FastAPI + SQLite) ────────────────────────────────────────────
echo -e "${GREEN}▶ Starting backend on http://localhost:8000${RESET}"

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
  echo -e "${YELLOW}  → creating virtual environment…${RESET}"
  python3 -m venv "$BACKEND_DIR/.venv"
fi

echo -e "${YELLOW}  → installing dependencies…${RESET}"
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

cd "$BACKEND_DIR"
"$BACKEND_DIR/.venv/bin/uvicorn" app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}  ✓ backend PID $BACKEND_PID${RESET}\n"

# ── 2. Frontend (Vite + React) ───────────────────────────────────────────────
echo -e "${GREEN}▶ Starting frontend on http://localhost:5173${RESET}"

cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  → installing npm packages…${RESET}"
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}  ✓ frontend PID $FRONTEND_PID${RESET}\n"

# ── 3. Summary ───────────────────────────────────────────────────────────────
echo -e "${BLUE}════════════════════════════════════════════"
echo -e "  Frontend  →  http://localhost:5173"
echo -e "  API docs  →  http://localhost:8000/docs"
echo -e "  Health    →  http://localhost:8000/health"
echo -e "════════════════════════════════════════════${RESET}"
echo -e "${YELLOW}  Demo OTP: 1234${RESET}\n"
echo -e "Press Ctrl+C to stop both servers.\n"

# ── 4. Wait and clean up ─────────────────────────────────────────────────────
trap "echo -e '\n${YELLOW}Stopping...${RESET}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
