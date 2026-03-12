#!/usr/bin/env bash
# XPoz Brand Replacement — Verification & Cleanup Script

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$PROJECT_ROOT"
PASS=0; WARN=0; FAIL=0
log_pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
log_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN+1)); }
log_fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

GFLAGS="--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.git --exclude-dir=.pnpm"

# ─── Step 1 ─────────────────────────────────────────────────────────────────
log_step "Step 1: Cleaning stale dist/ build artifacts"
for dir in apps/backend/dist apps/orchestrator/dist apps/frontend/.next; do
  if [ -d "$dir" ]; then rm -rf "$dir"; log_pass "Removed $dir"; else log_pass "$dir already clean"; fi
done

# ─── Step 2 ─────────────────────────────────────────────────────────────────
log_step "Step 2: Checking for remaining old brand references"

COUNT=$(grep -rl $GFLAGS '@gitroom/' --include='*.ts' --include='*.tsx' --include='*.json' . 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT:-0}" = "0" ]; then log_pass "No @gitroom/ imports remain"; else log_fail "$COUNT files still contain @gitroom/ imports"; fi

COUNT=$(grep -rn $GFLAGS 'process\.env\.POSTIZ' --include='*.ts' --include='*.tsx' . 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT:-0}" = "0" ]; then log_pass "No process.env.POSTIZ_* in source code"; else log_fail "$COUNT lines still reference process.env.POSTIZ_*"; fi

COUNT=$(grep -rn $GFLAGS 'gitroom' --include='*.ts' --include='*.tsx' . 2>/dev/null | grep -v '/locales/' | grep -v 'Original Stripe' | grep -v 'disabled' | wc -l | tr -d ' ')
if [ "${COUNT:-0}" = "0" ]; then
  log_pass "No gitroom references in source code"
else
  log_warn "$COUNT lines still contain 'gitroom':"
  grep -rn $GFLAGS 'gitroom' --include='*.ts' --include='*.tsx' . 2>/dev/null \
    | grep -v '/locales/' | grep -v 'Original Stripe' | grep -v 'disabled' | head -5 | sed 's/^/    /'
fi

COUNT=$(grep -n 'POSTIZ_' .env.example docker-compose.yaml docker-compose.dev.yaml 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT:-0}" = "0" ]; then log_pass "No POSTIZ_* in config files"; else log_fail "$COUNT lines still use POSTIZ_* in config files"; fi

if grep -q '@xpoz/' tsconfig.base.json 2>/dev/null; then log_pass "tsconfig.base.json uses @xpoz/* paths"; else log_fail "tsconfig.base.json still uses old paths"; fi

ROOT_PKG=$(node -p "require('./package.json').name" 2>/dev/null || echo "unknown")
if [ "$ROOT_PKG" = "xpoz" ]; then
  log_pass "Root package.json name = xpoz"
else
  log_fail "Root package.json name = $ROOT_PKG, expected xpoz"
fi

# ─── Step 3 ─────────────────────────────────────────────────────────────────
log_step "Step 3: Running builds"

echo -e "  Building backend..."
if pnpm run build:backend > /tmp/xpoz-build-backend.log 2>&1; then
  log_pass "Backend build succeeded"
else
  log_fail "Backend build failed:"
  tail -5 /tmp/xpoz-build-backend.log | sed 's/^/    /'
fi

echo -e "  Building frontend..."
if pnpm run build:frontend > /tmp/xpoz-build-frontend.log 2>&1; then
  log_pass "Frontend build succeeded"
else
  log_fail "Frontend build failed:"
  tail -5 /tmp/xpoz-build-frontend.log | sed 's/^/    /'
fi

# ─── Summary ────────────────────────────────────────────────────────────────
log_step "Summary"
echo -e "  ${GREEN}Passed:${NC} $PASS  ${YELLOW}Warnings:${NC} $WARN  ${RED}Failed:${NC} $FAIL"
if [ "$FAIL" -gt 0 ]; then echo -e "\n${RED}❌ Verification FAILED${NC}"; exit 1; fi
if [ "$WARN" -gt 0 ]; then echo -e "\n${YELLOW}⚠️  Passed with warnings${NC}"; exit 0; fi
echo -e "\n${GREEN}✅ All checks passed!${NC}"
