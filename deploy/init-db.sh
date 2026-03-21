#!/bin/bash
# 初始化 Huginn 数据库（在 xpoz-postgres 容器启动时自动执行）
# PostgreSQL docker-entrypoint-initdb.d 脚本

set -e

# 使用 POSTGRES_USER 作为超级用户创建 Huginn 数据库
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE huginn'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'huginn')\gexec
    GRANT ALL PRIVILEGES ON DATABASE huginn TO $POSTGRES_USER;
EOSQL

echo "✅ Huginn database initialized"
