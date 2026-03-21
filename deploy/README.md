# XPoz + Huginn 一键部署

在 1 台阿里云 ECS 上部署 XPoz 社媒管理 + Huginn 情报采集，共 **9 个容器**。

## 容器清单

| # | 容器 | 用途 | 端口 |
|---|------|------|------|
| 1 | **nginx** | 反向代理 + SSL | 80, 443 |
| 2 | **xpoz** | XPoz 社媒管理应用 | 5000 |
| 3 | **xpoz-postgres** | 共用 PostgreSQL (XPoz + Huginn) | 5432 |
| 4 | **xpoz-redis** | Redis 缓存 | 6379 |
| 5 | **temporal** | Temporal 工作流引擎 | 7233 |
| 6 | **temporal-postgres** | Temporal 专用数据库 | — |
| 7 | **temporal-es** | Temporal Elasticsearch | 9200 |
| 8 | **temporal-ui** | Temporal Web 管理界面 | 8080 |
| 9 | **huginn** | Huginn 情报采集平台 | 3000 |

## 推荐配置

| 资源 | 最小 | 推荐 |
|------|------|------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| 磁盘 | 40 GB SSD | 80 GB ESSD |
| 系统 | Ubuntu 22.04 | Ubuntu 24.04 |

## 一键部署

```bash
# 1. 克隆仓库
git clone https://github.com/arctrany/postiz-app.git
cd postiz-app/deploy

# 2. 执行一键部署
sudo bash deploy.sh
```

部署脚本会自动：
- ✅ 安装 Docker + 阿里云镜像加速
- ✅ 交互式配置域名和密码
- ✅ 自动生成强密码
- ✅ 启动全部 9 个容器
- ✅ 设置每日凌晨 3 点自动备份

## 手动管理

```bash
cd /opt/xpoz-stack

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f xpoz
docker compose logs -f huginn

# 重启
docker compose restart

# 停止
docker compose down

# 手动备份
bash backup.sh
```

## 文件结构

```
deploy/
├── docker-compose.unified.yml   # 9 容器编排
├── deploy.sh                    # 一键部署脚本
├── backup.sh                    # 数据库备份脚本
├── init-db.sh                   # PostgreSQL 初始化 (创建 Huginn 库)
├── .env.example                 # 环境变量模板
├── dynamicconfig/               # Temporal 配置
│   └── development-sql.yaml
└── nginx/
    └── conf.d/
        └── default.conf         # Nginx 反向代理配置
```
