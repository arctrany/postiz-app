import { createHmac } from 'crypto';

const JWT_SECRET = 'xpoz-dev-jwt-secret-2026-arctrany-e2e-testing';
const BACKEND = 'http://localhost:3333';

// JWT payload: full User object
function makeJWT(payload) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify({...payload, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const token = makeJWT({
  id: '5220694d-2a9f-4ad0-957e-dc33097148de',
  email: 'admin@xpoz.local',
  activated: true,
  isSuperAdmin: false,
});

// Note: backend uses 'auth' header, NOT 'Authorization: Bearer'
const headers = { 'auth': token, 'Content-Type': 'application/json' };

let passed = 0, failed = 0;
function pass(name) { console.log(`✅ PASS: ${name}`); passed++; }
function fail(name, detail) { console.log(`❌ FAIL: ${name} — ${detail}`); failed++; }

try {
  // TC-3.1: GET /pending-extension
  console.log('\n=== TC-3.1: GET /pending-extension ===');
  const r1 = await fetch(`${BACKEND}/posts/pending-extension`, { headers });
  if (!r1.ok) { fail('TC-3.1', `HTTP ${r1.status}: ${await r1.text()}`); }
  else {
    const pending = await r1.json();
    const found = Array.isArray(pending) && pending.some(p => p.id === 'e2e-test-xsync-001');
    if (found) pass('TC-3.1: PENDING_EXTENSION post found in /pending-extension');
    else fail('TC-3.1', `Post not found. Got: ${JSON.stringify(pending).slice(0,300)}`);

    // TC-3.2: Published post NOT in pending list
    const bad = Array.isArray(pending) && pending.some(p => p.id === 'e2e-test-xsync-002');
    if (!bad) pass('TC-3.2: Published post correctly excluded');
    else fail('TC-3.2', 'Published post should NOT appear');
  }

  // TC-3.3: POST /mark-published (success)
  console.log('\n=== TC-3.3: POST /mark-published (success) ===');
  const r3 = await fetch(`${BACKEND}/posts/e2e-test-xsync-001/mark-published`, {
    method: 'POST', headers,
    body: JSON.stringify({ releaseURL: 'https://test.example.com/e2e-bridge-test' })
  });
  if (r3.ok) {
    const b3 = await r3.json();
    if (b3.success) pass('TC-3.3: mark-published returned success');
    else fail('TC-3.3', JSON.stringify(b3));
  } else fail('TC-3.3', `HTTP ${r3.status}: ${await r3.text()}`);

  // TC-3.3b: Verify state = PUBLISHED in GET /posts/:id
  console.log('\n=== TC-3.3b: State = PUBLISHED ===');
  const r3b = await fetch(`${BACKEND}/posts/e2e-test-xsync-001`, { headers });
  if (r3b.ok) {
    const p = await r3b.json();
    if (p.state === 'PUBLISHED') pass('TC-3.3b: State updated to PUBLISHED');
    else fail('TC-3.3b', `State = "${p.state}"`);
  } else fail('TC-3.3b', `HTTP ${r3b.status}`);

  // TC-3.5: Reject mark-published on non-PENDING post
  console.log('\n=== TC-3.5: Reject non-PENDING ===');
  const r5 = await fetch(`${BACKEND}/posts/e2e-test-xsync-001/mark-published`, {
    method: 'POST', headers,
    body: JSON.stringify({ releaseURL: 'https://should-fail.example.com' })
  });
  if (r5.status === 400) pass('TC-3.5: Correctly rejected (400)');
  else fail('TC-3.5', `Expected 400, got ${r5.status}`);

} catch (err) { console.error('Error:', err); }

console.log(`\n========================================`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);
process.exit(failed > 0 ? 1 : 0);
