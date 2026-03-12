#!/usr/bin/env bash
# =============================================================================
# XPoz — Complete Startup Script
# =============================================================================
# Usage: bash scripts/startup.sh
#
# This script:
#   1. Creates .env from .env.example (if not exists)
#   2. Starts PostgreSQL + Redis via Docker
#   3. Runs Prisma migrations
#   4. Starts backend + frontend dev servers
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$PROJECT_ROOT"
log() { echo -e "${CYAN}[XPoz]${NC} $1"; }
ok()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn(){ echo -e "${YELLOW}  ⚠${NC} $1"; }
err() { echo -e "${RED}  ✗${NC} $1"; }

# ─── Step 1: .env ───────────────────────────────────────────────────────────
log "Step 1: Checking .env"
if [ -f .env ]; then
  ok ".env already exists"
else
  cp .env.example .env
  ok "Created .env from .env.example"
  warn "Edit .env to set your API keys (X, OpenAI, etc.)"
fi

# Generate a random JWT_SECRET if still default
if grep -q 'random string for your JWT' .env 2>/dev/null; then
  JWT=$(openssl rand -hex 32)
  sed -i.bak "s|random string for your JWT secret, make it long|${JWT}|" .env && rm -f .env.bak
  ok "Generated random JWT_SECRET"
fi

# ─── Step 2: Docker services ────────────────────────────────────────────────
log "Step 2: Starting Docker services (PostgreSQL + Redis)"

# Check Docker
if ! command -v docker &> /dev/null; then
  err "Docker not found. Please install Docker Desktop first."
  exit 1
fi

# Start only DB and Redis from docker-compose
if docker compose ps 2>/dev/null | grep -q "xpoz-postgres.*running"; then
  ok "PostgreSQL already running"
else
  docker compose up -d xpoz-postgres xpoz-redis 2>/dev/null || \
  docker-compose up -d xpoz-postgres xpoz-redis 2>/dev/null
  if [ $? -eq 0 ]; then
    ok "PostgreSQL + Redis started"
    log "  Waiting 5s for DB to be ready..."
    sleep 5
  else
    err "Failed to start Docker services"
    echo "    Make sure docker-compose.yaml has xpoz-postgres and xpoz-redis services"
    exit 1
  fi
fi

# ─── Step 3: Prisma setup ────────────────────────────────────────────────────
log "Step 3: Running Prisma DB setup"
if pnpm run prisma-db-push 2>&1 | tail -3; then
  ok "Prisma db push succeeded"
else
  err "Prisma db push failed — check DATABASE_URL in .env"
  exit 1
fi

pnpm run prisma-generate 2>&1 | tail -2
ok "Prisma client generated"

# ─── Step 4: Start dev servers ───────────────────────────────────────────────
log "Step 4: Starting dev servers (backend + frontend + orchestrator)"
echo ""
echo -e "${GREEN}━━━ Starting all services ━━━${NC}"
echo -e "  Backend:      ${CYAN}http://localhost:3333${NC}"
echo -e "  Frontend:     ${CYAN}http://localhost:4200${NC}"
echo -e "  Orchestrator: ${CYAN}Temporal worker (processes scheduled posts)${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all servers"
echo ""

# Run all three with concurrently or in background
if command -v npx &> /dev/null && npx --no-install concurrently --version &> /dev/null; then
  npx concurrently --names "backend,frontend,orchestrator" --prefix-colors "blue,magenta,green" \
    "pnpm run dev:backend" \
    "pnpm run dev:frontend" \
    "pnpm run dev:orchestrator"
else
  # Fallback: start in background
  pnpm run dev:backend &
  BACKEND_PID=$!
  pnpm run dev:frontend &
  FRONTEND_PID=$!
  pnpm run dev:orchestrator &
  ORCH_PID=$!
  
  trap "kill $BACKEND_PID $FRONTEND_PID $ORCH_PID 2>/dev/null; exit" INT TERM
  wait
fi

