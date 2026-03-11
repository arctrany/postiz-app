#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")/.."

ERRORS=0

echo "============================================"
echo "  XPoz 品牌清理验证脚本"
echo "============================================"
echo ""

# V0-1: 扫描 postiz.com 残留
echo "=== V0-1: 扫描 postiz.com 外链残留 ==="
RESIDUAL=$(grep -rn "postiz\.com" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.html" --include="*.svg" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=.next \
  --exclude="package.json" --exclude="pnpm-lock.yaml" \
  --exclude="CHANGELOG.md" --exclude="CONTRIBUTING.md" \
  --exclude="CODE_OF_CONDUCT.md" --exclude="SECURITY.md" \
  --exclude="README.md" --exclude="LICENSE" \
  --exclude="xpoz-platform-plan.md" \
  . 2>/dev/null || true)

if [ -n "$RESIDUAL" ]; then
  COUNT=$(echo "$RESIDUAL" | wc -l | tr -d ' ')
  echo "❌ 发现 $COUNT 处 postiz.com 残留："
  echo "$RESIDUAL" | head -30
  if [ "$COUNT" -gt 30 ]; then
    echo "  ... (共 $COUNT 处，仅显示前 30)"
  fi
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 无 postiz.com 外链残留"
fi
echo ""

# V0-2: 扫描硬编码邮箱
echo "=== V0-2: 扫描硬编码邮箱 ==="
EMAIL_RESIDUAL=$(grep -rn "nevo@postiz\|nevo@gitroom" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist \
  . 2>/dev/null || true)

if [ -n "$EMAIL_RESIDUAL" ]; then
  echo "❌ 发现硬编码邮箱："
  echo "$EMAIL_RESIDUAL"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 无硬编码邮箱残留"
fi
echo ""

# V0-3: 验证 Plausible/PostHog 已移除
echo "=== V0-3: 扫描 Plausible/PostHog 分析代码 ==="
ANALYTICS=$(grep -rn "plausible\|posthog\|PostHog\|Plausible\|POSTHOG\|PLAUSIBLE" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=.next \
  --exclude="verify-brand.sh" \
  . 2>/dev/null || true)

if [ -n "$ANALYTICS" ]; then
  echo "❌ 发现分析代码残留："
  echo "$ANALYTICS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 分析代码已移除"
fi
echo ""

# V0-4: 扫描 postiz SVG/Logo 残留
echo "=== V0-4: 扫描 postiz Logo 文件 ==="
if [ -f "apps/frontend/public/postiz.svg" ]; then
  echo "❌ postiz.svg 仍存在"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ postiz.svg 已移除"
fi
echo ""

# V0-5: 检查 Extension manifest
echo "=== V0-5: 检查 Extension manifest ==="
if [ -f "apps/extension/manifest.json" ]; then
  EXT_NAME=$(grep '"name"' apps/extension/manifest.json | head -1)
  if echo "$EXT_NAME" | grep -qi "postiz"; then
    echo "❌ Extension 名称仍为 Postiz: $EXT_NAME"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ Extension 名称已更新: $EXT_NAME"
  fi
  
  if grep -q "postiz\.com" apps/extension/manifest.json; then
    echo "❌ Extension manifest 中仍有 postiz.com"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ Extension manifest 域名已更新"
  fi
else
  echo "⚠️ Extension manifest 不存在"
fi
echo ""

# V0-6: 检查 agent 名称
echo "=== V0-6: 扫描 agent=\"postiz\" 残留 ==="
AGENT_RESIDUAL=$(grep -rn 'agent="postiz"\|agent=\x27postiz\x27' \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist \
  . 2>/dev/null || true)

if [ -n "$AGENT_RESIDUAL" ]; then
  echo "❌ 发现 agent=\"postiz\" 残留："
  echo "$AGENT_RESIDUAL"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 无 agent=\"postiz\" 残留"
fi
echo ""

# V0-7: 检查 GitHub 仓库链接
echo "=== V0-7: 扫描 gitroomhq/postiz-app 链接 ==="
GH_RESIDUAL=$(grep -rn "gitroomhq/postiz-app\|gitroomhq/postiz" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude="package.json" --exclude="pnpm-lock.yaml" \
  . 2>/dev/null || true)

if [ -n "$GH_RESIDUAL" ]; then
  echo "⚠️ 发现 GitHub 链接残留（可选修改）："
  echo "$GH_RESIDUAL" | head -10
else
  echo "✅ 无 GitHub 链接残留"
fi
echo ""

echo "============================================"
if [ "$ERRORS" -gt 0 ]; then
  echo "  ❌ 发现 $ERRORS 类问题需要处理"
  exit 1
else
  echo "  ✅ 品牌清理验证全部通过！"
  exit 0
fi
