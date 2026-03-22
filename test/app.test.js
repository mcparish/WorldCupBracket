'use strict';

/**
 * Basic smoke tests for WorldCupBracket using Node's built-in test runner.
 *
 * Run with:  npm test
 *            node --test test/app.test.js
 */

const { test, before, after } = require('node:test');
const assert  = require('node:assert/strict');
const http    = require('node:http');

// Use a separate temp DB for tests
process.env.DB_PATH = require('path').join(require('os').tmpdir(), `wc_test_${require('crypto').randomUUID()}.db`);

const app    = require('../src/app');
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Clean up temp DB
  try {
    require('fs').unlinkSync(process.env.DB_PATH);
  } catch (_) {}
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function get(urlPath, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${urlPath}`, { headers: cookie ? { Cookie: cookie } : {} }, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
  });
}

function post(urlPath, body, cookie = '') {
  return new Promise((resolve, reject) => {
    const encoded = new URLSearchParams(body).toString();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(encoded),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(`${baseUrl}${urlPath}`, options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(encoded);
    req.end();
  });
}

function extractCookie(headers) {
  const raw = headers['set-cookie'] || [];
  return raw.map(c => c.split(';')[0]).join('; ');
}

/** Fetch a GET page, extract the CSRF token from the HTML, and return {csrfToken, cookie}. */
async function getCsrfToken(urlPath, cookie = '') {
  const res = await get(urlPath, cookie);
  const allCookies = [
    ...(cookie ? cookie.split('; ') : []),
    ...extractCookie(res.headers).split('; ').filter(Boolean),
  ];
  const uniqueCookies = [...new Map(allCookies.map(c => [c.split('=')[0], c])).values()];
  const combinedCookie = uniqueCookies.join('; ');
  const match = res.body.match(/name="_csrf"\s+value="([^"]+)"/);
  return { csrfToken: match ? match[1] : '', cookie: combinedCookie };
}

/** Register a user, returning {cookie} for subsequent requests. */
async function registerUser(username, email, password = 'secret123') {
  // First get a CSRF token from the register page
  const { csrfToken, cookie: preCookie } = await getCsrfToken('/auth/register');
  const res = await post('/auth/register', {
    username, email, password, confirm_password: password, _csrf: csrfToken,
  }, preCookie);
  const sessionCookie = extractCookie(res.headers);
  const allCookies = [
    ...preCookie.split('; ').filter(Boolean),
    ...sessionCookie.split('; ').filter(Boolean),
  ];
  const unique = [...new Map(allCookies.map(c => [c.split('=')[0], c])).values()];
  return { res, cookie: unique.join('; ') };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('GET / shows home page for unauthenticated users', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('World Cup 2026'));
});

test('GET / redirects to /dashboard for logged-in users', async () => {
  const { cookie } = await registerUser('hometest', 'hometest@example.com');
  const res = await get('/', cookie);
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/dashboard');
});

test('GET /auth/login returns 200', async () => {
  const res = await get('/auth/login');
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('Login'));
});

test('GET /auth/register returns 200', async () => {
  const res = await get('/auth/register');
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('Create Account'));
});

test('POST /auth/register creates user and redirects to dashboard', async () => {
  const { res } = await registerUser('alice', 'alice@example.com');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/dashboard');
});

test('POST /auth/register rejects duplicate username', async () => {
  // alice already created above; try again with same username
  const { csrfToken, cookie: preCookie } = await getCsrfToken('/auth/register');
  const res = await post('/auth/register', {
    username: 'alice',
    email: 'alice2@example.com',
    password: 'secret123',
    confirm_password: 'secret123',
    _csrf: csrfToken,
  }, preCookie);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('already taken'));
});

test('POST /auth/register rejects mismatched passwords', async () => {
  const { csrfToken, cookie: preCookie } = await getCsrfToken('/auth/register');
  const res = await post('/auth/register', {
    username: 'bob',
    email: 'bob@example.com',
    password: 'abc123',
    confirm_password: 'abc456',
    _csrf: csrfToken,
  }, preCookie);
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('do not match'));
});

test('Full login flow: register, login, access dashboard, create bracket', async () => {
  const { res: reg, cookie } = await registerUser('charlie', 'charlie@example.com', 'hunter42');
  assert.equal(reg.status, 302);
  assert.ok(cookie.length > 0, 'Should receive session cookie');

  // Dashboard should be accessible
  const dash = await get('/dashboard', cookie);
  assert.equal(dash.status, 200);
  assert.ok(dash.body.includes('My Brackets'));

  // Create a bracket (get CSRF token from dashboard)
  const { csrfToken, cookie: dashCookie } = await getCsrfToken('/dashboard', cookie);
  const create = await post('/dashboard/create', { name: 'Test Bracket', _csrf: csrfToken }, dashCookie);
  assert.equal(create.status, 302);
  assert.match(create.headers.location, /\/bracket\/\d+\/group/);

  // Group picks page should load
  const bracketId = create.headers.location.match(/\/bracket\/(\d+)\/group/)[1];
  const group = await get(`/bracket/${bracketId}/group`, cookie);
  assert.equal(group.status, 200);
  assert.ok(group.body.includes('Group Stage Picks'));
  assert.ok(group.body.includes('Group A'));
});

test('Unauthenticated access to /dashboard redirects to login', async () => {
  const res = await get('/dashboard');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/auth/login');
});

test('GET /standings returns 200', async () => {
  const res = await get('/standings');
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('Standings'));
});

test('Database seeded with correct number of teams and matches', () => {
  const { getDb } = require('../src/db/schema');
  const db = getDb();
  const teams   = db.prepare('SELECT COUNT(*) AS n FROM teams').get().n;
  const matches = db.prepare('SELECT COUNT(*) AS n FROM group_matches').get().n;
  assert.equal(teams,   48, 'Should have 48 teams');
  assert.equal(matches, 72, 'Should have 72 group stage matches (12 groups × 6)');
});

test('Group picks can be saved and retrieved', async () => {
  const { cookie } = await registerUser('picker', 'picker@example.com', 'picks123');

  // Create bracket
  const { csrfToken: ct1, cookie: dashCookie } = await getCsrfToken('/dashboard', cookie);
  const create = await post('/dashboard/create', { name: 'Pick Bracket', _csrf: ct1 }, dashCookie);
  const bracketId = create.headers.location.match(/\/bracket\/(\d+)\/group/)[1];

  // Get all match IDs from DB
  const { getDb } = require('../src/db/schema');
  const db = getDb();
  const matches = db.prepare('SELECT id FROM group_matches ORDER BY id LIMIT 6').all();

  // Get CSRF token from the group picks page
  const { csrfToken: ct2, cookie: groupCookie } = await getCsrfToken(`/bracket/${bracketId}/group`, cookie);

  // Build POST body with scores for first 6 matches
  const body = { _csrf: ct2 };
  for (const m of matches) {
    body[`score1_${m.id}`] = '2';
    body[`score2_${m.id}`] = '1';
  }

  const save = await post(`/bracket/${bracketId}/group`, body, groupCookie);
  assert.equal(save.status, 302);
  assert.match(save.headers.location, /\?saved=1$/);

  // Verify picks in DB
  const picks = db.prepare('SELECT * FROM group_picks WHERE bracket_id = ?').all(bracketId);
  assert.ok(picks.length >= 6, 'Should have at least 6 picks saved');
  const p = picks[0];
  assert.equal(p.predicted_score1, 2);
  assert.equal(p.predicted_score2, 1);
});

test('Multiple brackets can be created by same user', async () => {
  const { cookie } = await registerUser('multiuser', 'multi@example.com', 'multi123');

  const { csrfToken: ct1, cookie: c1 } = await getCsrfToken('/dashboard', cookie);
  const b1 = await post('/dashboard/create', { name: 'Bracket One',   _csrf: ct1 }, c1);

  const { csrfToken: ct2, cookie: c2 } = await getCsrfToken('/dashboard', cookie);
  const b2 = await post('/dashboard/create', { name: 'Bracket Two',   _csrf: ct2 }, c2);

  const { csrfToken: ct3, cookie: c3 } = await getCsrfToken('/dashboard', cookie);
  const b3 = await post('/dashboard/create', { name: 'Bracket Three', _csrf: ct3 }, c3);

  assert.equal(b1.status, 302);
  assert.equal(b2.status, 302);
  assert.equal(b3.status, 302);

  const { getDb } = require('../src/db/schema');
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get('multiuser');
  const count = db.prepare('SELECT COUNT(*) AS n FROM brackets WHERE user_id = ?').get(user.id).n;
  assert.equal(count, 3, 'User should have 3 brackets');
});
