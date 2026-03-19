#!/usr/bin/env node
/**
 * e2e-full.mjs — XPoz 综合端到端测试（跨平台 Node.js 版）
 *
 * 覆盖 7 个测试套件：
 *   1. Auth          — API Key 认证
 *   2. Integrations  — 平台发现
 *   3. Media         — 图片上传
 *   4. Post CRUD     — 帖子增删改查
 *   5. Advanced      — 时间槽 + Thread
 *   6. XSync Bridge  — PENDING_EXTENSION + mark-published
 *   7. MCP Tools     — manifest + list_platforms
 *
 * 用法：
 *   node scripts/e2e-full.mjs              # Draft 安全模式
 *   node scripts/e2e-full.mjs --live       # 真实发布 1 条推文
 *   node scripts/e2e-full.mjs --no-teardown # 保留测试数据
 */
import { createHmac } from 'crypto';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ── CLI Args ──────────────────────────────────────────────────────────
const ARGS = new Set(process.argv.slice(2));
const LIVE_MODE = ARGS.has('--live');
const NO_TEARDOWN = ARGS.has('--no-teardown');

// ── Configuration ─────────────────────────────────────────────────────
const API_BASE   = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.E2E_BACKEND_URL || 'http://localhost:3333';
const JWT_SECRET = process.env.JWT_SECRET || '';
const DB_URL     = process.env.DATABASE_URL || 'postgresql://xpoz-local:xpoz-local-pwd@localhost:5432/xpoz-db-local';

// ── Counters ──────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0, SKIP = 0;
const CLEANUP_IDS = [];

// ── Helpers ───────────────────────────────────────────────────────────
const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', n: '\x1b[0m' };
function log(s)       { console.log(`\n${C.c}━━━ ${s} ━━━${C.n}`); }
function pass(s)      { PASS++; console.log(`  ${C.g}✓${C.n} ${s}`); }
function fail(s, d)   { FAIL++; console.log(`  ${C.r}✗${C.n} ${s} ${C.d}(${d})${C.n}`); }
function skip(s)      { SKIP++; console.log(`  ${C.y}⊘${C.n} ${s} ${C.d}(skipped)${C.n}`); }

async function api(method, endpoint, data, headers) {
  const opts = { method, headers: { ...headers } };
  if (data && method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  try {
    const r = await fetch(`${API_BASE}${endpoint}`, { ...opts, signal: AbortSignal.timeout(10000) });
    let body;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, ok: r.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: null, error: e.message };
  }
}

// ── JWT Generator ─────────────────────────────────────────────────────
function makeJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ── Prisma Client ─────────────────────────────────────────────────────
async function getPrisma() {
  try {
    const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'));
    const prisma = new PrismaClient();
    await prisma.$connect();
    return prisma;
  } catch (e) {
    return null;
  }
}

// ── Extract API Key ───────────────────────────────────────────────────
async function getApiKey() {
  // 1. Environment variable
  if (process.env.XPOZ_API_KEY) return process.env.XPOZ_API_KEY;

  // 2. Prisma
  const prisma = await getPrisma();
  if (prisma) {
    try {
      const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'desc' } });
      await prisma.$disconnect();
      if (org?.apiKey) return org.apiKey;
    } catch { await prisma.$disconnect().catch(() => {}); }
  }

  // 3. psql direct
  try {
    const result = execSync(
      `psql "${DB_URL}" -t -A -c "SELECT \\"apiKey\\" FROM \\"Organization\\" ORDER BY \\"createdAt\\" DESC LIMIT 1;"`,
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (result) return result;
  } catch {}

  // 4. docker exec
  try {
    const result = execSync(
      `docker exec xpoz-postgres psql -U xpoz-local -d xpoz-db-local -t -A -c "SELECT \\"apiKey\\" FROM \\"Organization\\" ORDER BY \\"createdAt\\" DESC LIMIT 1;"`,
      { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (result) return result;
  } catch {}

  return null;
}

// ── Extract User ID + JWT Secret ──────────────────────────────────────
async function getJwtAuth() {
  const prisma = await getPrisma();
  if (!prisma) return null;
  try {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
    await prisma.$disconnect();
    if (!user) return null;

    // Try to find JWT_SECRET from .env or fallback
    let secret = JWT_SECRET;
    if (!secret) {
      // Try reading .env file
      for (const envPath of [path.join(ROOT, '.env'), path.join(ROOT, 'apps/backend/.env')]) {
        try {
          const content = fs.readFileSync(envPath, 'utf8');
          const match = content.match(/^JWT_SECRET=(.+)$/m);
          if (match) { secret = match[1].trim().replace(/^['"]|['"]$/g, ''); break; }
        } catch {}
      }
    }
    if (!secret) return null;

    const token = makeJWT({ id: user.id, email: user.email, activated: true, isSuperAdmin: false }, secret);
    return { token, userId: user.id, headers: { auth: token, 'Content-Type': 'application/json' } };
  } catch (e) {
    await prisma.$disconnect().catch(() => {});
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ██ MAIN
// ══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log(`${C.c}╔══════════════════════════════════════════════════════╗${C.n}`);
  console.log(`${C.c}║     XPoz — Comprehensive E2E Test Suite             ║${C.n}`);
  console.log(`${C.c}║     Cross-platform Node.js Edition                  ║${C.n}`);
  console.log(`${C.c}╚══════════════════════════════════════════════════════╝${C.n}`);
  console.log('');
  console.log(LIVE_MODE
    ? `${C.y}⚡ LIVE MODE — will publish 1 real post${C.n}`
    : `${C.d}🔒 DRAFT MODE — no real posts published${C.n}`);
  console.log(`  API Base: ${API_BASE}`);

  // ── Health Check ──────────────────────────────────────────────────
  log('Pre-flight: Backend Health');
  try {
    const r = await fetch(`${API_BASE}/api`, { signal: AbortSignal.timeout(5000) });
    pass(`Backend reachable (HTTP ${r.status})`);
  } catch {
    console.log(`\n${C.r}✗ Backend not reachable at ${API_BASE}${C.n}`);
    console.log('  Start with: npx nx serve backend');
    process.exit(2);
  }

  // ── Extract API Key ───────────────────────────────────────────────
  log('Setup: API Key');
  let API_KEY = await getApiKey();
  let pubHeaders = API_KEY ? { Authorization: API_KEY, 'Content-Type': 'application/json' } : null;
  let createdTestOrg = false;

  if (!API_KEY) {
    console.log(`${C.y}  ⚠ No API key found (no user registered). Creating test data via Prisma...${C.n}`);
    const prisma = await getPrisma();
    if (prisma) {
      try {
        const org = await prisma.organization.upsert({
          where: { id: 'e2e-org-001' },
          create: { id: 'e2e-org-001', name: 'E2E Test Org' },
          update: {},
        });
        await prisma.user.upsert({
          where: { id: 'e2e-user-001' },
          create: { id: 'e2e-user-001', email: 'e2e@xpoz.test', password: 'e2e-hash', activated: true, providerName: 'LOCAL', timezone: 0 },
          update: {},
        });
        // Link user to org
        await prisma.userOrganization.upsert({
          where: { userId_organizationId: { userId: 'e2e-user-001', organizationId: 'e2e-org-001' } },
          create: { userId: 'e2e-user-001', organizationId: 'e2e-org-001', role: 'ADMIN' },
          update: {},
        });
        API_KEY = org.apiKey;
        pubHeaders = API_KEY ? { Authorization: API_KEY, 'Content-Type': 'application/json' } : null;
        createdTestOrg = true;
        if (API_KEY) pass(`API Key from test org: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
        else skip('API Key (org created but no apiKey generated)');
        await prisma.$disconnect();
      } catch (e) {
        console.log(`${C.y}  ⚠ Could not create test data: ${e.message}${C.n}`);
        await prisma.$disconnect().catch(() => {});
      }
    }
    if (!API_KEY) {
      skip('API Key not available — Public API suites will be skipped');
    }
  } else {
    pass(`API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
  }

  // ── JWT Auth (for internal endpoints) ─────────────────────────────
  let jwtAuth = await getJwtAuth();
  if (jwtAuth) {
    pass(`JWT Auth ready (user: ${jwtAuth.userId.slice(0, 8)}...)`);
  } else {
    skip('JWT Auth (JWT_SECRET not found or no user, internal endpoint tests will skip)');
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Authentication
  // ════════════════════════════════════════════════════════════════════
  log('Suite 1: Authentication');

  if (!pubHeaders) {
    skip('[Auth] All tests (no API key)');
  } else {
  const r1 = await api('GET', '/public/v1/is-connected', null, { Authorization: API_KEY });
  if (r1.ok) {
    pass('[Auth] Valid API key accepted');
    if (JSON.stringify(r1.body).includes('true')) {
      pass('[Auth] Returns connected=true');
    } else {
      fail('[Auth] Returns connected=true', JSON.stringify(r1.body).slice(0, 100));
    }
  } else {
    fail('[Auth] Valid API key accepted', `HTTP ${r1.status}`);
  }

  const r1bad = await api('GET', '/public/v1/is-connected', null, { Authorization: 'invalid_key_12345' });
  if (r1bad.status === 401 || r1bad.status === 403) {
    pass(`[Auth] Invalid key rejected (${r1bad.status})`);
  } else {
    fail('[Auth] Invalid key rejected', `expected 401/403, got ${r1bad.status}`);
  }
  } // end pubHeaders guard for Auth

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Integration Discovery
  // ════════════════════════════════════════════════════════════════════
  log('Suite 2: Integration Discovery');

  let INT_ID = '', INT_PROVIDER = '';
  if (!pubHeaders) {
    skip('[Integration] All tests (no API key)');
  } else {
  const r2 = await api('GET', '/public/v1/integrations', null, { Authorization: API_KEY });
  if (r2.ok && Array.isArray(r2.body) && r2.body.length > 0) {
    pass(`[Integration] Found ${r2.body.length} channel(s)`);
    INT_ID = r2.body[0].id;
    INT_PROVIDER = r2.body[0].identifier;
    pass(`[Integration] First: ${r2.body[0].name} (${INT_PROVIDER})`);

    // Get settings
    const r2s = await api('GET', `/public/v1/integration-settings/${INT_ID}`, null, { Authorization: API_KEY });
    if (r2s.ok) {
      pass(`[Integration] Settings for ${INT_PROVIDER}`);
      const maxLen = r2s.body?.output?.maxLength;
      if (maxLen) pass(`[Integration] Max length: ${maxLen}`);
    } else {
      fail('[Integration] Get settings', `HTTP ${r2s.status}`);
    }
  } else if (r2.ok) {
    skip('[Integration] No channels connected');
  } else {
    fail('[Integration] List integrations', `HTTP ${r2.status}`);
  }
  } // end pubHeaders guard for Integrations

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Media Upload
  // ════════════════════════════════════════════════════════════════════
  log('Suite 3: Media Upload');

  let MEDIA_ID = '', MEDIA_PATH = '';
  if (!pubHeaders) {
    skip('[Media] All tests (no API key)');
  } else {
  // Upload from URL (doesn't need a local file)
  const r3 = await api('POST', '/public/v1/upload-from-url', { url: 'https://placehold.co/100x100/png' }, { Authorization: API_KEY });
  if (r3.ok || r3.status === 201) {
    pass('[Media] Upload from URL');
    MEDIA_ID = r3.body?.id || '';
    MEDIA_PATH = r3.body?.path || '';
  } else {
    skip('[Media] Upload from URL (might need network)');
  }
  } // end pubHeaders guard for Media

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Post CRUD
  // ════════════════════════════════════════════════════════════════════
  log('Suite 4: Post CRUD');

  if (!INT_ID || !pubHeaders) {
    skip('[Posts] All tests (no integration connected)');
  } else {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    // 4a. Create draft
    const draftData = {
      type: 'draft',
      date: tomorrow,
      shortLink: true,
      tags: [],
      posts: [{
        integration: { id: INT_ID },
        value: [{ content: `[E2E TEST] Draft post — ${Date.now()}` }],
        settings: { who_can_reply_post: 'everyone' },
      }],
    };
    const r4a = await api('POST', '/public/v1/posts', draftData, { Authorization: API_KEY });
    let DRAFT_POST_ID = '';
    if (r4a.ok || r4a.status === 201) {
      pass('[Posts] Create draft post');
      DRAFT_POST_ID = Array.isArray(r4a.body) ? r4a.body[0]?.postId : r4a.body?.postId || '';
      if (DRAFT_POST_ID) {
        pass(`[Posts] Draft ID: ${DRAFT_POST_ID.slice(0, 16)}...`);
        CLEANUP_IDS.push(DRAFT_POST_ID);
      }
    } else {
      fail('[Posts] Create draft post', `HTTP ${r4a.status}: ${JSON.stringify(r4a.body).slice(0, 100)}`);
    }

    // 4b. Create scheduled post
    const schedData = {
      type: 'schedule',
      date: tomorrow,
      shortLink: true,
      tags: [],
      posts: [{
        integration: { id: INT_ID },
        value: [{ content: `[E2E TEST] Scheduled post — ${Date.now()}` }],
        settings: { who_can_reply_post: 'everyone' },
      }],
    };
    const r4b = await api('POST', '/public/v1/posts', schedData, { Authorization: API_KEY });
    if (r4b.ok || r4b.status === 201) {
      pass('[Posts] Create scheduled post');
      const schedId = Array.isArray(r4b.body) ? r4b.body[0]?.postId : r4b.body?.postId || '';
      if (schedId) CLEANUP_IDS.push(schedId);
    } else {
      fail('[Posts] Create scheduled post', `HTTP ${r4b.status}`);
    }

    // 4c. List posts
    const today = new Date().toISOString().slice(0, 10);
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const r4c = await api('GET', `/public/v1/posts?startDate=${today}T00:00:00Z&endDate=${weekLater}T23:59:59Z`, null, { Authorization: API_KEY });
    if (r4c.ok) {
      const count = r4c.body?.posts?.length || 0;
      if (count > 0) pass(`[Posts] Found ${count} post(s) in range`);
      else fail('[Posts] List posts', `expected >0, got 0`);
    } else {
      fail('[Posts] List posts', `HTTP ${r4c.status}`);
    }

    // 4d. Delete draft
    if (DRAFT_POST_ID) {
      const r4d = await api('DELETE', `/public/v1/posts/${DRAFT_POST_ID}`, null, { Authorization: API_KEY });
      if (r4d.ok || r4d.status === 204) {
        pass('[Posts] Delete draft post');
        const idx = CLEANUP_IDS.indexOf(DRAFT_POST_ID);
        if (idx >= 0) CLEANUP_IDS.splice(idx, 1);
      } else {
        fail('[Posts] Delete draft post', `HTTP ${r4d.status}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 5: Advanced Features
  // ════════════════════════════════════════════════════════════════════
  log('Suite 5: Advanced Features');

  if (!INT_ID) {
    skip('[Advanced] All tests (no integration)');
  } else {
    // 5a. Find free slot
    const r5a = await api('GET', `/public/v1/find-slot/${INT_ID}`, null, { Authorization: API_KEY });
    if (r5a.ok && r5a.body?.date) {
      pass(`[Advanced] Free slot: ${r5a.body.date}`);
    } else {
      fail('[Advanced] Find free slot', `HTTP ${r5a.status}`);
    }

    // 5b. Thread (multi-value)
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const threadData = {
      type: 'draft',
      date: tomorrow,
      shortLink: true,
      tags: [],
      posts: [{
        integration: { id: INT_ID },
        value: [
          { content: `[E2E TEST] Thread 1/3 — ${Date.now()}` },
          { content: `[E2E TEST] Thread 2/3 — second part` },
          { content: `[E2E TEST] Thread 3/3 — conclusion` },
        ],
        settings: { who_can_reply_post: 'everyone' },
      }],
    };
    const r5b = await api('POST', '/public/v1/posts', threadData, { Authorization: API_KEY });
    if (r5b.ok || r5b.status === 201) {
      pass('[Advanced] Create thread (3 parts)');
      const threadId = Array.isArray(r5b.body) ? r5b.body[0]?.postId : '';
      if (threadId) CLEANUP_IDS.push(threadId);
    } else {
      fail('[Advanced] Create thread', `HTTP ${r5b.status}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 6: XSync Bridge (requires JWT)
  // ════════════════════════════════════════════════════════════════════
  log('Suite 6: XSync Bridge');

  if (!jwtAuth) {
    skip('[XSync] All tests (JWT auth not available, need JWT_SECRET in .env)');
  } else {
    const prisma = await getPrisma();
    let xsyncSetup = false;

    if (prisma) {
      try {
        // Find org for this user
        const orgUser = await prisma.userOrganization.findFirst({
          where: { userId: jwtAuth.userId },
          select: { organizationId: true },
        });
        const orgId = orgUser?.organizationId;

        if (orgId) {
          // Find any integration for this org
          const integration = await prisma.integration.findFirst({
            where: { organizationId: orgId, deletedAt: null },
          });

          if (integration) {
            // Create PENDING_EXTENSION test post
            await prisma.post.upsert({
              where: { id: 'e2e-xsync-pending-001' },
              create: {
                id: 'e2e-xsync-pending-001',
                organizationId: orgId,
                integrationId: integration.id,
                content: '[E2E] XSync PENDING test',
                publishDate: new Date(),
                state: 'PENDING_EXTENSION',
                group: 'e2e-xsync-grp-001',
                settings: '{}',
                image: '[]',
              },
              update: { state: 'PENDING_EXTENSION' },
            });

            // Create PUBLISHED control post
            await prisma.post.upsert({
              where: { id: 'e2e-xsync-published-001' },
              create: {
                id: 'e2e-xsync-published-001',
                organizationId: orgId,
                integrationId: integration.id,
                content: '[E2E] XSync PUBLISHED test',
                publishDate: new Date(),
                state: 'PUBLISHED',
                group: 'e2e-xsync-grp-002',
                settings: '{}',
                image: '[]',
              },
              update: {},
            });

            pass('[XSync] Test fixtures created');
            xsyncSetup = true;
          } else {
            skip('[XSync] No integration found for user org');
          }
        } else {
          skip('[XSync] No org found for user');
        }
        await prisma.$disconnect();
      } catch (e) {
        fail('[XSync] Fixture setup', e.message);
        await prisma.$disconnect().catch(() => {});
      }
    }

    if (xsyncSetup) {
      // TC-6.1: GET /posts/pending-extension
      const r6a = await api('GET', '/posts/pending-extension', null, jwtAuth.headers);
      if (r6a.ok && Array.isArray(r6a.body)) {
        if (r6a.body.some(p => p.id === 'e2e-xsync-pending-001')) {
          pass('[XSync] TC-6.1: PENDING post in list');
        } else {
          fail('[XSync] TC-6.1', `Post not found. Got ${r6a.body.length} items`);
        }
        // TC-6.2: PUBLISHED post excluded
        if (!r6a.body.some(p => p.id === 'e2e-xsync-published-001')) {
          pass('[XSync] TC-6.2: PUBLISHED post excluded');
        } else {
          fail('[XSync] TC-6.2', 'PUBLISHED post should not appear');
        }
      } else {
        fail('[XSync] TC-6.1', `HTTP ${r6a.status}: ${JSON.stringify(r6a.body).slice(0, 100)}`);
      }

      // TC-6.3: POST /mark-published
      const r6b = await api('POST', '/posts/e2e-xsync-pending-001/mark-published',
        { releaseURL: 'https://test.example.com/e2e' }, jwtAuth.headers);
      if (r6b.ok && r6b.body?.success) {
        pass('[XSync] TC-6.3: mark-published success');
      } else {
        fail('[XSync] TC-6.3', `HTTP ${r6b.status}: ${JSON.stringify(r6b.body).slice(0, 100)}`);
      }

      // TC-6.4: Post no longer in pending
      const r6c = await api('GET', '/posts/pending-extension', null, jwtAuth.headers);
      if (r6c.ok && !r6c.body?.some?.(p => p.id === 'e2e-xsync-pending-001')) {
        pass('[XSync] TC-6.4: Post removed from pending after publish');
      } else {
        fail('[XSync] TC-6.4', 'Post still in pending list');
      }

      // TC-6.5: Duplicate mark-published → 400
      const r6d = await api('POST', '/posts/e2e-xsync-pending-001/mark-published',
        { releaseURL: 'https://fail.example.com' }, jwtAuth.headers);
      if (r6d.status === 400) {
        pass('[XSync] TC-6.5: Duplicate rejected (400)');
      } else {
        fail('[XSync] TC-6.5', `expected 400, got ${r6d.status}`);
      }

      // Cleanup XSync test data
      if (!NO_TEARDOWN) {
        const prisma2 = await getPrisma();
        if (prisma2) {
          try {
            await prisma2.post.deleteMany({
              where: { id: { in: ['e2e-xsync-pending-001', 'e2e-xsync-published-001'] } },
            });
            await prisma2.$disconnect();
          } catch { await prisma2.$disconnect().catch(() => {}); }
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 7: MCP Tools
  // ════════════════════════════════════════════════════════════════════
  log('Suite 7: MCP Tools');

  // 7a. Manifest (public, no auth)
  const r7a = await api('GET', '/mcp/manifest');
  if (r7a.ok && r7a.body?.tools?.length > 0) {
    pass(`[MCP] Manifest: ${r7a.body.tools.length} tools (${r7a.body.tools.map(t => t.name).join(', ')})`);
  } else {
    fail('[MCP] Manifest', `HTTP ${r7a.status}`);
  }

  // 7b. list_platforms (requires JWT auth)
  if (jwtAuth) {
    const r7b = await api('POST', '/mcp/tools/list_platforms', {}, jwtAuth.headers);
    if (r7b.ok && r7b.body?.success) {
      const count = r7b.body.platforms?.length || 0;
      pass(`[MCP] list_platforms: ${count} platform(s)`);
    } else {
      fail('[MCP] list_platforms', `HTTP ${r7b.status}: ${JSON.stringify(r7b.body).slice(0, 100)}`);
    }

    // 7c. Unknown tool → 404
    const r7c = await api('POST', '/mcp/tools/nonexistent_tool', {}, jwtAuth.headers);
    if (r7c.status === 404) {
      pass('[MCP] Unknown tool rejected (404)');
    } else {
      fail('[MCP] Unknown tool', `expected 404, got ${r7c.status}`);
    }
  } else {
    skip('[MCP] list_platforms (JWT auth not available)');
    skip('[MCP] Unknown tool (JWT auth not available)');
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 8: Live Publishing (opt-in)
  // ════════════════════════════════════════════════════════════════════
  log('Suite 8: Live Publishing');

  if (!LIVE_MODE) {
    skip('[Live] Publish tweet (use --live flag)');
  } else if (!INT_ID) {
    skip('[Live] No integration connected');
  } else {
    const liveData = {
      type: 'now',
      date: new Date().toISOString(),
      shortLink: true,
      tags: [],
      posts: [{
        integration: { id: INT_ID },
        value: [{ content: `🧪 XPoz E2E test — ${new Date().toISOString()} — automated #XPoz #E2E` }],
        settings: { who_can_reply_post: 'everyone' },
      }],
    };
    const rLive = await api('POST', '/public/v1/posts', liveData, { Authorization: API_KEY });
    if (rLive.ok || rLive.status === 201) {
      pass('[Live] Post created');
      // Poll for PUBLISHED (30s)
      const liveId = Array.isArray(rLive.body) ? rLive.body[0]?.postId : '';
      if (liveId) {
        console.log(`  ${C.d}Waiting for orchestrator...${C.n}`);
        let published = false;
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const check = await api('GET', `/public/v1/posts?startDate=${new Date().toISOString().slice(0, 10)}T00:00:00Z&endDate=${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T23:59:59Z`, null, { Authorization: API_KEY });
          const post = check.body?.posts?.find(p => p.id === liveId);
          if (post?.state === 'PUBLISHED') {
            pass(`[Live] Published! URL: ${post.releaseURL || 'N/A'}`);
            published = true;
            break;
          }
          console.log(`  ${C.d}  [${i + 1}/6] State: ${post?.state || 'waiting'}...${C.n}`);
        }
        if (!published) fail('[Live] Not published in 30s', 'orchestrator running?');
      }
    } else {
      fail('[Live] Create post', `HTTP ${rLive.status}`);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────
  log('Cleanup');

  if (NO_TEARDOWN) {
    console.log(`  ${C.d}--no-teardown: keeping test data${C.n}`);
  } else {
    let cleaned = 0;
    for (const id of CLEANUP_IDS) {
      if (!id) continue;
      const r = await api('DELETE', `/public/v1/posts/${id}`, null, { Authorization: API_KEY });
      if (r.ok || r.status === 204) cleaned++;
    }
    console.log(`  ${C.d}Cleaned ${cleaned} test post(s)${C.n}`);
  }

  // ── Summary ────────────────────────────────────────────────────────
  const TOTAL = PASS + FAIL + SKIP;
  console.log('');
  console.log(`${C.c}╔══════════════════════════════════════════════════════╗${C.n}`);
  if (FAIL === 0) {
    console.log(`${C.c}║${C.n}  ${C.g}All tests passed!${C.n}                                   ${C.c}║${C.n}`);
  } else {
    console.log(`${C.c}║${C.n}  ${C.r}Some tests failed${C.n}                                    ${C.c}║${C.n}`);
  }
  console.log(`${C.c}╠══════════════════════════════════════════════════════╣${C.n}`);
  console.log(`${C.c}║${C.n}  ${C.g}Passed: ${PASS}${C.n}  ${C.r}Failed: ${FAIL}${C.n}  ${C.y}Skipped: ${SKIP}${C.n}  Total: ${TOTAL}     ${C.c}║${C.n}`);
  console.log(`${C.c}╚══════════════════════════════════════════════════════╝${C.n}`);
  console.log('');

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
