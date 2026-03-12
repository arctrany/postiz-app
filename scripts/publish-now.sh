#!/usr/bin/env bash
set -euo pipefail

# ─── publish-now.sh ─────────────────────────────────────────────────────────
# Immediately publish queued posts by starting the orchestrator worker.
# Usage: bash scripts/publish-now.sh
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Load .env
if [ -f .env ]; then
  set -a; source .env; set +a
  echo "✓ Loaded .env"
fi

API_KEY="${XPOZ_API_KEY:-}"
API_BASE="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:3333}"

# ─── Step 1: Auto-extract API key from DB if not set ─────────────────────────
if [ -z "$API_KEY" ]; then
  echo "⏳ Extracting API key from database..."
  DB_URL="${DATABASE_URL:-postgresql://xpoz-user:xpoz-password@localhost:5432/xpoz-db-local}"
  
  # Try psql directly, fallback to docker exec
  if command -v psql &>/dev/null; then
    API_KEY=$(psql "$DB_URL" -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null || true)
  fi
  
  if [ -z "$API_KEY" ]; then
    # Extract DB creds from DATABASE_URL for docker
    DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    CONTAINER=$(docker ps --format '{{.Names}}' | grep -i 'xpoz.*postgres\|postiz.*postgres' | head -1)
    if [ -n "$CONTAINER" ]; then
      API_KEY=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null || true)
    fi
  fi
  
  if [ -z "$API_KEY" ]; then
    echo "❌ Could not extract API key. Set XPOZ_API_KEY manually."
    exit 1
  fi
  echo "✓ API key: ${API_KEY:0:8}...${API_KEY: -4}"
fi

# ─── Step 2: Check queued posts ──────────────────────────────────────────────
echo ""
echo "📋 Checking queued posts..."
POSTS=$(curl -s -H "Authorization: $API_KEY" \
  "$API_BASE/public/v1/posts?startDate=2020-01-01T00:00:00Z&endDate=2030-01-01T00:00:00Z")

QUEUED=$(echo "$POSTS" | python3 -c "
import json,sys
data = json.load(sys.stdin)
posts = data.get('posts', data) if isinstance(data, dict) else data
queued = [p for p in posts if p.get('state') == 'QUEUE']
for p in queued:
    print(f\"  📝 {p['id'][:12]}... | {p.get('content','')[:60]}\")
print(f'TOTAL_QUEUED={len(queued)}')
" 2>/dev/null)

echo "$QUEUED"

COUNT=$(echo "$QUEUED" | grep -o 'TOTAL_QUEUED=[0-9]*' | cut -d= -f2)
if [ "${COUNT:-0}" -eq 0 ]; then
  echo "✓ No queued posts — all published or empty."
  exit 0
fi

# ─── Step 3: Start orchestrator to process queued posts ──────────────────────
echo ""
echo "🚀 Starting orchestrator worker to process ${COUNT} queued post(s)..."
echo "   This will connect to Temporal and execute the scheduled posts."
echo ""

# Run orchestrator in background, wait for posts to be delivered
pnpm run dev:orchestrator &
ORCH_PID=$!

echo "   Orchestrator PID: $ORCH_PID"
echo "   Waiting up to 60 seconds for posts to be delivered..."

for i in $(seq 1 12); do
  sleep 5
  STATE=$(curl -s -H "Authorization: $API_KEY" \
    "$API_BASE/public/v1/posts?startDate=2020-01-01T00:00:00Z&endDate=2030-01-01T00:00:00Z" | \
    python3 -c "
import json,sys
data = json.load(sys.stdin)
posts = data.get('posts', data) if isinstance(data, dict) else data
queued = [p for p in posts if p.get('state') == 'QUEUE']
published = [p for p in posts if p.get('state') == 'PUBLISHED']
print(f'queued={len(queued)} published={len(published)}')
for p in published:
    url = p.get('releaseURL', 'N/A')
    if url and url != 'N/A':
        print(f'  🌐 {url}')
" 2>/dev/null)
  
  echo "   [${i}/12] $STATE"
  
  # Check if all published
  Q=$(echo "$STATE" | head -1 | grep -o 'queued=[0-9]*' | cut -d= -f2)
  if [ "${Q:-1}" -eq 0 ]; then
    echo ""
    echo "✅ All posts published! Check your X/Twitter profile."
    kill $ORCH_PID 2>/dev/null || true
    exit 0
  fi
done

echo ""
echo "⚠️  Timeout — orchestrator may still be processing."
echo "   Check your X/Twitter profile manually."
echo "   To stop orchestrator: kill $ORCH_PID"
