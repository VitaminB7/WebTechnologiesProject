const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, pool, request, resetTestDb, closeDb, loginAs, lastLog,
} = require('./helpers');
const withTransaction = require('../src/utils/transaction');
const { logAction } = require('../src/utils/log-action');

const ADMIN_KEYS = ['username', 'firstName', 'lastName', 'displayName', 'address', 'role', 'email'].sort();

function newAdmin(overrides = {}) {
  return {
    username: 'staff_test',
    password: 'Staff@1234',
    firstName: 'Mana',
    lastName: 'Deejai',
    role: 'Admin',
    email: 'mana@example.com',
    ...overrides,
  };
}

const logNumber = (logId) => Number(logId.slice(2));

let superAdmin;

before(async () => {
  await resetTestDb();
  superAdmin = await loginAs('super');
});
after(closeDb);

describe('access control', () => {
  it('returns 401 when not logged in', async () => {
    await request(app).get('/api/admins').expect(401);
    await request(app).get('/api/logs').expect(401);
  });

  it('returns 403 for a logged-in Admin (not SuperAdmin)', async () => {
    const listing = await loginAs('listing');
    await listing.get('/api/admins').expect(403);
    await listing.post('/api/admins').send(newAdmin()).expect(403);
    await listing.delete('/api/admins/admin_main').expect(403);
    await listing.get('/api/logs').expect(403);
  });
});

describe('GET /api/admins', () => {
  it('lists admins in the Admin shape with no password anywhere', async () => {
    const res = await superAdmin.get('/api/admins').expect(200);
    assert.equal(res.body.data.length, 3);
    for (const admin of res.body.data) assert.deepEqual(Object.keys(admin).sort(), ADMIN_KEYS);
    assert.ok(!/password|\$2b\$/i.test(JSON.stringify(res.body)));
    const main = res.body.data.find((a) => a.username === 'admin_main');
    assert.equal(main.email, 'admin@aura36.co.th');
    assert.equal(main.role, 'SuperAdmin');
    assert.equal(res.body.data.find((a) => a.username === 'ops_niran').email, null);
  });

  it('filters by q (username, name or email) and role, and validates them', async () => {
    const byName = await superAdmin.get('/api/admins?q=Ploy').expect(200);
    assert.deepEqual(byName.body.data.map((a) => a.username), ['listing_ploy']);
    const byFullName = await superAdmin.get('/api/admins').query({ q: 'Niran Thong' }).expect(200);
    assert.deepEqual(byFullName.body.data.map((a) => a.username), ['ops_niran']);
    const byEmail = await superAdmin.get('/api/admins').query({ q: 'admin@aura36' }).expect(200);
    assert.deepEqual(byEmail.body.data.map((a) => a.username), ['admin_main']);
    const admins = await superAdmin.get('/api/admins?role=Admin').expect(200);
    assert.deepEqual(admins.body.data.map((a) => a.username), ['listing_ploy', 'ops_niran']);
    const injection = await superAdmin.get('/api/admins').query({ q: "' OR '1'='1" }).expect(200);
    assert.deepEqual(injection.body.data, []);
    await superAdmin.get('/api/admins?role=root').expect(400);
  });

  it('gets one admin or 404', async () => {
    const res = await superAdmin.get('/api/admins/listing_ploy').expect(200);
    assert.equal(res.body.data.displayName, 'Ploy Srisuk');
    await superAdmin.get('/api/admins/nobody').expect(404);
  });
});

describe('create / update / delete admins', () => {
  it('creates an admin (201) without returning the password', async () => {
    const res = await superAdmin.post('/api/admins').send(newAdmin()).expect(201);
    assert.deepEqual(Object.keys(res.body.data).sort(), ADMIN_KEYS);
    assert.equal(res.body.data.username, 'staff_test');
    assert.equal(res.body.data.address, null);
    assert.equal(res.body.data.email, 'mana@example.com');
    assert.match((await lastLog()).Changed, /^CREATE AdminAccount staff_test \(Admin\)/);
    await request(app).post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
  });

  it('creates an admin without an email ("" means none)', async () => {
    const res = await superAdmin.post('/api/admins')
      .send(newAdmin({ username: 'no.email', email: '', role: 'SuperAdmin' })).expect(201);
    assert.equal(res.body.data.email, null);
    assert.equal(res.body.data.role, 'SuperAdmin');
  });

  it('returns 409 for a duplicate username (case-insensitive) or an email used by someone else', async () => {
    await superAdmin.post('/api/admins').send(newAdmin({ email: null })).expect(409);
    await superAdmin.post('/api/admins').send(newAdmin({ username: 'STAFF_TEST', email: null })).expect(409);
    const res = await superAdmin.post('/api/admins')
      .send(newAdmin({ username: 'other_one', email: 'ADMIN@aura36.co.th' })).expect(409);
    assert.ok(res.body.error.fields.email);
    await superAdmin.get('/api/admins/other_one').expect(404);
  });

  it('validates the body (400 with fields)', async () => {
    const res = await superAdmin.post('/api/admins').send({
      username: 'a-b', password: 'short', firstName: '', role: 'root', email: 'bad',
    }).expect(400);
    assert.deepEqual(
      Object.keys(res.body.error.fields).sort(),
      ['email', 'firstName', 'lastName', 'password', 'role', 'username'],
    );
  });

  it('updates an admin and returns the Admin; blank or missing password keeps the old one', async () => {
    const res = await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', address: null, role: 'SuperAdmin',
      email: 'manee@example.com', password: '',
    }).expect(200);
    assert.deepEqual(Object.keys(res.body.data).sort(), ADMIN_KEYS);
    assert.equal(res.body.data.displayName, 'Manee Deejai');
    assert.equal(res.body.data.role, 'SuperAdmin');
    assert.equal(res.body.data.email, 'manee@example.com');
    const log = (await lastLog()).Changed;
    assert.match(log, /firstName Mana -> Manee/);
    assert.match(log, /email mana@example.com -> manee@example.com/);
    const again = await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', address: 'Bangkok', role: 'Admin',
    }).expect(200);
    assert.equal(again.body.data.address, 'Bangkok');
    assert.equal(again.body.data.email, null);
    assert.match((await lastLog()).Changed, /address \(empty\) -> Bangkok/);
    await request(app).post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
    await superAdmin.put('/api/admins/nobody').send({ firstName: 'A', lastName: 'B', role: 'Admin' }).expect(404);
  });

  it('returns 409 when an update takes another admin\'s email', async () => {
    const res = await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', role: 'Admin', email: 'ploy.s@aura36.co.th',
    }).expect(409);
    assert.ok(res.body.error.fields.email);
    const after = await superAdmin.get('/api/admins/staff_test').expect(200);
    assert.equal(after.body.data.email, null);
  });

  it('a role change takes effect on an existing session', async () => {
    const staff = request.agent(app);
    await staff.post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
    await staff.get('/api/admins').expect(403);
    await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', role: 'SuperAdmin',
    }).expect(200);
    await staff.get('/api/admins').expect(200);
    await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', role: 'Admin',
    }).expect(200);
  });

  it('resets a password', async () => {
    await superAdmin.post('/api/admins/listing_ploy/reset-password').send({ password: 'short' }).expect(400);
    const res = await superAdmin.post('/api/admins/listing_ploy/reset-password')
      .send({ password: 'NewPass@5678' }).expect(200);
    assert.deepEqual(res.body, { data: { ok: true } });
    await request(app).post('/api/auth/login').send({ username: 'listing_ploy', password: 'Listing@1234' }).expect(401);
    await request(app).post('/api/auth/login').send({ username: 'listing_ploy', password: 'NewPass@5678' }).expect(200);
    await superAdmin.post('/api/admins/nobody/reset-password').send({ password: 'NewPass@5678' }).expect(404);
  });

  it('cannot delete yourself or change your own role (400)', async () => {
    await superAdmin.delete('/api/admins/admin_main').expect(400);
    await superAdmin.delete('/api/admins/ADMIN_MAIN').expect(400);
    const res = await superAdmin.put('/api/admins/admin_main').send({
      firstName: 'Somchai', lastName: 'Jaidee', role: 'Admin', email: 'admin@aura36.co.th',
    }).expect(400);
    assert.ok(res.body.error.fields.role);
    await superAdmin.put('/api/admins/admin_main').send({
      firstName: 'Somchai', lastName: 'Jaidee', role: 'SuperAdmin', email: 'admin@aura36.co.th',
    }).expect(200);
    await superAdmin.get('/api/auth/me').expect(200);
  });

  it('deletes another admin together with their Log rows, and ends their session', async () => {
    const staff = request.agent(app);
    await staff.post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
    const [[before]] = await pool.execute("SELECT COUNT(*) AS n FROM Log WHERE Username = 'staff_test'");
    assert.ok(before.n > 0);
    const res = await superAdmin.delete('/api/admins/staff_test').expect(200);
    assert.deepEqual(res.body, { data: { ok: true } });
    const [[afterDelete]] = await pool.execute("SELECT COUNT(*) AS n FROM Log WHERE Username = 'staff_test'");
    assert.equal(afterDelete.n, 0);
    assert.deepEqual(await lastLog(), { Username: 'admin_main', Changed: 'DELETE AdminAccount staff_test' });
    await staff.get('/api/auth/me').expect(401);
    await superAdmin.get('/api/admins/staff_test').expect(404);
    await superAdmin.delete('/api/admins/staff_test').expect(404);
  });
});

describe('Log ids and GET /api/logs', () => {
  it('returns entries newest first, with ids L-<n> compared as numbers', async () => {
    const res = await superAdmin.get('/api/logs').expect(200);
    assert.ok(res.body.data.length > 10 && res.body.data.length <= 100, 'enough rows to pass L-9 / L-10');
    assert.deepEqual(Object.keys(res.body.data[0]).sort(), ['changed', 'dateTime', 'logId', 'username']);
    for (const log of res.body.data) {
      assert.match(log.logId, /^L-\d+$/);
      assert.ok(!Number.isNaN(Date.parse(log.dateTime)));
    }
    const numbers = res.body.data.map((l) => logNumber(l.logId));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => b - a));
    assert.equal(res.body.data[0].changed, (await lastLog()).Changed);
  });

  it('returns at most 100 entries, older DateTime last', async () => {
    const old = new Date('2020-01-01T00:00:00Z');
    const rows = Array.from({ length: 110 }, (_, i) => [`L-${100000 + i}`, 'admin_main', 'bulk', old]);
    await pool.query('INSERT INTO Log (LogID, Username, Changed, DateTime) VALUES ?', [rows]);
    const res = await superAdmin.get('/api/logs').expect(200);
    assert.equal(res.body.data.length, 100);
    assert.notEqual(res.body.data[0].changed, 'bulk');
    await pool.execute("DELETE FROM Log WHERE Changed = 'bulk'");
  });

  it('gives concurrent writers distinct, consecutive ids', async () => {
    const [[{ maxNumber }]] = await pool.execute(
      'SELECT MAX(CAST(SUBSTRING(LogID, 3) AS UNSIGNED)) AS maxNumber FROM Log',
    );
    const writers = Array.from({ length: 8 }, (_, i) => withTransaction(
      (db) => logAction(db, 'admin_main', `CONCURRENT ${i}`),
    ));
    await Promise.all(writers);
    const [rows] = await pool.execute("SELECT LogID FROM Log WHERE Changed LIKE 'CONCURRENT %'");
    const numbers = rows.map((r) => logNumber(r.LogID)).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: 8 }, (_, i) => Number(maxNumber) + 1 + i));
  });
});
