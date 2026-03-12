const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const http = require('http');

const API_KEY = 'breppPgzoWKbFDY6trYQBbFjH';
const API_SECRET = 'wmOSVA4GlirP1elX0nwBH1nbpmBsPk3z1tsuUQ94ievFLcCscu';
const ACCESS_TOKEN = '2031303571027931137-tEQogFFuMtlIW8Ivo98YFpiw7l0Deo';
const ACCESS_SECRET = 'vYI7maVGhsjnj3siPECqsNYFvdpOawAOwN8LRR9JKJoUH';
const PROXY = 'http://127.0.0.1:7897';

function oauthHeader(method, reqUrl) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Math.floor(Date.now() / 1000).toString();
  const op = {
    oauth_consumer_key: API_KEY, oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: ts,
    oauth_token: ACCESS_TOKEN, oauth_version: '1.0',
  };
  const ps = Object.keys(op).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(op[k])}`).join('&');
  const bs = `${method}&${encodeURIComponent(reqUrl)}&${encodeURIComponent(ps)}`;
  const sk = `${encodeURIComponent(API_SECRET)}&${encodeURIComponent(ACCESS_SECRET)}`;
  op.oauth_signature = crypto.createHmac('sha1', sk).update(bs).digest('base64');
  return 'OAuth ' + Object.keys(op).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(op[k])}"`).join(', ');
}

function proxyFetch(targetUrl, options) {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const proxy = new URL(PROXY);
    const connectReq = http.request({
      host: proxy.hostname, port: proxy.port,
      method: 'CONNECT', path: `${target.hostname}:443`,
    });
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) { reject(new Error('Proxy CONNECT failed: ' + res.statusCode)); return; }
      const req = https.request({
        hostname: target.hostname, path: target.pathname + target.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        socket, agent: false,
      }, (response) => {
        let data = '';
        response.on('data', c => data += c);
        response.on('end', () => resolve({ status: response.statusCode, body: data }));
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
    connectReq.on('error', reject);
    connectReq.end();
  });
}

async function main() {
  // Use a small test image - create one if needed
  let buf;
  if (fs.existsSync('/tmp/test_rage.png')) {
    buf = fs.readFileSync('/tmp/test_rage.png');
  } else {
    // Create a minimal 1x1 red PNG
    buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync('/tmp/test_rage.png', buf);
  }
  console.log('[1] Image:', buf.length, 'bytes');

  // v2 Simple Upload: POST /2/media/upload with JSON {media, media_type, media_category}
  const UPLOAD_URL = 'https://api.x.com/2/media/upload';
  const auth = oauthHeader('POST', UPLOAD_URL);
  console.log('[2] v2 Simple upload (JSON)...');
  
  const uploadBody = JSON.stringify({
    media: buf.toString('base64'),
    media_type: 'image/png',
    media_category: 'tweet_image',
  });
  console.log('[2] Body size:', uploadBody.length, 'chars');

  const res = await proxyFetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: uploadBody,
  });
  
  console.log('[2] Response status:', res.status);
  console.log('[2] Response body:', res.body.substring(0, 500));
  
  if (res.status >= 400) {
    console.error('[2] UPLOAD FAILED');
    process.exit(1);
  }

  const data = JSON.parse(res.body);
  const mediaId = data?.data?.id || data?.id || data?.media_id_string;
  console.log('[2] SUCCESS! media_id:', mediaId);

  // POST TWEET with media using OAuth 2.0 Bearer token from DB
  let bearerToken;
  try {
    bearerToken = require('child_process').execSync(
      `docker exec postiz-postgres psql -U postiz-local -d postiz-db-local -t -c "SELECT token FROM \\"Integration\\" WHERE \\"providerIdentifier\\"='x' LIMIT 1;"`
    ).toString().trim();
  } catch (e) {
    console.log('[3] Could not get bearer token from DB, skipping tweet');
    process.exit(0);
  }

  console.log('[3] Posting tweet with media_id:', mediaId);
  const tr = await proxyFetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Image upload working! ' + new Date().toISOString().slice(11, 19),
      media: { media_ids: [mediaId] },
    }),
  });
  console.log('[3] Tweet:', tr.status, tr.body.substring(0, 300));
  
  if (tr.status === 201) {
    const td = JSON.parse(tr.body);
    console.log('[3] SUCCESS! URL: https://x.com/i/status/' + td.data.id);
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
