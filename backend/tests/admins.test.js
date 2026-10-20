const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, resetTestDb, closeDb, loginAs, lastLog,
} = require('./helpers');

const ADMIN_KEYS = [
  'username', 'firstName', 'lastName', 'displayName', 'address', 'role', 'status', 'emails', 'updatedAt',
].sort();

function newAdmin(overrides = {}) {
  return {
    username: 'staff_test',
    password: 'Staff@1234',
    firstName: 'Mana',
    lastName: 'Deejai',
    role: 'operations',
    status: 'active',
    emails: ['mana@example.com'],
    ...overrides,
  };
}

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

  it('returns 403 for a logged-in admin without super_admin role', async () => {
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
    assert.deepEqual(main.emails, ['admin@aura36.co.th', 'somchai.j@aura36.co.th']);
  });

  it('filters by q, role and status and validates them', async () => {
    const byName = await superAdmin.get('/api/admins?q=Ploy').expect(200);
    assert.deepEqual(byName.body.data.map((a) => a.username), ['listing_ploy']);
    const byFullName = await superAdmin.get('/api/admins').query({ q: 'Niran Thong' }).expect(200);
    assert.deepEqual(byFullName.body.data.map((a) => a.username), ['ops_niran']);
    const inactive = await superAdmin.get('/api/admins?status=inactive&role=operations').expect(200);
    assert.deepEqual(inactive.body.data.map((a) => a.username), ['ops_niran']);
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
    assert.equal(res.body.data.username, 'staff_test');
    assert.equal(res.body.data.address, null);
    assert.deepEqual(res.body.data.emails, ['mana@example.com']);
    assert.ok(!('password' in res.body.data));
    assert.match((await lastLog()).Changed, /^CREATE AdminAccount staff_test/);
    await request(app).post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
  });

  it('returns 409 for a duplicate username (case-insensitive) or an email owned by someone else', async () => {
    await superAdmin.post('/api/admins').send(newAdmin()).expect(409);
    await superAdmin.post('/api/admins').send(newAdmin({ username: 'STAFF_TEST' })).expect(409);
    const res = await superAdmin.post('/api/admins')
      .send(newAdmin({ username: 'other_one', emails: ['admin@aura36.co.th'] })).expect(409);
    assert.ok(res.body.error.fields.emails);
    await superAdmin.get('/api/admins/other_one').expect(404);
  });

  it('validates the body (400 with fields)', async () => {
    const res = await superAdmin.post('/api/admins').send({
      username: 'a b', password: 'short', firstName: '', role: 'king', status: 'sleeping', emails: ['bad'],
    }).expect(400);
    assert.deepEqual(
      Object.keys(res.body.error.fields).sort(),
      ['emails', 'firstName', 'lastName', 'password', 'role', 'status', 'username'],
    );
  });

  it('updates an admin and returns the Admin; blank or missing password keeps the old one', async () => {
    const res = await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', address: null, role: 'listing_admin', status: 'active',
      emails: ['manee@example.com', 'manee.d@example.com'], password: '',
    }).expect(200);
    assert.deepEqual(Object.keys(res.body.data).sort(), ADMIN_KEYS);
    assert.equal(res.body.data.displayName, 'Manee Deejai');
    assert.equal(res.body.data.role, 'listing_admin');
    assert.deepEqual(res.body.data.emails, ['manee.d@example.com', 'manee@example.com']);
    assert.match((await lastLog()).Changed, /firstName Mana -> Manee/);
    const again = await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', address: 'Bangkok', role: 'listing_admin', status: 'active',
      emails: ['manee@example.com'],
    }).expect(200);
    assert.equal(again.body.data.address, 'Bangkok');
    assert.deepEqual(again.body.data.emails, ['manee@example.com']);
    assert.match((await lastLog()).Changed, /address \(empty\) -> Bangkok/);
    await request(app).post('/api/auth/login').send({ username: 'manee@example.com', password: 'Staff@1234' }).expect(200);
    await superAdmin.put('/api/admins/nobody').send({
      firstName: 'A', lastName: 'B', role: 'operations', status: 'active',
    }).expect(404);
  });

  it('a deactivated admin is locked out of an existing session (403) and cannot log in', async () => {
    const staff = request.agent(app);
    await staff.post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(200);
    await superAdmin.put('/api/admins/staff_test').send({
      firstName: 'Manee', lastName: 'Deejai', role: 'listing_admin', status: 'inactive',
    }).expect(200);
    await staff.get('/api/auth/me').expect(403);
    await request(app).post('/api/auth/login').send({ username: 'staff_test', password: 'Staff@1234' }).expect(403);
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

  it('cannot delete, demote or deactivate yourself (400)', async () => {
    await superAdmin.delete('/api/admins/admin_main').expect(400);
    await superAdmin.delete('/api/admins/ADMIN_MAIN').expect(400);
    await superAdmin.put('/api/admins/admin_main').send({
      firstName: 'Somchai', lastName: 'Jaidee', role: 'operations', status: 'active',
    }).expect(400);
    await superAdmin.put('/api/admins/admin_main').send({
      firstName: 'Somchai', lastName: 'Jaidee', role: 'super_admin', status: 'inactive',
    }).expect(400);
    await superAdmin.get('/api/auth/me').expect(200);
  });

  it('deletes another admin, keeps their Log rows with a NULL username', async () => {
    const res = await superAdmin.delete('/api/admins/staff_test').expect(200);
    assert.deepEqual(res.body, { data: { ok: true } });
    await superAdmin.get('/api/admins/staff_test').expect(404);
    await superAdmin.delete('/api/admins/staff_test').expect(404);
    const logs = await superAdmin.get('/api/logs').expect(200);
    assert.ok(logs.body.data.some((l) => l.changed === 'LOGIN staff_test' && l.username === null));
  });
});

describe('GET /api/logs', () => {
  it('returns at most 100 entries, newest first', async () => {
    const res = await superAdmin.get('/api/logs').expect(200);
    assert.ok(res.body.data.length > 0 && res.body.data.length <= 100);
    assert.deepEqual(Object.keys(res.body.data[0]).sort(), ['changed', 'dateTime', 'logId', 'username']);
    const ids = res.body.data.map((l) => l.logId);
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
  });
});
