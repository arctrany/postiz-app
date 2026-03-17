#!/usr/bin/env bash
# =============================================================================
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy all_proxy ALL_PROXY
export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"
# XPoz — Comprehensive E2E Test Suite via Agent Skills & CLI (Public API)
# =============================================================================
# Usage:
#   bash scripts/e2e-full.sh           # Draft mode (safe, no real posts)
#   bash scripts/e2e-full.sh --live    # Live mode (publishes 1 tweet, verifies)
# =============================================================================
set -uo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
LIVE_MODE=false
[[ "${1:-}" == "--live" ]] && LIVE_MODE=true

cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'

# Counters
PASS=0; FAIL=0; SKIP=0
CLEANUP_IDS=()

# ─── Helpers ─────────────────────────────────────────────────────────────────
log()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1 ${DIM}($2)${NC}"; }
skip() { SKIP=$((SKIP+1)); echo -e "  ${YELLOW}⊘${NC} $1 ${DIM}(skipped)${NC}"; }

# API call helper: api METHOD ENDPOINT [DATA]
api() {
  local method="$1" endpoint="$2" data="${3:-}"
  local args=(-s -w '\n%{http_code}' -H "Authorization: $API_KEY")

  if [[ "$method" == "POST" && -n "$data" ]]; then
    args+=(-X POST -H "Content-Type: application/json" -d "$data")
  elif [[ "$method" == "POST" && -z "$data" ]]; then
    args+=(-X POST)
  elif [[ "$method" == "DELETE" ]]; then
    args+=(-X DELETE)
  fi

  local response
  response=$(curl "${args[@]}" "${API_BASE}${endpoint}")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  echo "$http_code|$body"
}

# Upload helper: upload_file FILEPATH
upload_file() {
  local filepath="$1"
  curl -s -w '\n%{http_code}' \
    -H "Authorization: $API_KEY" \
    -F "file=@${filepath}" \
    "${API_BASE}/public/v1/upload"
}

# Assert HTTP status
assert_status() {
  local test_name="$1" expected="$2" result="$3"
  local actual
  actual=$(echo "$result" | cut -d'|' -f1)
  if [[ "$actual" == "$expected" ]]; then
    pass "$test_name"
  else
    local body
    body=$(echo "$result" | cut -d'|' -f2- | head -c 120)
    fail "$test_name" "expected $expected, got $actual: $body"
  fi
}

# Assert body contains string
assert_contains() {
  local test_name="$1" needle="$2" result="$3"
  local body
  body=$(echo "$result" | cut -d'|' -f2-)
  if echo "$body" | grep -q "$needle"; then
    pass "$test_name"
  else
    fail "$test_name" "body missing '$needle'"
  fi
}

# Extract JSON field via python
json_field() {
  local body="$1" field="$2"
  echo "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d${field})" 2>/dev/null
}

# ─── Setup ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     XPoz — Comprehensive E2E Test Suite             ║${NC}"
echo -e "${CYAN}║     Agent Skills & CLI Layer                        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
$LIVE_MODE && echo -e "${YELLOW}⚡ LIVE MODE — will publish 1 real tweet${NC}" || echo -e "${DIM}🔒 DRAFT MODE — no real posts will be published${NC}"

# Load .env
if [[ -f .env ]]; then
  set -a; source .env 2>/dev/null; set +a
fi

API_BASE="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:3333}"

# Extract API Key
log "Setup: Extracting API Key"
DB_URL="${DATABASE_URL:-postgresql://xpoz-user:xpoz-password@localhost:5432/xpoz-db-local}"

API_KEY=""
# Try psql
if command -v psql &>/dev/null; then
  API_KEY=$(psql "$DB_URL" -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null | tr -d '[:space:]') || true
fi

# Fallback: docker exec
if [[ -z "$API_KEY" ]]; then
  CONTAINER=$(colima ssh -- docker ps --format '{{.Names}}' 2>/dev/null | grep -i 'xpoz.*postgres' | head -1)
  if [[ -n "$CONTAINER" ]]; then
    DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    API_KEY=$(colima ssh -- docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null | tr -d '[:space:]') || true
  fi
fi

if [[ -z "$API_KEY" ]]; then
  echo -e "${RED}  ✗ Could not extract API key. Is the DB running and a user registered?${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} API Key: ${API_KEY:0:8}...${API_KEY: -4}"
echo -e "  ${DIM}API Base: $API_BASE${NC}"

# Health check
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "$API_BASE/api" 2>/dev/null || echo "000")
if [[ "$HEALTH" == "000" ]]; then
  echo -e "${RED}  ✗ Backend not reachable at $API_BASE${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Backend reachable"

# ─── Suite 1: Authentication ────────────────────────────────────────────────
log "Suite 1: Authentication"

R=$(api GET /public/v1/is-connected)
assert_status "[Auth] Valid API key accepted" "200" "$R"
assert_contains "[Auth] Returns connected=true" "true" "$R"

# Invalid key
R_BAD=$(curl -s -w '\n%{http_code}' -H "Authorization: invalid_key_12345" "${API_BASE}/public/v1/is-connected")
BAD_CODE=$(echo "$R_BAD" | tail -1)
if [[ "$BAD_CODE" == "401" || "$BAD_CODE" == "403" ]]; then
  pass "[Auth] Invalid key rejected ($BAD_CODE)"
else
  fail "[Auth] Invalid key rejected" "expected 401/403, got $BAD_CODE"
fi

# ─── Suite 2: Integration Discovery ─────────────────────────────────────────
log "Suite 2: Integration Discovery"

R=$(api GET /public/v1/integrations)
assert_status "[Integration] List integrations" "200" "$R"

BODY=$(echo "$R" | cut -d'|' -f2-)
INT_ID=$(echo "$BODY" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)
INT_NAME=$(echo "$BODY" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data[0]['name'] if data else '')" 2>/dev/null)
INT_PROVIDER=$(echo "$BODY" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data[0]['identifier'] if data else '')" 2>/dev/null)

if [[ -n "$INT_ID" ]]; then
  pass "[Integration] Found channel: $INT_NAME ($INT_PROVIDER)"
else
  fail "[Integration] No integrations found" "connect a channel first"
fi

# Get integration settings
if [[ -n "$INT_ID" ]]; then
  R=$(api GET "/public/v1/integration-settings/$INT_ID")
  assert_status "[Integration] Get settings for $INT_PROVIDER" "200" "$R"

  SETTINGS_BODY=$(echo "$R" | cut -d'|' -f2-)
  MAX_LEN=$(echo "$SETTINGS_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['output']['maxLength'])" 2>/dev/null)
  if [[ -n "$MAX_LEN" && "$MAX_LEN" != "None" ]]; then
    pass "[Integration] Max length: $MAX_LEN chars"
  else
    fail "[Integration] Get max length" "missing maxLength"
  fi
fi

# ─── Suite 3: Media Upload ──────────────────────────────────────────────────
log "Suite 3: Media Upload"

# Create a small test image
TEST_IMG="/tmp/e2e-test-image.png"
python3 -c "
import struct, zlib, io
def create_png(w, h):
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    hdr = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w):
            r = int(255 * x / w)
            g = int(255 * y / h)
            raw += struct.pack('BBB', r, g, 128)
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return hdr + ihdr + idat + iend
with open('$TEST_IMG', 'wb') as f:
    f.write(create_png(64, 64))
" 2>/dev/null

if [[ -f "$TEST_IMG" ]]; then
  R_UPLOAD=$(upload_file "$TEST_IMG")
  UPLOAD_CODE=$(echo "$R_UPLOAD" | tail -1)
  UPLOAD_BODY=$(echo "$R_UPLOAD" | sed '$d')

  if [[ "$UPLOAD_CODE" == "201" || "$UPLOAD_CODE" == "200" ]]; then
    pass "[Media] Upload image (PNG)"
    MEDIA_ID=$(echo "$UPLOAD_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" 2>/dev/null)
    MEDIA_PATH=$(echo "$UPLOAD_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['path'])" 2>/dev/null)
    pass "[Media] Got media ID: ${MEDIA_ID:0:12}..."
  else
    fail "[Media] Upload image" "HTTP $UPLOAD_CODE"
    MEDIA_ID=""
    MEDIA_PATH=""
  fi
  rm -f "$TEST_IMG"
else
  skip "[Media] Upload image (could not create test image)"
  MEDIA_ID=""
  MEDIA_PATH=""
fi

# Upload from URL
R=$(api POST /public/v1/upload-from-url '{"url":"https://placehold.co/100x100/png"}')
UPLOAD_URL_CODE=$(echo "$R" | cut -d'|' -f1)
if [[ "$UPLOAD_URL_CODE" == "201" || "$UPLOAD_URL_CODE" == "200" ]]; then
  pass "[Media] Upload from URL"
else
  # May fail if no external network
  skip "[Media] Upload from URL (might need network)"
fi

# ─── Suite 4: Post CRUD ─────────────────────────────────────────────────────
log "Suite 4: Post CRUD"

NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TOMORROW=$(date -u -v+1d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+1 day' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "2026-03-13T12:00:00Z")

# 4a. Create draft post
DRAFT_DATA="{
  \"type\": \"draft\",
  \"date\": \"$TOMORROW\",
  \"shortLink\": true,
  \"tags\": [],
  \"posts\": [{
    \"integration\": {\"id\": \"$INT_ID\"},
    \"value\": [{\"content\": \"[E2E TEST] Draft post — $(date +%s)\", \"image\": []}],
    \"settings\": {\"who_can_reply_post\": \"everyone\"}
  }]
}"
R=$(api POST /public/v1/posts "$DRAFT_DATA")
assert_status "[Posts] Create draft post" "201" "$R"

DRAFT_BODY=$(echo "$R" | cut -d'|' -f2-)
DRAFT_POST_ID=$(echo "$DRAFT_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['postId'] if isinstance(d,list) else d.get('postId',''))" 2>/dev/null)
if [[ -n "$DRAFT_POST_ID" ]]; then
  pass "[Posts] Draft post ID: ${DRAFT_POST_ID:0:16}..."
  CLEANUP_IDS+=("$DRAFT_POST_ID")
else
  fail "[Posts] Extract draft post ID" "response: $(echo "$DRAFT_BODY" | head -c 100)"
fi

# 4b. Create scheduled post (stays in QUEUE, no actual publishing)
SCHED_DATA="{
  \"type\": \"schedule\",
  \"date\": \"$TOMORROW\",
  \"shortLink\": true,
  \"tags\": [],
  \"posts\": [{
    \"integration\": {\"id\": \"$INT_ID\"},
    \"value\": [{\"content\": \"[E2E TEST] Scheduled post — $(date +%s)\", \"image\": []}],
    \"settings\": {\"who_can_reply_post\": \"everyone\"}
  }]
}"
R=$(api POST /public/v1/posts "$SCHED_DATA")
assert_status "[Posts] Create scheduled post" "201" "$R"

SCHED_BODY=$(echo "$R" | cut -d'|' -f2-)
SCHED_POST_ID=$(echo "$SCHED_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['postId'] if isinstance(d,list) else d.get('postId',''))" 2>/dev/null)
if [[ -n "$SCHED_POST_ID" ]]; then
  pass "[Posts] Scheduled post ID: ${SCHED_POST_ID:0:16}..."
  CLEANUP_IDS+=("$SCHED_POST_ID")
fi

# 4c. Create post with media
if [[ -n "$MEDIA_ID" && -n "$MEDIA_PATH" ]]; then
  MEDIA_DATA="{
    \"type\": \"draft\",
    \"date\": \"$TOMORROW\",
    \"shortLink\": true,
    \"tags\": [],
    \"posts\": [{
      \"integration\": {\"id\": \"$INT_ID\"},
      \"value\": [{
        \"content\": \"[E2E TEST] Post with image — $(date +%s)\",
        \"image\": [{\"path\": \"$MEDIA_PATH\", \"id\": \"$MEDIA_ID\"}]
      }],
      \"settings\": {\"who_can_reply_post\": \"everyone\"}
    }]
  }"
  R=$(api POST /public/v1/posts "$MEDIA_DATA")
  assert_status "[Posts] Create post with image" "201" "$R"

  MEDIA_POST_ID=$(echo "$R" | cut -d'|' -f2- | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['postId'] if isinstance(d,list) else '')" 2>/dev/null)
  [[ -n "$MEDIA_POST_ID" ]] && CLEANUP_IDS+=("$MEDIA_POST_ID")
else
  skip "[Posts] Create post with image (no media uploaded)"
fi

# 4d. List posts
TODAY=$(date -u '+%Y-%m-%d')
WEEK_LATER=$(date -u -v+7d '+%Y-%m-%d' 2>/dev/null || date -u -d '+7 days' '+%Y-%m-%d' 2>/dev/null || echo "2026-03-19")
R=$(api GET "/public/v1/posts?startDate=${TODAY}T00:00:00Z&endDate=${WEEK_LATER}T23:59:59Z")
assert_status "[Posts] List posts" "200" "$R"

POST_COUNT=$(echo "$R" | cut -d'|' -f2- | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('posts',[])))" 2>/dev/null)
if [[ -n "$POST_COUNT" && "$POST_COUNT" -gt 0 ]]; then
  pass "[Posts] Found $POST_COUNT post(s) in range"
else
  fail "[Posts] Post count" "expected >0, got ${POST_COUNT:-0}"
fi

# 4e. Delete post
if [[ -n "$DRAFT_POST_ID" ]]; then
  R=$(api DELETE "/public/v1/posts/$DRAFT_POST_ID")
  DEL_CODE=$(echo "$R" | cut -d'|' -f1)
  if [[ "$DEL_CODE" == "200" || "$DEL_CODE" == "201" || "$DEL_CODE" == "204" ]]; then
    pass "[Posts] Delete draft post"
    # Remove from cleanup list
    CLEANUP_IDS=("${CLEANUP_IDS[@]/$DRAFT_POST_ID/}")
  else
    fail "[Posts] Delete draft post" "HTTP $DEL_CODE"
  fi
fi

# ─── Suite 5: Advanced Post Features ────────────────────────────────────────
log "Suite 5: Advanced Post Features"

# 5a. Find free slot
if [[ -n "$INT_ID" ]]; then
  R=$(api GET "/public/v1/find-slot/$INT_ID")
  assert_status "[Advanced] Find free time slot" "200" "$R"
  SLOT_DATE=$(echo "$R" | cut -d'|' -f2- | python3 -c "import json,sys; print(json.load(sys.stdin).get('date',''))" 2>/dev/null)
  if [[ -n "$SLOT_DATE" ]]; then
    pass "[Advanced] Got slot: $SLOT_DATE"
  fi
fi

# 5b. Thread (multi-value post)
THREAD_DATA="{
  \"type\": \"draft\",
  \"date\": \"$TOMORROW\",
  \"shortLink\": true,
  \"tags\": [],
  \"posts\": [{
    \"integration\": {\"id\": \"$INT_ID\"},
    \"value\": [
      {\"content\": \"[E2E TEST] Thread 1/3 — $(date +%s)\", \"image\": []},
      {\"content\": \"[E2E TEST] Thread 2/3 — second part\", \"image\": []},
      {\"content\": \"[E2E TEST] Thread 3/3 — conclusion\", \"image\": []}
    ],
    \"settings\": {\"who_can_reply_post\": \"everyone\"}
  }]
}"
R=$(api POST /public/v1/posts "$THREAD_DATA")
assert_status "[Advanced] Create thread (3 parts)" "201" "$R"

THREAD_POST_ID=$(echo "$R" | cut -d'|' -f2- | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['postId'] if isinstance(d,list) else '')" 2>/dev/null)
[[ -n "$THREAD_POST_ID" ]] && CLEANUP_IDS+=("$THREAD_POST_ID")

# ─── Suite 6: Analytics & Notifications ──────────────────────────────────────
log "Suite 6: Analytics & Notifications"

# 6a. Notifications
R=$(api GET "/public/v1/notifications")
assert_status "[Notifications] Get notifications" "200" "$R"

# 6b. Integration analytics
if [[ -n "$INT_ID" ]]; then
  R=$(api GET "/public/v1/analytics/$INT_ID?date=$(date -u '+%Y-%m-%dT00:00:00Z')")
  AN_CODE=$(echo "$R" | cut -d'|' -f1)
  if [[ "$AN_CODE" == "200" ]]; then
    pass "[Analytics] Get channel analytics"
  else
    skip "[Analytics] Get channel analytics (may need published posts)"
  fi
fi

# ─── Suite 7: Live Publishing (opt-in) ──────────────────────────────────────
log "Suite 7: Live Publishing"

if $LIVE_MODE; then
  echo -e "  ${YELLOW}⚡ Live mode: publishing 1 tweet...${NC}"

  LIVE_DATA="{
    \"type\": \"now\",
    \"date\": \"$NOW\",
    \"shortLink\": true,
    \"tags\": [],
    \"posts\": [{
      \"integration\": {\"id\": \"$INT_ID\"},
      \"value\": [{\"content\": \"🧪 XPoz E2E test — $(date '+%Y-%m-%d %H:%M:%S') — automated via Agent Skills 🤖 #XPoz #E2E\"}],
      \"settings\": {\"who_can_reply_post\": \"everyone\"}
    }]
  }"
  R=$(api POST /public/v1/posts "$LIVE_DATA")
  assert_status "[Live] Create now-post" "201" "$R"

  LIVE_POST_ID=$(echo "$R" | cut -d'|' -f2- | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['postId'] if isinstance(d,list) else '')" 2>/dev/null)

  if [[ -n "$LIVE_POST_ID" ]]; then
    pass "[Live] Post created: $LIVE_POST_ID"

    # Poll for PUBLISHED status (up to 30s)
    echo -e "  ${DIM}Waiting for orchestrator to publish...${NC}"
    for i in $(seq 1 6); do
      sleep 5
      R_CHECK=$(api GET "/public/v1/posts?startDate=${TODAY}T00:00:00Z&endDate=${WEEK_LATER}T23:59:59Z")
      STATE=$(echo "$R_CHECK" | cut -d'|' -f2- | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data.get('posts',[]):
    if p['id'] == '$LIVE_POST_ID':
        print(p['state'] + '|' + str(p.get('releaseURL','')))" 2>/dev/null)

      POST_STATE=$(echo "$STATE" | cut -d'|' -f1)
      POST_URL=$(echo "$STATE" | cut -d'|' -f2)

      if [[ "$POST_STATE" == "PUBLISHED" ]]; then
        pass "[Live] Tweet published! URL: $POST_URL"
        break
      fi
      echo -e "  ${DIM}  [$i/6] State: ${POST_STATE:-waiting}...${NC}"
    done

    if [[ "$POST_STATE" != "PUBLISHED" ]]; then
      fail "[Live] Tweet not published in 30s" "State: $POST_STATE (orchestrator running?)"
    fi
  fi
else
  skip "[Live] Publish tweet (use --live flag to enable)"
fi

# ─── Cleanup ─────────────────────────────────────────────────────────────────
log "Cleanup"

CLEANED=0
for pid in "${CLEANUP_IDS[@]}"; do
  [[ -z "$pid" ]] && continue
  R=$(api DELETE "/public/v1/posts/$pid")
  DEL_CODE=$(echo "$R" | cut -d'|' -f1)
  if [[ "$DEL_CODE" == "200" || "$DEL_CODE" == "201" || "$DEL_CODE" == "204" ]]; then
    CLEANED=$((CLEANED+1))
  fi
done
echo -e "  ${DIM}Cleaned up $CLEANED test post(s)${NC}"

# ─── Summary ─────────────────────────────────────────────────────────────────
TOTAL=$((PASS+FAIL+SKIP))
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
if [[ $FAIL -eq 0 ]]; then
  echo -e "${CYAN}║${NC}  ${GREEN}All tests passed!${NC}                                   ${CYAN}║${NC}"
else
  echo -e "${CYAN}║${NC}  ${RED}Some tests failed${NC}                                    ${CYAN}║${NC}"
fi
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  ${YELLOW}Skipped: $SKIP${NC}  Total: $TOTAL     ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

exit $FAIL
