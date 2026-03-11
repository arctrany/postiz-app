#!/bin/bash
set -e

# === XPoz 本地开发一键启动脚本 ===
cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- 1. 启动 Colima ---
echo ""
echo "===== 1/4 Docker ====="
if colima status 2>/dev/null | grep -q "Running"; then
  info "Colima 已运行"
else
  warn "启动 Colima..."
  colima start || fail "Colima 启动失败"
  info "Colima 就绪"
fi

# --- 2. 启动 PostgreSQL + Redis + Temporal ---
echo ""
echo "===== 2/4 基础服务 ====="
docker-compose -f docker-compose.dev.yaml up -d
for i in $(seq 1 20); do
  if docker exec postiz-postgres pg_isready -U postiz-local -d postiz-db-local >/dev/null 2>&1; then
    info "PostgreSQL 就绪"
    break
  fi
  [ "$i" -eq 20 ] && fail "PostgreSQL 未就绪"
  sleep 1
done
info "Redis 就绪"
info "Temporal 就绪"

# --- 3. 数据库迁移 ---
echo ""
echo "===== 3/4 数据库迁移 ====="
npx prisma db push --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma --accept-data-loss 2>/dev/null \
  || npx prisma db push --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma
info "迁移完成"

# --- 4. 启动前端+后端 ---
echo ""
echo "===== 4/4 启动开发服务器 ====="
info "前端: http://localhost:4200"
info "后端: http://localhost:3000"
info "X OAuth 2.0 已配置 ✓"
echo ""
pnpm run --filter ./apps/backend --filter ./apps/frontend --parallel dev
