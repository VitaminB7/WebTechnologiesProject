const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, resetTestDb, closeDb, loginAs, lastLog, bangkokDate,
} = require('./helpers');

function booking(overrides = {}) {
  return {
    roomId: 1201,
    fullName: 'Test Tenant',
    identityNumber: '1103700000000',
    phone: '0801231234',
    email: 'tenant@example.com',
    moveInDate: bangkokDate(14),
    ...overrides,
  };
}

before(resetTestDb);
after(closeDb);

describe('POST /api/bookings (public)', () => {
  it('creates a pending booking (201) in the Booking shape and logs it', async () => {
    const res = await request(app).post('/api/bookings').send(booking()).expect(201);
    const data = res.body.data;
    assert.deepEqual(
      Object.keys(data).sort(),
      ['bookingId', 'createdAt', 'email', 'fullName', 'identityNumber', 'moveInDate', 'phone', 'roomId', 'status'],
    );
    assert.equal(data.status, 'pending');
    assert.equal(data.moveInDate, booking().moveInDate);
    assert.equal(typeof data.bookingId, 'number');
    assert.deepEqual(await lastLog(), {
      Username: null, Changed: `CREATE Booking ${data.bookingId} for RoomUnit 1201`,
    });
  });

  it('accepts today as the move-in date', async () => {
    await request(app).post('/api/bookings').send(booking({ moveInDate: bangkokDate(0) })).expect(201);
  });

  it('returns 400 when the room is occupied or does not exist', async () => {
    const occupied = await request(app).post('/api/bookings').send(booking({ roomId: 315 })).expect(400);
    assert.ok(occupied.body.error.fields.roomId);
    await request(app).post('/api/bookings').send(booking({ roomId: 4242 })).expect(400);
  });

  it('requires a 13-digit identity number', async () => {
    for (const identityNumber of ['110370000000', '11037000000000', '110370000000a', '', 1103700000000.5]) {
      const res = await request(app).post('/api/bookings').send(booking({ identityNumber })).expect(400);
      assert.ok(res.body.error.fields.identityNumber, `identityNumber=${identityNumber}`);
    }
  });

  it('accepts phones with 9-15 digits after removing spaces/dashes, rejects others', async () => {
    for (const phone of ['080-123-1234', '080 123 1234', '021234567', '123456789012345']) {
      await request(app).post('/api/bookings').send(booking({ phone })).expect(201);
    }
    for (const phone of ['12345678', '1234567890123456', '080-123-abcd', '+66 80 123 1234', '--------']) {
      const res = await request(app).post('/api/bookings').send(booking({ phone })).expect(400);
      assert.ok(res.body.error.fields.phone, `phone=${phone}`);
    }
  });

  it('rejects past, malformed and impossible move-in dates', async () => {
    for (const moveInDate of [bangkokDate(-1), '2020-01-01', '01/12/2026', '2026-02-30', '', 'tomorrow']) {
      const res = await request(app).post('/api/bookings').send(booking({ moveInDate })).expect(400);
      assert.ok(res.body.error.fields.moveInDate, `moveInDate=${moveInDate}`);
    }
  });

  it('requires every field', async () => {
    const res = await request(app).post('/api/bookings').send({}).expect(400);
    assert.deepEqual(
      Object.keys(res.body.error.fields).sort(),
      ['email', 'fullName', 'identityNumber', 'moveInDate', 'phone', 'roomId'],
    );
  });
});

describe('booking admin', () => {
  it('requires login to list or update', async () => {
    await request(app).get('/api/bookings').expect(401);
    await request(app).patch('/api/bookings/1').send({ status: 'confirmed' }).expect(401);
  });

  it('lists bookings newest first', async () => {
    const admin = await loginAs('listing');
    const res = await admin.get('/api/bookings').expect(200);
    assert.equal(res.body.data.length, 9);
    const created = res.body.data.map((b) => b.createdAt);
    assert.deepEqual(created, [...created].sort().reverse());
  });

  it('updates the status, validates it and logs the change', async () => {
    const admin = await loginAs('listing');
    const res = await admin.patch('/api/bookings/1').send({ status: 'confirmed' }).expect(200);
    assert.equal(res.body.data.status, 'confirmed');
    assert.deepEqual(await lastLog(), {
      Username: 'listing_ploy', Changed: 'UPDATE Booking 1: status pending -> confirmed',
    });
    await admin.patch('/api/bookings/1').send({ status: 'done' }).expect(400);
    await admin.patch('/api/bookings/999').send({ status: 'confirmed' }).expect(404);
    await admin.patch('/api/bookings/abc').send({ status: 'confirmed' }).expect(404);
  });
});
