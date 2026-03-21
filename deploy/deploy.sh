#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  XPoz + Huginn 一键部署脚本
#  适用于: 阿里云 ECS (Ubuntu 22.04+ / Debian 12+ / CentOS 8+)
#  用法:   curl -sSL <url>/deploy.sh | bash
#          或: bash deploy.sh
# ════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fatal() { err "$*"; exit 1; }

DEPLOY_DIR="${DEPLOY_DIR:-/opt/xpoz-stack}"

# ─── Banner ─────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  XPoz + Huginn 一键部署                      ║${NC}"
echo -e "${CYAN}║  9 容器 · 1 台 ECS · Docker Compose          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. 检查操作系统和权限 ───
if [ "$(id -u)" -ne 0 ]; then
    fatal "请以 root 用户运行: sudo bash deploy.sh"
fi

info "部署目录: $DEPLOY_DIR"

# ─── 2. 安装 Docker ───
install_docker() {
    if command -v docker &>/dev/null; then
        ok "Docker 已安装: $(docker --version)"
        return
    fi

    info "正在安装 Docker..."

    # 检测包管理器
    if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
            $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    elif command -v yum &>/dev/null; then
        yum install -y yum-utils
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    else
        fatal "不支持的操作系统，请手动安装 Docker"
    fi

    systemctl enable docker
    systemctl start docker
    ok "Docker 安装完成"
}

# ─── 3. 配置阿里云镜像加速 ───
setup_mirror() {
    local MIRROR_FILE="/etc/docker/daemon.json"
    if [ -f "$MIRROR_FILE" ] && grep -q "mirror" "$MIRROR_FILE" 2>/dev/null; then
        ok "Docker 镜像加速已配置"
        return
    fi

    info "配置阿里云 Docker 镜像加速..."
    mkdir -p /etc/docker
    cat > "$MIRROR_FILE" <<'EOF'
{
    "registry-mirrors": [
        "https://registry.cn-hangzhou.aliyuncs.com"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "50m",
        "max-file": "3"
    }
}
EOF
    systemctl daemon-reload
    systemctl restart docker
    ok "镜像加速已配置"
}

# ─── 4. 创建部署目录结构 ───
setup_dirs() {
    info "创建部署目录..."
    mkdir -p "$DEPLOY_DIR"/{nginx/conf.d,nginx/ssl,nginx/logs,dynamicconfig,backups}
    ok "目录结构已创建"
}

# ─── 5. 生成密码 ───
gen_pwd() {
    head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$1"
}

# ─── 6. 交互式配置 ───
configure() {
    local ENV_FILE="$DEPLOY_DIR/.env"

    if [ -f "$ENV_FILE" ]; then
        warn ".env 已存在，跳过配置（如需重新配置请删除 $ENV_FILE）"
        return
    fi

    echo ""
    info "═══ 配置向导 ═══"
    echo ""

    # 域名
    read -rp "XPoz 域名 (例: xpoz.yourdomain.com): " XPOZ_DOMAIN
    read -rp "Huginn 域名 (例: huginn.yourdomain.com): " HUGINN_DOMAIN
    read -rp "Temporal UI 域名 (例: temporal.yourdomain.com, 回车跳过): " TEMPORAL_DOMAIN

    XPOZ_DOMAIN="${XPOZ_DOMAIN:-xpoz.localhost}"
    HUGINN_DOMAIN="${HUGINN_DOMAIN:-huginn.localhost}"
    TEMPORAL_DOMAIN="${TEMPORAL_DOMAIN:-temporal.localhost}"

    # 协议
    read -rp "使用 HTTPS? (y/n, 默认 n): " USE_HTTPS
    USE_HTTPS="${USE_HTTPS:-n}"
    PROTO="http"
    [ "$USE_HTTPS" = "y" ] && PROTO="https"

    # 自动生成安全密码
    PG_PWD=$(gen_pwd 24)
    TEMPORAL_PWD=$(gen_pwd 24)
    JWT=$(gen_pwd 32)
    HUGINN_SECRET=$(gen_pwd 32)
    HUGINN_INVITE=$(gen_pwd 8)

    read -rp "Huginn 管理员密码 (回车自动生成): " HUGINN_PWD
    HUGINN_PWD="${HUGINN_PWD:-$(gen_pwd 16)}"

    # 写入 .env
    cat > "$ENV_FILE" <<EOF
# ═══ 自动生成 · $(date '+%Y-%m-%d %H:%M:%S') ═══

# 域名
XPOZ_DOMAIN=$XPOZ_DOMAIN
HUGINN_DOMAIN=$HUGINN_DOMAIN
TEMPORAL_DOMAIN=$TEMPORAL_DOMAIN
XPOZ_URL=${PROTO}://${XPOZ_DOMAIN}
HUGINN_URL=${PROTO}://${HUGINN_DOMAIN}

# 数据库
POSTGRES_USER=xpoz
POSTGRES_PASSWORD=$PG_PWD
XPOZ_DB=xpoz
HUGINN_DB=huginn

# XPoz
JWT_SECRET=$JWT
DISABLE_REGISTRATION=false

# Temporal
TEMPORAL_DB_PASSWORD=$TEMPORAL_PWD

# Huginn
HUGINN_SECRET=$HUGINN_SECRET
HUGINN_INVITATION_CODE=$HUGINN_INVITE
HUGINN_PASSWORD=$HUGINN_PWD
TIMEZONE=Asia/Shanghai

# 社媒 API Keys (按需填写)
X_CLIENT_ID=
X_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
OPENAI_API_KEY=
EOF

    chmod 600 "$ENV_FILE"
    ok ".env 已生成 (密码已自动生成)"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  请记录以下信息:                      ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════╣${NC}"
    echo -e "  Huginn 邀请码:   ${YELLOW}$HUGINN_INVITE${NC}"
    echo -e "  Huginn 管理密码: ${YELLOW}$HUGINN_PWD${NC}"
    echo -e "  PostgreSQL 密码: ${YELLOW}$PG_PWD${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""

    # 更新 Nginx 配置中的域名
    sed -i "s/xpoz\.example\.com/$XPOZ_DOMAIN/g" "$DEPLOY_DIR/nginx/conf.d/default.conf"
    sed -i "s/huginn\.example\.com/$HUGINN_DOMAIN/g" "$DEPLOY_DIR/nginx/conf.d/default.conf"
    sed -i "s/temporal\.example\.com/$TEMPORAL_DOMAIN/g" "$DEPLOY_DIR/nginx/conf.d/default.conf"
}

# ─── 7. 部署文件 ───
copy_files() {
    info "部署配置文件..."
    local SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 如果从 git clone 运行，复制文件; 否则假设文件已在 DEPLOY_DIR
    if [ "$SCRIPT_DIR" != "$DEPLOY_DIR" ]; then
        cp "$SCRIPT_DIR/docker-compose.unified.yml" "$DEPLOY_DIR/docker-compose.yml"
        cp "$SCRIPT_DIR/init-db.sh" "$DEPLOY_DIR/init-db.sh"
        cp -n "$SCRIPT_DIR/nginx/conf.d/default.conf" "$DEPLOY_DIR/nginx/conf.d/default.conf" 2>/dev/null || true
        cp -n "$SCRIPT_DIR/dynamicconfig/development-sql.yaml" "$DEPLOY_DIR/dynamicconfig/development-sql.yaml" 2>/dev/null || true
        [ -f "$SCRIPT_DIR/backup.sh" ] && cp "$SCRIPT_DIR/backup.sh" "$DEPLOY_DIR/backup.sh"
    fi

    chmod +x "$DEPLOY_DIR/init-db.sh"
    [ -f "$DEPLOY_DIR/backup.sh" ] && chmod +x "$DEPLOY_DIR/backup.sh"
    ok "配置文件已就位"
}

# ─── 8. 启动服务 ───
start_services() {
    info "拉取镜像并启动服务 (首次可能需要 5-10 分钟)..."
    cd "$DEPLOY_DIR"
    docker compose pull
    docker compose up -d

    echo ""
    info "等待服务启动..."
    sleep 15

    echo ""
    info "═══ 容器状态 ═══"
    docker compose ps

    echo ""
    ok "所有服务已启动!"
}

# ─── 9. 设置备份 Cron ───
setup_backup_cron() {
    if [ ! -f "$DEPLOY_DIR/backup.sh" ]; then
        return
    fi

    # 每天凌晨 3 点自动备份
    local CRON_LINE="0 3 * * * $DEPLOY_DIR/backup.sh >> $DEPLOY_DIR/backups/cron.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "backup.sh"; echo "$CRON_LINE") | crontab -
    ok "自动备份已设置 (每天 03:00)"
}

# ─── 10. 输出摘要 ───
print_summary() {
    source "$DEPLOY_DIR/.env"
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           部署完成! 🎉                       ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════╣${NC}"
    echo -e "  XPoz:        ${GREEN}${XPOZ_URL}${NC}"
    echo -e "  Huginn:      ${GREEN}${HUGINN_URL}${NC}"
    echo -e "  Temporal UI: ${GREEN}http://${TEMPORAL_DOMAIN}${NC}"
    echo -e ""
    echo -e "  部署目录:    ${DEPLOY_DIR}"
    echo -e "  配置文件:    ${DEPLOY_DIR}/.env"
    echo -e ""
    echo -e "  ${YELLOW}常用命令:${NC}"
    echo -e "    查看状态:  cd $DEPLOY_DIR && docker compose ps"
    echo -e "    查看日志:  cd $DEPLOY_DIR && docker compose logs -f xpoz"
    echo -e "    重启服务:  cd $DEPLOY_DIR && docker compose restart"
    echo -e "    停止服务:  cd $DEPLOY_DIR && docker compose down"
    echo -e "    手动备份:  bash $DEPLOY_DIR/backup.sh"
    echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

# ─── 主流程 ───
main() {
    install_docker
    setup_mirror
    setup_dirs
    copy_files
    configure
    start_services
    setup_backup_cron
    print_summary
}

main "$@"
