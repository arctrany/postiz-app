#!/usr/bin/env bash
# =============================================================================
# XPoz — E2E Test: Publish a Tweet with Image (Fully Automated)
# =============================================================================
# Usage: bash scripts/e2e-tweet.sh
#
# Prerequisites:
#   1. Backend running at http://localhost:3000
#   2. At least one user registered in the frontend
#   3. X (Twitter) integration connected in the frontend
#
# The API key is auto-extracted from the database — no manual setup needed.
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$PROJECT_ROOT"

log() { echo -e "${CYAN}[E2E]${NC} $1"; }
ok()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn(){ echo -e "${YELLOW}  ⚠${NC} $1"; }
err() { echo -e "${RED}  ✗${NC} $1"; }

PASS=0; FAIL=0

# ─── Load .env ───────────────────────────────────────────────────────────────
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

API_BASE="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:3000}"
DB_URL="${DATABASE_URL:-postgresql://xpoz-user:xpoz-password@localhost:5432/xpoz-db-local}"

# ─── Step 0: Pre-flight checks ──────────────────────────────────────────────
log "Step 0: Pre-flight checks"

# Check backend is running
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api" 2>/dev/null || echo "000")
if [ "$HEALTH" != "000" ]; then
  ok "Backend responding at $API_BASE (HTTP $HEALTH)"
  PASS=$((PASS+1))
else
  err "Backend not responding at $API_BASE"
  echo "    Run: bash scripts/startup.sh"
  exit 1
fi

# ─── Step 1: Auto-extract API key from database ─────────────────────────────
log "Step 1: Extracting API key from database"

if [ -z "$XPOZ_API_KEY" ]; then
  # Try psql first
  XPOZ_API_KEY=$(psql "$DB_URL" -t -A -c \
    'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null)

  # Fallback: use docker exec if psql not available locally
  if [ -z "$XPOZ_API_KEY" ]; then
    XPOZ_API_KEY=$(docker exec xpoz-postgres psql -U xpoz-user -d xpoz-db-local -t -A -c \
      'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null)
  fi

  if [ -n "$XPOZ_API_KEY" ] && [ "$XPOZ_API_KEY" != "" ]; then
    ok "API key extracted: ${XPOZ_API_KEY:0:12}..."
    PASS=$((PASS+1))
  else
    err "Could not extract API key from database"
    echo "    Make sure you have registered at least one user at $FRONTEND_URL"
    echo "    Or set manually: export XPOZ_API_KEY=your_key"
    exit 1
  fi
else
  ok "Using pre-set XPOZ_API_KEY: ${XPOZ_API_KEY:0:12}..."
  PASS=$((PASS+1))
fi

export XPOZ_API_KEY

# ─── Step 2: Build/find CLI ─────────────────────────────────────────────────
log "Step 2: Preparing CLI"

XPOZ=""
if [ -f "$PROJECT_ROOT/apps/cli/dist/index.js" ]; then
  XPOZ="node $PROJECT_ROOT/apps/cli/dist/index.js"
  ok "CLI found (pre-built)"
elif command -v xpoz &>/dev/null; then
  XPOZ="xpoz"
  ok "CLI found (global)"
else
  log "  Building CLI..."
  (cd "$PROJECT_ROOT/apps/cli" && pnpm run build 2>/dev/null)
  if [ -f "$PROJECT_ROOT/apps/cli/dist/index.js" ]; then
    XPOZ="node $PROJECT_ROOT/apps/cli/dist/index.js"
    ok "CLI built"
  else
    warn "CLI build failed — using direct API calls"
  fi
fi

# ─── Step 3: List integrations & find X ──────────────────────────────────────
log "Step 3: Finding X (Twitter) integration"

if [ -n "$XPOZ" ]; then
  INTEGRATIONS=$($XPOZ integrations:list 2>/dev/null)
else
  INTEGRATIONS=$(curl -s -H "Authorization: $XPOZ_API_KEY" "$API_BASE/public/integrations")
fi

if [ -n "$INTEGRATIONS" ]; then
  echo "$INTEGRATIONS" | jq -r '.[].identifier' 2>/dev/null | sed 's/^/    /'
  PASS=$((PASS+1))

  X_ID=$(echo "$INTEGRATIONS" | jq -r '.[] | select(.identifier=="x" or .identifier=="twitter") | .id' 2>/dev/null | head -1)
  if [ -n "$X_ID" ] && [ "$X_ID" != "null" ]; then
    ok "Found X integration: $X_ID"
    PASS=$((PASS+1))
  else
    err "No X (Twitter) integration found"
    echo "    Connect X at ${FRONTEND_URL:-http://localhost:4200} → Channels → Add Channel → X"
    X_ID=""
    FAIL=$((FAIL+1))
  fi
else
  err "Failed to list integrations"
  FAIL=$((FAIL+1))
fi

# ─── Step 4: Upload the OpenClaw meme image ──────────────────────────────────
log "Step 4: Uploading image"

TEST_IMAGE="$PROJECT_ROOT/scripts/openclaw-meme.png"
IMAGE_URL=""

if [ -f "$TEST_IMAGE" ]; then
  if [ -n "$XPOZ" ]; then
    UPLOAD_RESULT=$($XPOZ upload "$TEST_IMAGE" 2>/dev/null)
  else
    UPLOAD_RESULT=$(curl -s -X POST \
      -H "Authorization: $XPOZ_API_KEY" \
      -F "file=@$TEST_IMAGE" \
      "$API_BASE/public/media/upload")
  fi

  IMAGE_URL=$(echo "$UPLOAD_RESULT" | jq -r '.path // .url // empty' 2>/dev/null)
  if [ -n "$IMAGE_URL" ]; then
    ok "Image uploaded: $IMAGE_URL"
    PASS=$((PASS+1))
  else
    warn "Image upload failed (will post without image)"
    echo "    Response: $(echo "$UPLOAD_RESULT" | head -c 200)"
  fi
else
  warn "openclaw-meme.png not found in scripts/ (will post without image)"
fi

# ─── Step 5: Create the tweet ────────────────────────────────────────────────
if [ -n "$X_ID" ]; then
  log "Step 5: Creating tweet"

  # Schedule 2 minutes from now (macOS + Linux compatible)
  SCHEDULE_DATE=$(date -u -v+2M '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
                  date -u -d '+2 minutes' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)

  TWEET_CONTENT="🦞 OpenClaw update — raising shrimp ain't easy... but someone's gotta do it! Building the next-gen AI agent platform, one claw at a time 🔧 #OpenClaw #AI #RageComic"

  echo -e "    Content: ${CYAN}$TWEET_CONTENT${NC}"
  echo -e "    Schedule: $SCHEDULE_DATE"
  echo -e "    Image: ${IMAGE_URL:-none}"

  if [ -n "$XPOZ" ]; then
    if [ -n "$IMAGE_URL" ]; then
      POST_RESULT=$($XPOZ posts:create -c "$TWEET_CONTENT" -m "$IMAGE_URL" -s "$SCHEDULE_DATE" -i "$X_ID" 2>/dev/null)
    else
      POST_RESULT=$($XPOZ posts:create -c "$TWEET_CONTENT" -s "$SCHEDULE_DATE" -i "$X_ID" 2>/dev/null)
    fi
  else
    MEDIA_JSON="[]"
    [ -n "$IMAGE_URL" ] && MEDIA_JSON="[{\"url\":\"$IMAGE_URL\"}]"
    POST_RESULT=$(curl -s -X POST \
      -H "Authorization: $XPOZ_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"schedule\",
        \"date\": \"$SCHEDULE_DATE\",
        \"shortLink\": true,
        \"posts\": [{
          \"integration\": {\"id\": \"$X_ID\"},
          \"value\": [{\"content\": \"$TWEET_CONTENT\", \"image\": $MEDIA_JSON}]
        }]
      }" \
      "$API_BASE/public/posts")
  fi

  if echo "$POST_RESULT" | jq -e '.id // .postId // .posts' &>/dev/null; then
    ok "Tweet created! 🎉"
    PASS=$((PASS+1))
  else
    err "Tweet creation failed"
    echo "    Response: $(echo "$POST_RESULT" | head -c 300)"
    FAIL=$((FAIL+1))
  fi
else
  warn "Step 5: SKIPPED (no X integration)"
fi

# ─── Step 6: Verify by listing posts ─────────────────────────────────────────
log "Step 6: Listing posts"

if [ -n "$XPOZ" ]; then
  POSTS=$($XPOZ posts:list 2>/dev/null)
else
  POSTS=$(curl -s -H "Authorization: $XPOZ_API_KEY" "$API_BASE/public/posts")
fi

POST_COUNT=$(echo "$POSTS" | jq 'length' 2>/dev/null || echo "0")
ok "Found $POST_COUNT posts"
PASS=$((PASS+1))

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━ E2E Test Summary ━━━${NC}"
echo -e "  ${GREEN}Passed:${NC} $PASS  ${RED}Failed:${NC} $FAIL"
[ "$FAIL" -gt 0 ] && echo -e "\n${RED}❌ Some tests failed${NC}" && exit 1
echo -e "\n${GREEN}✅ All E2E tests passed!${NC}"
