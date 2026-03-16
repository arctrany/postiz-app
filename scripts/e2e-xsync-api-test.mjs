/**
 * e2e-xsync-api-test.mjs
 *
 * XSync Extension Bridge 端到端 API 测试
 *
 * 功能：
 *   1. 自动通过 Prisma 创建测试 fixtures（org、user、integration、post）
 *   2. 调用后端 API 执行全部测试用例（TC-3.1 ~ TC-3.5）
 *   3. 测试完成后自动清理所有测试数据
 *
 * 用法：
 *   node scripts/e2e-xsync-api-test.mjs              # 完整流程（setup + test + teardown）
 *   node scripts/e2e-xsync-api-test.mjs --setup-only  # 仅创建测试数据，不运行测试
 *   node scripts/e2e-xsync-api-test.mjs --skip-setup  # 跳过创建，直接测试（须先 --setup-only）
 *   node scripts/e2e-xsync-api-test.mjs --no-teardown # 测试后不清理数据（调试用）
 */

import { createHmac } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── 配置 ──────────────────────────────────────────────────────────────
const BACKEND   = process.env.E2E_BACKEND_URL || 'http://localhost:3333';
const JWT_SECRET = process.env.JWT_SECRET      || 'your-jwt-secret';

// 测试数据 ID（使用固定 ID 便于幂等重试）
const TEST_ORG_ID         = 'e2e-org-xsync-001';
const TEST_USER_ID        = 'e2e-user-xsync-001';
const TEST_INTEGRATION_ID = 'e2e-integration-xsync-001';
const TEST_POST_PENDING   = 'e2e-post-xsync-pending-001';  // PENDING_EXTENSION
const TEST_POST_PUBLISHED = 'e2e-post-xsync-published-001'; // PUBLISHED

const ARGS = new Set(process.argv.slice(2));

// ── JWT 工具 ──────────────────────────────────────────────────────────
function makeJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const token  = makeJWT({ id: TEST_USER_ID, email: 'e2e@xpoz.local', activated: true, isSuperAdmin: false });
// Note: backend uses 'auth' header, NOT 'Authorization: Bearer'
const headers = { auth: token, 'Content-Type': 'application/json' };

// ── 测试计数 ──────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function pass(name)         { console.log(`  ✅ PASS: ${name}`); passed++; }
function fail(name, detail) { console.log(`  ❌ FAIL: ${name}\n     → ${detail}`); failed++; }

// ── Prisma 客户端（延迟加载，允许仅跑 DB 操作部分）─────────────────────
async function getPrisma() {
  try {
    // 尝试从项目 node_modules 加载 Prisma Client
    const { PrismaClient } = require(path.join(__dirname, '../node_modules/@prisma/client'));
    const prisma = new PrismaClient();
    await prisma.$connect();
    return prisma;
  } catch (e) {
    console.error('[setup] Prisma Client 加载失败，无法创建测试 fixtures:', e.message);
    console.error('        请确保已运行 `pnpm prisma generate`');
    return null;
  }
}

// ── Setup：创建测试数据 ───────────────────────────────────────────────
async function setup() {
  console.log('\n🔧 创建测试 Fixtures...');
  const prisma = await getPrisma();
  if (!prisma) {
    console.warn('  ⚠️  跳过 DB fixtures（Prisma 不可用），测试数据须已存在');
    return false;
  }

  try {
    // 1. Organization
    await prisma.organization.upsert({
      where:  { id: TEST_ORG_ID },
      create: { id: TEST_ORG_ID, name: 'E2E XSync Org' },
      update: {},
    });

    // 2. User
    await prisma.user.upsert({
      where:  { id: TEST_USER_ID },
      create: {
        id:        TEST_USER_ID,
        email:     'e2e@xpoz.local',
        activated: true,
        password:  'e2e-password-hash',
      },
      update: {},
    });

    // 3. Integration (xsync-weibo)
    await prisma.integration.upsert({
      where:  { id: TEST_INTEGRATION_ID },
      create: {
        id:                 TEST_INTEGRATION_ID,
        organizationId:     TEST_ORG_ID,
        providerIdentifier: 'xsync-weibo',
        name:               'E2E Weibo Integration',
        internalId:         'e2e-weibo-uid',
        token:              'e2e-token',
        type:               'social',
      },
      update: {},
    });

    // 4. 待发布帖子（PENDING_EXTENSION）
    await prisma.post.upsert({
      where:  { id: TEST_POST_PENDING },
      create: {
        id:             TEST_POST_PENDING,
        organizationId: TEST_ORG_ID,
        integrationId:  TEST_INTEGRATION_ID,
        content:        'E2E 测试帖子 - PENDING_EXTENSION',
        publishDate:    new Date(),
        state:          'PENDING_EXTENSION',
        group:          TEST_POST_PENDING,
        settings:       '{}',
        image:          '[]',
      },
      update: { state: 'PENDING_EXTENSION' }, // 重置以支持幂等重试
    });

    // 5. 已发布帖子（PUBLISHED，不应出现在 pending 列表中）
    await prisma.post.upsert({
      where:  { id: TEST_POST_PUBLISHED },
      create: {
        id:             TEST_POST_PUBLISHED,
        organizationId: TEST_ORG_ID,
        integrationId:  TEST_INTEGRATION_ID,
        content:        'E2E 测试帖子 - PUBLISHED',
        publishDate:    new Date(),
        state:          'PUBLISHED',
        group:          TEST_POST_PUBLISHED,
        settings:       '{}',
        image:          '[]',
      },
      update: {},
    });

    await prisma.$disconnect();
    console.log('  ✅ Fixtures 创建完成\n');
    return true;
  } catch (e) {
    console.error('  ❌ Fixtures 创建失败:', e.message);
    await prisma.$disconnect();
    return false;
  }
}

// ── Teardown：清理测试数据 ────────────────────────────────────────────
async function teardown() {
  console.log('\n🧹 清理测试数据...');
  const prisma = await getPrisma();
  if (!prisma) { console.warn('  ⚠️  跳过清理（Prisma 不可用）'); return; }

  try {
    await prisma.post.deleteMany({
      where: { id: { in: [TEST_POST_PENDING, TEST_POST_PUBLISHED] } },
    });
    await prisma.integration.deleteMany({ where: { id: TEST_INTEGRATION_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.organization.deleteMany({ where: { id: TEST_ORG_ID } });
    await prisma.$disconnect();
    console.log('  ✅ 清理完成\n');
  } catch (e) {
    console.error('  ⚠️  清理失败（可手动删除）:', e.message);
    await prisma.$disconnect();
  }
}

// ── 检查后端是否在线 ─────────────────────────────────────────────────
async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    // 有些后端没有 /health，尝试任意路由
    try {
      await fetch(BACKEND, { signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      return false;
    }
  }
}

// ── 测试用例 ─────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n🧪 运行 API 测试...\n');

  // TC-3.1: GET /pending-extension — PENDING 帖子出现
  console.log('=== TC-3.1: GET /pending-extension ===');
  const r1 = await fetch(`${BACKEND}/posts/pending-extension`, { headers });
  if (!r1.ok) {
    fail('TC-3.1', `HTTP ${r1.status}: ${await r1.text()}`);
  } else {
    const pending = await r1.json();
    if (Array.isArray(pending) && pending.some(p => p.id === TEST_POST_PENDING)) {
      pass('TC-3.1: PENDING_EXTENSION 帖子出现在列表中');
    } else {
      fail('TC-3.1', `帖子未找到。返回: ${JSON.stringify(pending).slice(0, 300)}`);
    }

    // TC-3.2: 已发布帖子不应出现
    if (!pending.some(p => p.id === TEST_POST_PUBLISHED)) {
      pass('TC-3.2: 已发布帖子正确排除在 pending 列表外');
    } else {
      fail('TC-3.2', `已发布帖子不应出现在 pending 列表中`);
    }

    // TC-3.2b: 返回的 post 应包含 integration（含 token）
    const pendingPost = pending.find(p => p.id === TEST_POST_PENDING);
    if (pendingPost && pendingPost.integration && pendingPost.integration.token) {
      pass('TC-3.2b: PENDING 帖子包含 integration.token（Extension 可使用）');
    } else {
      fail('TC-3.2b', `帖子缺少 integration.token: ${JSON.stringify(pendingPost?.integration)}`);
    }
  }

  // TC-3.3: POST /mark-published — 成功回写
  console.log('\n=== TC-3.3: POST /mark-published (success) ===');
  const r3 = await fetch(`${BACKEND}/posts/${TEST_POST_PENDING}/mark-published`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ releaseURL: 'https://weibo.com/e2e-test-12345' }),
  });
  if (r3.ok) {
    const b3 = await r3.json();
    if (b3.success) {
      pass('TC-3.3: mark-published 返回 success=true');
    } else {
      fail('TC-3.3', JSON.stringify(b3));
    }
  } else {
    fail('TC-3.3', `HTTP ${r3.status}: ${await r3.text()}`);
  }

  // TC-3.3b: 状态变更为 PUBLISHED
  console.log('\n=== TC-3.3b: 验证状态 = PUBLISHED ===');
  const r3b = await fetch(`${BACKEND}/posts/group/${TEST_POST_PENDING}`, { headers });
  if (r3b.ok) {
    const data = await r3b.json();
    const post = data?.posts?.[0];
    if (post?.state === 'PUBLISHED') {
      pass('TC-3.3b: 帖子状态已更新为 PUBLISHED');
    } else {
      fail('TC-3.3b', `state = "${post?.state}"（期望 PUBLISHED）`);
    }
  } else {
    // Fallback: 通过 pending 列表验证（已发布的帖子不再出现）
    const r3c = await fetch(`${BACKEND}/posts/pending-extension`, { headers });
    if (r3c.ok) {
      const list = await r3c.json();
      if (!list.some(p => p.id === TEST_POST_PENDING)) {
        pass('TC-3.3b: 帖子不再出现在 pending 列表（已发布）');
      } else {
        fail('TC-3.3b', '帖子仍在 pending 列表中，状态可能未更新');
      }
    } else {
      fail('TC-3.3b', `HTTP ${r3b.status}`);
    }
  }

  // TC-3.5: 重复 mark-published 应返回 400
  console.log('\n=== TC-3.5: 重复 mark-published 应被拒绝 (400) ===');
  const r5 = await fetch(`${BACKEND}/posts/${TEST_POST_PENDING}/mark-published`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ releaseURL: 'https://should-fail.example.com' }),
  });
  if (r5.status === 400) {
    pass('TC-3.5: 正确拒绝重复操作（HTTP 400）');
  } else {
    fail('TC-3.5', `期望 HTTP 400，实际收到 ${r5.status}`);
  }

  // TC-3.6: mark-published 错误路径（error 参数）
  console.log('\n=== TC-3.6: POST /mark-published with error ===');
  // 先重置为 PENDING_EXTENSION（通过创建新的 post group）
  // 此用例使用独立帖子 ID，模拟 Extension 报错
  const r6 = await fetch(`${BACKEND}/posts/nonexistent-post-id/mark-published`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ error: 'Extension 连接超时' }),
  });
  if (r6.status === 400 || r6.status === 404) {
    pass('TC-3.6: 不存在的帖子正确返回 4xx');
  } else {
    fail('TC-3.6', `期望 400/404，实际收到 ${r6.status}`);
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  XSync Extension Bridge — E2E API Tests  ║');
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`  Backend: ${BACKEND}`);

  // 检查后端是否在线
  const online = await checkBackend();
  if (!online) {
    console.error(`\n❌ 后端服务不可达 (${BACKEND})`);
    console.error('   请先启动后端：nx serve backend');
    process.exit(2);
  }
  console.log('  ✅ 后端在线\n');

  if (ARGS.has('--setup-only')) {
    await setup();
    console.log('Setup 完成，跳过测试（--setup-only）');
    process.exit(0);
  }

  if (!ARGS.has('--skip-setup')) {
    const ok = await setup();
    if (!ok) {
      console.warn('⚠️  Fixtures 创建失败，尝试使用已有数据继续测试...\n');
    }
  }

  try {
    await runTests();
  } finally {
    if (!ARGS.has('--no-teardown')) {
      await teardown();
    } else {
      console.log('\n  ℹ️  --no-teardown: 保留测试数据（调试用）');
    }
  }

  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  结果: ${passed} 通过  ${failed} 失败  共 ${passed + failed} 个  ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('致命错误:', err);
  process.exit(1);
});
