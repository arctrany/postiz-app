#!/usr/bin/env bash
# ==========================================================================
# XSync Bridge E2E All-in-One Test Runner
# Run this from a normal terminal (NOT inside sandbox)
# ==========================================================================
set -euo pipefail

PROJECT_DIR="/Users/haowu/IdealProjects/arctrany/postiz-app"
cd "$PROJECT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; PASSED=$((PASSED+1)); }
fail() { echo -e "${RED}❌ FAIL${NC}: $1 — $2"; FAILED=$((FAILED+1)); }
info() { echo -e "${YELLOW}ℹ️  ${NC} $1"; }
header() { echo -e "\n${CYAN}=== $1 ===${NC}"; }
PASSED=0; FAILED=0

echo "========================================"
echo "  XSync Bridge E2E Test Runner"
echo "========================================"

# ---- Step 0: Ensure DB has PENDING_EXTENSION enum ----
header "Step 0: Database Migration"
source .env 2>/dev/null || true
export PGPASSWORD='postiz-local-pwd'
DB_HOST=localhost DB_PORT=5432 DB_USER=postiz-local DB_NAME=postiz-db-local

HAS_ENUM=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \
  "SELECT COUNT(*) FROM pg_enum WHERE enumlabel = 'PENDING_EXTENSION' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'State');" 2>/dev/null || echo "0")

if [ "$HAS_ENUM" = "0" ]; then
  info "Adding PENDING_EXTENSION to State enum..."
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
    "ALTER TYPE \"State\" ADD VALUE IF NOT EXISTS 'PENDING_EXTENSION';" 2>/dev/null
  pass "PENDING_EXTENSION added to DB"
else
  info "PENDING_EXTENSION already exists in DB ✓"
fi

# ---- Step 1: Start servers if not running ----
header "Step 1: Check/Start Services"
BACKEND_RUNNING=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333 2>/dev/null || echo "000")
if [ "$BACKEND_RUNNING" = "000" ]; then
  info "Starting backend + orchestrator + frontend (skipping extension)..."
  pnpm run --filter ./apps/backend --filter ./apps/orchestrator --filter ./apps/frontend --parallel dev &
  DEV_PID=$!
  
  info "Waiting for backend to start..."
  for i in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:3333 2>/dev/null; then
      info "Backend started after ${i}s"
      break
    fi
    sleep 1
  done
  
  # Verify
  BACKEND_RUNNING=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333 2>/dev/null || echo "000")
  if [ "$BACKEND_RUNNING" = "000" ]; then
    echo -e "${RED}ERROR: Backend failed to start${NC}"
    exit 1
  fi
else
  info "Backend already running ✓"
fi

# ---- Step 2: Create test data ----
header "Step 2: Test Data Setup"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<'SQL' 2>/dev/null
-- Clean up old test data
DELETE FROM "Post" WHERE id LIKE 'e2e-test-xsync-%';

-- Create PENDING_EXTENSION test post
INSERT INTO "Post" (id, content, state, "publishDate", "organizationId", "integrationId", "group", "approvedSubmitForOrder", delay, "createdAt", "updatedAt")
SELECT 'e2e-test-xsync-001', '[E2E] 桥接测试', 'PENDING_EXTENSION'::"State", NOW(), o.id, i.id, 'e2e-grp-001', 'NO'::"APPROVED_SUBMIT_FOR_ORDER", 0, NOW(), NOW()
FROM "Integration" i, (SELECT id FROM "Organization" LIMIT 1) o
WHERE i."providerIdentifier" = 'x' AND i."deletedAt" IS NULL LIMIT 1;

-- Create PUBLISHED control post
INSERT INTO "Post" (id, content, state, "publishDate", "organizationId", "integrationId", "group", "approvedSubmitForOrder", delay, "createdAt", "updatedAt")
SELECT 'e2e-test-xsync-002', '[E2E] 已发布帖', 'PUBLISHED'::"State", NOW(), o.id, i.id, 'e2e-grp-002', 'NO'::"APPROVED_SUBMIT_FOR_ORDER", 0, NOW(), NOW()
FROM "Integration" i, (SELECT id FROM "Organization" LIMIT 1) o
WHERE i."providerIdentifier" = 'x' AND i."deletedAt" IS NULL LIMIT 1;
SQL

# Verify test data
PENDING_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \
  "SELECT COUNT(*) FROM \"Post\" WHERE id = 'e2e-test-xsync-001' AND state = 'PENDING_EXTENSION';" 2>/dev/null)
if [ "$PENDING_COUNT" = "1" ]; then
  pass "Test data created (PENDING_EXTENSION + PUBLISHED posts)"
else
  fail "Test data" "Could not create test posts"
fi

# ---- Step 3: Generate JWT ----
header "Step 3: API Tests"
JWT_SECRET="xpoz-dev-jwt-secret-2026-arctrany-e2e-testing"
USER_ID=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT id FROM \"User\" LIMIT 1;" 2>/dev/null | tr -d ' ')

# Use Node.js to generate JWT and run all API tests
node -e "
const jwt = require('jsonwebtoken');
const JWT_SECRET = '${JWT_SECRET}';
const token = jwt.sign({id:'${USER_ID}',email:'admin@xpoz.local',activated:true,isSuperAdmin:false}, JWT_SECRET);

(async()=>{
  const h = {'auth':token,'Content-Type':'application/json'};
  let p=0,f=0;
  const pass=(n)=>{console.log('\x1b[32m✅ PASS\x1b[0m:',n);p++};
  const fail=(n,d)=>{console.log('\x1b[31m❌ FAIL\x1b[0m:',n,'—',d);f++};

  // TC-3.1 & TC-3.2: GET /posts/pending-extension
  try {
    const r = await fetch('http://localhost:3333/posts/pending-extension',{headers:h});
    if(!r.ok) { fail('TC-3.1','HTTP '+r.status+': '+(await r.text())); }
    else {
      const d = await r.json();
      if(Array.isArray(d)&&d.some(x=>x.id==='e2e-test-xsync-001')) pass('TC-3.1: PENDING_EXTENSION post found in /pending-extension');
      else fail('TC-3.1','Post not found: '+JSON.stringify(d).slice(0,200));
      if(!d.some(x=>x.id==='e2e-test-xsync-002')) pass('TC-3.2: PUBLISHED post correctly excluded');
      else fail('TC-3.2','Published post should not appear');
    }
  } catch(e) { fail('TC-3.1',e.message); }

  // TC-3.3: POST /mark-published (success)
  try {
    const r = await fetch('http://localhost:3333/posts/e2e-test-xsync-001/mark-published',{method:'POST',headers:h,body:JSON.stringify({releaseURL:'https://test.example.com/e2e'})});
    if(r.ok) { const b=await r.json(); if(b.success) pass('TC-3.3: mark-published success'); else fail('TC-3.3',JSON.stringify(b)); }
    else fail('TC-3.3','HTTP '+r.status+': '+(await r.text()));
  } catch(e) { fail('TC-3.3',e.message); }

  // TC-3.3b: Verify state updated
  try {
    const r = await fetch('http://localhost:3333/posts/e2e-test-xsync-001',{headers:h});
    if(r.ok) { const d=await r.json(); if(d.state==='PUBLISHED') pass('TC-3.3b: State → PUBLISHED'); else fail('TC-3.3b','State='+d.state); }
    else fail('TC-3.3b','HTTP '+r.status);
  } catch(e) { fail('TC-3.3b',e.message); }

  // TC-3.5: Reject non-PENDING
  try {
    const r = await fetch('http://localhost:3333/posts/e2e-test-xsync-001/mark-published',{method:'POST',headers:h,body:JSON.stringify({releaseURL:'https://fail.example.com'})});
    if(r.status===400) pass('TC-3.5: Correctly rejected (400)');
    else fail('TC-3.5','Expected 400, got '+r.status);
  } catch(e) { fail('TC-3.5',e.message); }

  console.log('\n========================================');
  console.log('  Results:',p,'passed,',f,'failed');
  console.log('========================================');
  process.exit(f>0?1:0);
})();
"
TEST_EXIT=$?

# ---- Step 4: Cleanup ----
header "Step 4: Cleanup"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
  "DELETE FROM \"Post\" WHERE id LIKE 'e2e-test-xsync-%';" 2>/dev/null
info "Test data cleaned up"

echo ""
if [ ${TEST_EXIT:-1} -eq 0 ]; then
  echo -e "${GREEN}🎉 All API tests passed!${NC}"
else
  echo -e "${RED}⚠️  Some tests failed. Check output above.${NC}"
fi
