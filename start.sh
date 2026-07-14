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
echo -e "${GREEN} Starting backend on http://localhost:8000${RESET}"

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
  echo -e "${YELLOW}  → creating virtual environment…${RESET}"
  python3 -m venv "$BACKEND_DIR/.venv"
fi

echo -e "${YELLOW}  → installing dependencies…${RESET}"
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

echo -e "${YELLOW}  → seeding dev database…${RESET}"
"$BACKEND_DIR/.venv/bin/python" "$BACKEND_DIR/seed_dev.py"

cd "$BACKEND_DIR"
"$BACKEND_DIR/.venv/bin/uvicorn" app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}  ✓ backend PID $BACKEND_PID${RESET}\n"

# ── 2. Frontend (Vite + React) ───────────────────────────────────────────────
echo -e "${GREEN} Starting frontend on http://localhost:5173${RESET}"

cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  → installing npm packages…${RESET}"
  npm install --legacy-peer-deps
fi

npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}  ✓ frontend PID $FRONTEND_PID${RESET}\n"

# ── 3. ngrok (WhatsApp Bot Webhook) ────────────────────────────────────────────
if [ -f "$REPO_ROOT/ngrok" ]; then
  echo -e "${GREEN} Starting ngrok tunnel on port 8000${RESET}"
  "$REPO_ROOT/ngrok" http 8000 --log=stdout > /tmp/ngrok.log 2>&1 &
  NGROK_PID=$!
  
  # Wait a moment for ngrok to establish the tunnel
  sleep 4
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | "$BACKEND_DIR/.venv/bin/python" -c "import json,sys; d=json.load(sys.stdin); print([t['public_url'] for t in d['tunnels'] if 'https' in t['public_url']][0])" 2>/dev/null || echo "Could not fetch URL")
  
  echo -e "${GREEN}  ✓ ngrok PID $NGROK_PID${RESET}"
  echo -e "${GREEN}  ✓ Public Webhook URL: ${NGROK_URL}/api/whatsapp/webhook${RESET}\n"
fi

# ── 4. Summary ───────────────────────────────────────────────────────────────
echo -e "${BLUE}════════════════════════════════════════════"
echo -e "  Frontend  →  http://localhost:5173"
echo -e "  API docs  →  http://localhost:8000/docs"
echo -e "  Health    →  http://localhost:8000/health"
if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "Could not fetch URL" ]; then
  echo -e "  WhatsApp  →  $NGROK_URL/api/whatsapp/webhook"
fi
echo -e "════════════════════════════════════════════${RESET}"
echo -e "${YELLOW}  Demo OTP: 1234${RESET}"
if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "Could not fetch URL" ]; then
  echo -e "${YELLOW}  Note: If the WhatsApp URL above changed, remember to update it in the Twilio Dashboard!${RESET}"
fi
echo -e "\nPress Ctrl+C to stop all servers.\n"

# ── 5. Wait and clean up ─────────────────────────────────────────────────────
trap "echo -e '\n${YELLOW}Stopping...${RESET}'; kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null; exit 0" INT TERM
wait
