const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, pool, request, resetTestDb, closeDb, loginAs, lastLog, validRoom,
} = require('./helpers');

const ROOM_KEYS = [
  'roomId', 'building', 'floor', 'roomType', 'bedrooms', 'size', 'price', 'description',
  'conditionRating', 'minimumLease', 'available', 'appliances', 'images', 'owner',
].sort();

let admin;

before(async () => {
  await resetTestDb();
  admin = await loginAs('listing');
});
after(closeDb);

describe('GET /api/rooms (public search)', () => {
  it('returns seeded rooms with the exact Room shape and default meta', async () => {
    const res = await request(app).get('/api/rooms').expect(200);
    assert.deepEqual(res.body.meta, { page: 1, pageSize: 12, total: 20 });
    assert.equal(res.body.data.length, 12);
    const room = res.body.data[0];
    assert.deepEqual(Object.keys(room).sort(), ROOM_KEYS);
    assert.deepEqual(Object.keys(room.owner).sort(), ['email', 'lineId', 'name', 'phone']);
    assert.match(room.roomId, /^L-\d{4}$/);
    assert.equal(typeof room.price, 'number');
    assert.equal(typeof room.size, 'number');
    assert.equal(typeof room.available, 'boolean');
    assert.ok(Number.isInteger(room.floor));
    assert.ok(Number.isInteger(room.conditionRating));
    assert.deepEqual(room.images, []);
    assert.ok(room.appliances.length > 0);
    for (const appliance of room.appliances) {
      assert.deepEqual(Object.keys(appliance).sort(), ['name', 'serialNumber']);
    }
    const ids = res.body.data.map((r) => r.roomId);
    assert.deepEqual(ids, [...ids].sort(), 'default sort is roomId ascending');
  });

  it('paginates correctly, including a partial last page and a page past the end', async () => {
    const page2 = await request(app).get('/api/rooms?pageSize=8&page=2').expect(200);
    assert.deepEqual(page2.body.meta, { page: 2, pageSize: 8, total: 20 });
    assert.equal(page2.body.data.length, 8);
    const page3 = await request(app).get('/api/rooms?pageSize=8&page=3').expect(200);
    assert.equal(page3.body.data.length, 4);
    const page9 = await request(app).get('/api/rooms?pageSize=8&page=9').expect(200);
    assert.deepEqual(page9.body.data, []);
    assert.equal(page9.body.meta.total, 20);
  });

  it('filters by type, bedrooms, price range and availability', async () => {
    const cases = [
      ['type=Studio', (r) => r.roomType === 'Studio'],
      ['type=1%20Bedroom', (r) => r.roomType === '1 Bedroom'],
      ['type=Deluxe%20room', (r) => r.roomType === 'Deluxe room'],
      ['bedrooms=2', (r) => r.bedrooms === 2],
      ['minPrice=15000&maxPrice=25000', (r) => r.price >= 15000 && r.price <= 25000],
      ['available=false', (r) => r.available === false],
      ['type=2%20Bedroom&available=true', (r) => r.roomType === '2 Bedroom' && r.available],
      ['floor=12', (r) => r.floor === 12],
      ['minCondition=4', (r) => r.conditionRating >= 4],
      ['minCondition=5&type=Deluxe%20room', (r) => r.conditionRating === 5 && r.roomType === 'Deluxe room'],
      ['floor=2&minCondition=3', (r) => r.floor === 2 && r.conditionRating >= 3],
    ];
    for (const [query, matches] of cases) {
      const res = await request(app).get(`/api/rooms?${query}&pageSize=50`).expect(200);
      assert.ok(res.body.data.length > 0, `${query} should match seeded rooms`);
      assert.ok(res.body.data.every(matches), `${query} returned a non-matching room`);
      assert.equal(res.body.meta.total, res.body.data.length, `${query} total`);
    }
  });

  it('searches q by room id or owner name', async () => {
    const byId = await request(app).get('/api/rooms?q=1201').expect(200);
    assert.deepEqual(byId.body.data.map((r) => r.roomId), ['L-1201']);
    const byFullId = await request(app).get('/api/rooms?q=L-1201').expect(200);
    assert.deepEqual(byFullId.body.data.map((r) => r.roomId), ['L-1201']);
    const byOwner = await request(app).get('/api/rooms?q=natthaya').expect(200);
    assert.deepEqual(byOwner.body.data.map((r) => r.roomId), ['L-1201']);
  });

  it('treats SQL-injection-looking and wildcard q values as plain text (200, no rows)', async () => {
    const attacks = ["' OR 1=1 --", 'L-1201; DROP TABLE RoomUnit;', '%', '_', '\\', '") UNION SELECT * FROM AdminAccount --'];
    for (const q of attacks) {
      const res = await request(app).get('/api/rooms').query({ q }).expect(200);
      assert.equal(res.body.meta.total, 0, `q=${q}`);
    }
    const still = await request(app).get('/api/rooms').expect(200);
    assert.equal(still.body.meta.total, 20, 'table untouched');
  });

  it('sorts by price ascending / descending', async () => {
    const asc = await request(app).get('/api/rooms?sort=price_asc&pageSize=50').expect(200);
    const prices = asc.body.data.map((r) => r.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    const desc = await request(app).get('/api/rooms?sort=price_desc&pageSize=1').expect(200);
    assert.equal(desc.body.data[0].roomId, 'L-3001');
  });

  it('returns 400 with fields for invalid query values instead of 500', async () => {
    const bad = {
      'minPrice=-1': 'minPrice',
      'maxPrice=NaN': 'maxPrice',
      'maxPrice=1000000': 'maxPrice',
      'minPrice=20000&maxPrice=10000': 'maxPrice',
      'bedrooms=11': 'bedrooms',
      'bedrooms=1.5': 'bedrooms',
      'available=yes': 'available',
      'type=Suite': 'type',
      'page=0': 'page',
      'pageSize=51': 'pageSize',
      'sort=newest': 'sort',
      'sort=RoomID%3BDROP': 'sort',
      'type=Studio&type=Deluxe%20room': 'type',
      'floor=0': 'floor',
      'floor=100': 'floor',
      'floor=2.5': 'floor',
      'minCondition=0': 'minCondition',
      'minCondition=6': 'minCondition',
      'minCondition=good': 'minCondition',
    };
    for (const [query, field] of Object.entries(bad)) {
      const res = await request(app).get(`/api/rooms?${query}`).expect(400);
      assert.ok(res.body.error.fields[field], `${query} should flag ${field}`);
    }
  });
});

describe('GET /api/rooms/:id, /similar and /api/stats', () => {
  it('returns one room with appliances ordered by name then serial number', async () => {
    const res = await request(app).get('/api/rooms/L-1201').expect(200);
    assert.equal(res.body.data.roomId, 'L-1201');
    assert.equal(res.body.data.building, 'Building A');
    assert.equal(res.body.data.owner.name, 'Natthaya Siriwan');
    assert.equal(res.body.data.owner.phone, '080-123-1234');
    assert.deepEqual(res.body.data.appliances.map((a) => a.name),
      ['Air conditioner', 'Fridge', 'Sofa', 'TV', 'Water heater']);
    assert.deepEqual(res.body.data.appliances[2], { serialNumber: 'SF-1201-01', name: 'Sofa' });
    assert.equal(res.body.data.floor, 12);
    assert.equal(res.body.data.conditionRating, 3);
  });

  it('returns 404 for a missing room and 400 for an id that is not L- + 4 digits', async () => {
    await request(app).get('/api/rooms/L-4242').expect(404);
    for (const id of ['1201', 'abc', 'L-12011', 'L-120', 'l-1201', 'L-12a1']) {
      const res = await request(app).get(`/api/rooms/${id}`).expect(400);
      assert.ok(res.body.error.message, id);
    }
    await request(app).get('/api/rooms/1201/similar').expect(400);
  });

  it('returns up to 3 similar rooms of the same type, excluding itself', async () => {
    const res = await request(app).get('/api/rooms/L-1201/similar').expect(200);
    assert.ok(res.body.data.length > 0 && res.body.data.length <= 3);
    assert.ok(res.body.data.every((r) => r.roomType === 'Deluxe room' && r.roomId !== 'L-1201'));
    await request(app).get('/api/rooms/L-4242/similar').expect(404);
  });

  it('returns home page stats', async () => {
    const res = await request(app).get('/api/stats').expect(200);
    assert.deepEqual(res.body.data, { totalRooms: 20, roomTypes: 4, availableRooms: 15 });
  });
});

describe('room admin CRUD', () => {
  it('requires login for every write (401)', async () => {
    await request(app).post('/api/rooms').send(validRoom()).expect(401);
    await request(app).put('/api/rooms/L-1201').send(validRoom()).expect(401);
    await request(app).delete('/api/rooms/L-1201').expect(401);
  });

  it('lets a SuperAdmin write rooms too', async () => {
    const superAdmin = await loginAs('super');
    await superAdmin.post('/api/rooms').send(validRoom({ roomId: 'L-9904', appliances: [] })).expect(201);
    await superAdmin.delete('/api/rooms/L-9904').expect(200);
  });

  it('creates a room (201) with appliances and a Log row', async () => {
    const res = await admin.post('/api/rooms').send(validRoom()).expect(201);
    const room = res.body.data;
    assert.deepEqual(Object.keys(room).sort(), ROOM_KEYS);
    assert.equal(room.roomId, 'L-9901');
    assert.equal(room.building, 'Building C');
    assert.equal(room.size, 34.5);
    assert.equal(room.floor, 9);
    assert.equal(room.conditionRating, 4);
    assert.deepEqual(room.images, []);
    assert.deepEqual(room.appliances, [
      { serialNumber: 'FR-9901-02', name: 'Fridge' },
      { serialNumber: 'SF-9901-01', name: 'Sofa' },
    ]);
    assert.deepEqual(await lastLog(), { Username: 'listing_ploy', Changed: 'CREATE RoomUnit L-9901' });
  });

  it('treats null and "" optional fields as empty (NULL) and appliances missing as []', async () => {
    const created = await admin.post('/api/rooms').send(validRoom({
      roomId: 'L-9903', description: '', size: null, minimumLease: '', appliances: undefined,
      owner: { name: 'Empty Fields', phone: '081-111-2222', email: '', lineId: null },
    })).expect(201);
    const room = created.body.data;
    assert.equal(room.description, null);
    assert.equal(room.size, null);
    assert.equal(room.minimumLease, null);
    assert.deepEqual(room.appliances, []);
    assert.deepEqual(room.owner, { name: 'Empty Fields', phone: '081-111-2222', email: null, lineId: null });
    await admin.delete('/api/rooms/L-9903').expect(200);
  });

  it('returns 409 when the roomId already exists', async () => {
    const res = await admin.post('/api/rooms').send(validRoom({ roomId: 'L-1201' })).expect(409);
    assert.ok(res.body.error.fields.roomId);
  });

  it('returns 400 with a message per invalid field', async () => {
    const res = await admin.post('/api/rooms').send({
      roomId: '9901', building: '', floor: 0, roomType: 'Suite', bedrooms: 11, size: 0.5, price: 1000000,
      conditionRating: 6, minimumLease: 37, available: 'maybe',
      owner: { name: '', phone: '0800000000', email: 'not-an-email', lineId: 'x'.repeat(51) },
    }).expect(400);
    const expected = ['roomId', 'building', 'floor', 'roomType', 'bedrooms', 'size', 'price',
      'conditionRating', 'minimumLease',
      'available', 'owner.name', 'owner.phone', 'owner.email', 'owner.lineId'];
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), expected.sort());
  });

  it('checks range edges from the Data Dictionary', async () => {
    const edges = [
      [{ size: 500, price: 999999.99, minimumLease: 36, bedrooms: 10 }, 201],
      [{ size: 1, price: 0, minimumLease: 1, bedrooms: 0 }, 201],
      [{ floor: 1, conditionRating: 1 }, 201],
      [{ floor: 99, conditionRating: 5 }, 201],
      [{ floor: '12', conditionRating: '3' }, 201],
      [{ floor: 0 }, 400],
      [{ floor: 100 }, 400],
      [{ floor: 1.5 }, 400],
      [{ floor: undefined }, 400],
      [{ floor: null }, 400],
      [{ conditionRating: 0 }, 400],
      [{ conditionRating: 6 }, 400],
      [{ conditionRating: 3.5 }, 400],
      [{ conditionRating: undefined }, 400],
      [{ size: 500.01 }, 400],
      [{ price: -0.01 }, 400],
      [{ minimumLease: 1.5 }, 400],
      [{ available: undefined }, 400],
      [{ owner: { name: 'No Phone' } }, 400],
    ];
    for (const [overrides, status] of edges) {
      await admin.post('/api/rooms').send(validRoom({ roomId: 'L-9905', ...overrides })).expect(status);
      if (status === 201) await admin.delete('/api/rooms/L-9905').expect(200);
    }
  });

  it('validates appliances with dot-notation keys, including a serial used twice', async () => {
    const res = await admin.post('/api/rooms').send(validRoom({
      roomId: 'L-9902',
      appliances: [
        { serialNumber: 'AC-1', name: 'Air conditioner' },
        { serialNumber: '', name: 'TV' },
        { serialNumber: 'ac-1', name: 'Heater' },
        { serialNumber: 'X'.repeat(51), name: '' },
        'Sofa',
      ],
    })).expect(400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), [
      'appliances.1.serialNumber', 'appliances.2.serialNumber', 'appliances.3.name',
      'appliances.3.serialNumber', 'appliances.4.name', 'appliances.4.serialNumber',
    ]);
    const notList = await admin.post('/api/rooms').send(validRoom({ roomId: 'L-9902', appliances: 'Sofa' })).expect(400);
    assert.ok(notList.body.error.fields.appliances);
    await request(app).get('/api/rooms/L-9902').expect(404);
  });

  it('returns 400 for a non-object body and for over-long text', async () => {
    await admin.post('/api/rooms').send([1, 2, 3]).expect(400);
    const res = await admin.post('/api/rooms')
      .send(validRoom({ roomId: 'L-9902', owner: { name: 'x'.repeat(151), phone: '080-000-0000' } })).expect(400);
    assert.ok(res.body.error.fields['owner.name']);
  });

  it('updates a room (body roomId ignored), replaces appliances and logs the diff', async () => {
    const res = await admin.put('/api/rooms/L-9901').send(validRoom({
      roomId: 'L-0001', price: 16000, available: false, floor: 14, conditionRating: 2,
      appliances: [{ serialNumber: 'TV-9901-03', name: 'TV' }],
    })).expect(200);
    assert.equal(res.body.data.roomId, 'L-9901');
    assert.equal(res.body.data.price, 16000);
    assert.equal(res.body.data.available, false);
    assert.equal(res.body.data.floor, 14);
    assert.equal(res.body.data.conditionRating, 2);
    assert.deepEqual(res.body.data.appliances, [{ serialNumber: 'TV-9901-03', name: 'TV' }]);
    const [rows] = await pool.execute("SELECT Serial_number FROM Appliance WHERE RoomID = 'L-9901'");
    assert.deepEqual(rows.map((r) => r.Serial_number), ['TV-9901-03']);
    const log = await lastLog();
    assert.match(log.Changed, /^UPDATE RoomUnit L-9901: /);
    assert.match(log.Changed, /price 15000 -> 16000/);
    assert.match(log.Changed, /floor 9 -> 14/);
    assert.match(log.Changed, /conditionRating 4 -> 2/);
    await request(app).get('/api/rooms/L-0001').expect(404);
  });

  it('rejects a bad :id (400) and a missing room (404) on update and delete', async () => {
    await admin.put('/api/rooms/L-4242').send(validRoom()).expect(404);
    await admin.put('/api/rooms/9901').send(validRoom()).expect(400);
    await admin.delete('/api/rooms/9901').expect(400);
  });

  it('deletes a room and its appliances', async () => {
    const res = await admin.delete('/api/rooms/L-9901').expect(200);
    assert.deepEqual(res.body, { data: { ok: true } });
    const [rows] = await pool.execute("SELECT COUNT(*) AS n FROM Appliance WHERE RoomID = 'L-9901'");
    assert.equal(rows[0].n, 0);
    await request(app).get('/api/rooms/L-9901').expect(404);
    await admin.delete('/api/rooms/L-9901').expect(404);
    assert.deepEqual(await lastLog(), { Username: 'listing_ploy', Changed: 'DELETE RoomUnit L-9901' });
  });
});
