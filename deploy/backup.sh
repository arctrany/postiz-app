#!/bin/bash
# ════════════════════════════════════════════
#  数据库备份脚本
#  自动备份 XPoz + Huginn PostgreSQL 数据
#  保留最近 7 天的备份
# ════════════════════════════════════════════

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/xpoz-stack}"
BACKUP_DIR="$DEPLOY_DIR/backups"
DATE=$(date '+%Y%m%d_%H%M%S')
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] 开始备份..."

# 备份 XPoz 数据库
docker exec xpoz-postgres pg_dump -U xpoz -d xpoz --clean --if-exists \
    | gzip > "$BACKUP_DIR/xpoz_$DATE.sql.gz"
echo "  ✅ XPoz 数据库已备份"

# 备份 Huginn 数据库
docker exec xpoz-postgres pg_dump -U xpoz -d huginn --clean --if-exists \
    | gzip > "$BACKUP_DIR/huginn_$DATE.sql.gz"
echo "  ✅ Huginn 数据库已备份"

# 备份 Temporal 数据库
docker exec temporal-postgres pg_dump -U temporal --clean --if-exists \
    | gzip > "$BACKUP_DIR/temporal_$DATE.sql.gz"
echo "  ✅ Temporal 数据库已备份"

# 清理旧备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "  🧹 已清理 ${KEEP_DAYS} 天前的备份"

# 显示备份大小
TOTAL=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date)] 备份完成 (总大小: $TOTAL)"
