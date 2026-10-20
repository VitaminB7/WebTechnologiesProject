const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, pool, request, LOGINS, resetTestDb, closeDb, lastLog,
} = require('./helpers');

before(resetTestDb);
after(closeDb);

describe('POST /api/auth/login', () => {
  it('logs in with username, returns the admin without password, and writes a Log row', async () => {
    const res = await request(app).post('/api/auth/login').send(LOGINS.super).expect(200);
    assert.equal(res.body.data.username, 'admin_main');
    assert.equal(res.body.data.role, 'SuperAdmin');
    assert.equal(res.body.data.displayName, 'Somchai Jaidee');
    assert.equal(res.body.data.email, 'admin@aura36.co.th');
    assert.ok(!('password' in res.body.data));
    assert.ok(!JSON.stringify(res.body).includes('$2b$'));
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /aura\.sid=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.deepEqual(await lastLog(), { Username: 'admin_main', Changed: 'LOGIN admin_main' });
  });

  it('logs in with the admin email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin@aura36.co.th', password: 'Admin@1234' }).expect(200);
    assert.equal(res.body.data.username, 'admin_main');
  });

  it('logs in an Admin that has no email', async () => {
    const res = await request(app).post('/api/auth/login').send(LOGINS.ops).expect(200);
    assert.equal(res.body.data.role, 'Admin');
    assert.equal(res.body.data.email, null);
  });

  it('rejects a wrong password with 401 and writes no Log row', async () => {
    const [[before]] = await pool.execute('SELECT COUNT(*) AS n FROM Log');
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin_main', password: 'wrong-password' }).expect(401);
    assert.equal(typeof res.body.error.message, 'string');
    const [[after]] = await pool.execute('SELECT COUNT(*) AS n FROM Log');
    assert.equal(after.n, before.n);
  });

  it('rejects an unknown user with 401', async () => {
    await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'whatever1' }).expect(401);
  });

  it('returns 400 with fields when username/password are missing or not strings', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: ['x'], password: 5 }).expect(400);
    assert.ok(res.body.error.fields.username);
    assert.ok(res.body.error.fields.password);
  });

  it('returns 400 (not 500) for malformed JSON', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('Content-Type', 'application/json').send('{"username":').expect(400);
    assert.ok(res.body.error.message);
  });

  it('returns 413 for a body larger than 100 KB', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'x'.repeat(150 * 1024), password: 'whatever1' }).expect(413);
    assert.ok(res.body.error.message);
  });

  it('treats SQL-looking usernames as plain text', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: "admin_main' OR '1'='1", password: "' OR '1'='1" }).expect(401);
  });
});

describe('session: /api/auth/me and logout', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    assert.ok(res.body.error.message);
  });

  it('returns the admin after login and 401 after logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(LOGINS.listing).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.data.username, 'listing_ploy');
    assert.ok(!('password' in me.body.data));
    const out = await agent.post('/api/auth/logout').expect(200);
    assert.deepEqual(out.body, { data: { ok: true } });
    await agent.get('/api/auth/me').expect(401);
  });

  it('gives a new session id on login (no session fixation)', async () => {
    const agent = request.agent(app);
    const first = await agent.post('/api/auth/login').send(LOGINS.listing).expect(200);
    const second = await agent.post('/api/auth/login').send(LOGINS.listing).expect(200);
    const sid = (res) => res.headers['set-cookie'][0].split(';')[0];
    assert.notEqual(sid(first), sid(second));
  });
});

describe('unknown API routes', () => {
  it('answers 404 in the contract error shape', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    assert.equal(res.body.error.message, 'No API route for GET /api/does-not-exist');
  });
});

describe('security headers', () => {
  it('sends X-Content-Type-Options: nosniff on API, error and static responses', async () => {
    for (const url of ['/api/stats', '/api/does-not-exist', '/no-such-page.html']) {
      const res = await request(app).get(url);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', url);
    }
  });
});
