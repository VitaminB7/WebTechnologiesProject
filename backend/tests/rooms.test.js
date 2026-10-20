const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  app, request, resetTestDb, closeDb, loginAs, lastLog, validRoom,
} = require('./helpers');

const ROOM_KEYS = [
  'roomId', 'building', 'floor', 'roomType', 'bedrooms', 'size', 'price', 'description',
  'conditionRating', 'minimumLease', 'available', 'appliances', 'images', 'owner', 'updatedAt',
].sort();

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

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
    assert.equal(typeof room.price, 'number');
    assert.equal(typeof room.available, 'boolean');
    assert.ok(Array.isArray(room.appliances) && Array.isArray(room.images));
    assert.ok(!Number.isNaN(Date.parse(room.updatedAt)));
    const ids = res.body.data.map((r) => r.roomId);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'default sort is roomId ascending');
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

  it('filters by type, floor, bedrooms, price range, condition and availability', async () => {
    const cases = [
      ['type=Suite', (r) => r.roomType === 'Suite'],
      ['floor=12', (r) => r.floor === 12],
      ['bedrooms=2', (r) => r.bedrooms === 2],
      ['minPrice=15000&maxPrice=25000', (r) => r.price >= 15000 && r.price <= 25000],
      ['minCondition=4', (r) => r.conditionRating >= 4],
      ['available=false', (r) => r.available === false],
      ['type=Deluxe&available=true&minCondition=3', (r) => r.roomType === 'Deluxe' && r.available && r.conditionRating >= 3],
    ];
    for (const [query, matches] of cases) {
      const res = await request(app).get(`/api/rooms?${query}&pageSize=50`).expect(200);
      assert.ok(res.body.data.length > 0, `${query} should match seeded rooms`);
      assert.ok(res.body.data.every(matches), `${query} returned a non-matching room`);
      assert.equal(res.body.meta.total, res.body.data.length, `${query} total`);
    }
  });

  it('searches q by room number or owner name', async () => {
    const byId = await request(app).get('/api/rooms?q=1201').expect(200);
    assert.ok(byId.body.data.some((r) => r.roomId === 1201));
    const byOwner = await request(app).get('/api/rooms?q=natthaya').expect(200);
    assert.deepEqual(byOwner.body.data.map((r) => r.roomId), [1201]);
  });

  it('treats SQL-injection-looking and wildcard q values as plain text (200, no rows)', async () => {
    const attacks = ["' OR 1=1 --", '1201; DROP TABLE RoomUnit;', '%', '_', '\\', '") UNION SELECT * FROM AdminAccount --'];
    for (const q of attacks) {
      const res = await request(app).get('/api/rooms').query({ q }).expect(200);
      assert.equal(res.body.meta.total, 0, `q=${q}`);
    }
    const still = await request(app).get('/api/rooms').expect(200);
    assert.equal(still.body.meta.total, 20, 'table untouched');
  });

  it('sorts by price ascending / descending / newest', async () => {
    const asc = await request(app).get('/api/rooms?sort=price_asc&pageSize=50').expect(200);
    const prices = asc.body.data.map((r) => r.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    const desc = await request(app).get('/api/rooms?sort=price_desc&pageSize=1').expect(200);
    assert.equal(desc.body.data[0].roomId, 3001);
    await request(app).get('/api/rooms?sort=newest').expect(200);
  });

  it('returns 400 with fields for invalid query values instead of 500', async () => {
    const bad = {
      'floor=abc': 'floor',
      'floor=1.5': 'floor',
      'minPrice=-1': 'minPrice',
      'maxPrice=NaN': 'maxPrice',
      'minPrice=20000&maxPrice=10000': 'maxPrice',
      'bedrooms=99': 'bedrooms',
      'minCondition=6': 'minCondition',
      'available=yes': 'available',
      'type=Villa': 'type',
      'page=0': 'page',
      'pageSize=51': 'pageSize',
      'sort=RoomID%3BDROP': 'sort',
      'type=Suite&type=Deluxe': 'type',
    };
    for (const [query, field] of Object.entries(bad)) {
      const res = await request(app).get(`/api/rooms?${query}`).expect(400);
      assert.ok(res.body.error.fields[field], `${query} should flag ${field}`);
    }
  });
});

describe('GET /api/rooms/:id, /similar and /api/stats', () => {
  it('returns one room', async () => {
    const res = await request(app).get('/api/rooms/1201').expect(200);
    assert.equal(res.body.data.roomId, 1201);
    assert.equal(res.body.data.owner.name, 'Natthaya Siriwan');
    assert.ok(res.body.data.appliances.includes('Sofa'));
  });

  it('returns 404 for a missing or malformed id', async () => {
    await request(app).get('/api/rooms/4242').expect(404);
    await request(app).get('/api/rooms/abc').expect(404);
    await request(app).get('/api/rooms/1201abc').expect(404);
  });

  it('returns up to 3 similar rooms of the same type, excluding itself', async () => {
    const res = await request(app).get('/api/rooms/1201/similar').expect(200);
    assert.ok(res.body.data.length > 0 && res.body.data.length <= 3);
    assert.ok(res.body.data.every((r) => r.roomType === 'Deluxe' && r.roomId !== 1201));
    await request(app).get('/api/rooms/4242/similar').expect(404);
  });

  it('returns home page stats', async () => {
    const res = await request(app).get('/api/stats').expect(200);
    assert.deepEqual(res.body.data, { totalRooms: 20, roomTypes: 3, availableRooms: 15 });
  });
});

describe('room admin CRUD', () => {
  it('requires login for every write (401)', async () => {
    await request(app).post('/api/rooms').send(validRoom()).expect(401);
    await request(app).put('/api/rooms/1201').send(validRoom()).expect(401);
    await request(app).delete('/api/rooms/1201').expect(401);
    await request(app).post('/api/rooms/1201/images').expect(401);
    await request(app).delete('/api/rooms/1201/images/1').expect(401);
  });

  it('creates a room (201) with appliances, defaults and a Log row', async () => {
    const res = await admin.post('/api/rooms').send(validRoom({ appliances: ['Sofa', 'Fridge', 'Sofa'] })).expect(201);
    const room = res.body.data;
    assert.equal(room.roomId, 9901);
    assert.equal(room.building, 'AURA Sukhumvit 36');
    assert.equal(room.size, 34.5);
    assert.deepEqual(room.appliances, ['Fridge', 'Sofa']);
    assert.deepEqual(room.images, []);
    assert.deepEqual(await lastLog(), { Username: 'listing_ploy', Changed: 'CREATE RoomUnit 9901' });
  });

  it('treats null and "" optional fields as empty (NULL), and keeps building sent back on edit', async () => {
    const created = await admin.post('/api/rooms').send(validRoom({
      roomId: 9903, description: '', building: undefined,
      owner: { name: 'Empty Fields', phone: null, email: '', lineId: '' },
    })).expect(201);
    assert.equal(created.body.data.description, null);
    assert.equal(created.body.data.building, 'AURA Sukhumvit 36');
    assert.deepEqual(created.body.data.owner, { name: 'Empty Fields', phone: null, email: null, lineId: null });
    const edited = await admin.put('/api/rooms/9903')
      .send(validRoom({ building: 'AURA Sukhumvit 36 Tower B', owner: { name: 'Empty Fields' } })).expect(200);
    assert.equal(edited.body.data.building, 'AURA Sukhumvit 36 Tower B');
    await admin.delete('/api/rooms/9903').expect(200);
  });

  it('returns 409 when the roomId already exists', async () => {
    const res = await admin.post('/api/rooms').send(validRoom({ roomId: 1201 })).expect(409);
    assert.ok(res.body.error.message);
  });

  it('returns 400 with a message per invalid field', async () => {
    const res = await admin.post('/api/rooms').send({
      roomId: 0, floor: 100, roomType: 'Villa', bedrooms: -1, size: 0, price: -5,
      conditionRating: 6, minimumLease: 0, available: 'maybe', appliances: ['Jacuzzi'],
      owner: { name: '', email: 'not-an-email' },
    }).expect(400);
    const expected = ['roomId', 'floor', 'roomType', 'bedrooms', 'size', 'price', 'conditionRating',
      'minimumLease', 'available', 'appliances', 'owner.name', 'owner.email'];
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), expected.sort());
  });

  it('returns 400 for a non-object body and for over-long text', async () => {
    await admin.post('/api/rooms').send([1, 2, 3]).expect(400);
    const res = await admin.post('/api/rooms')
      .send(validRoom({ roomId: 9902, owner: { name: 'x'.repeat(151) } })).expect(400);
    assert.ok(res.body.error.fields['owner.name']);
  });

  it('updates a room (body roomId ignored), replaces appliances and logs the diff', async () => {
    const res = await admin.put('/api/rooms/9901')
      .send(validRoom({ roomId: 1, price: 16000, appliances: ['TV'], available: false })).expect(200);
    assert.equal(res.body.data.roomId, 9901);
    assert.equal(res.body.data.price, 16000);
    assert.equal(res.body.data.available, false);
    assert.deepEqual(res.body.data.appliances, ['TV']);
    const log = await lastLog();
    assert.match(log.Changed, /^UPDATE RoomUnit 9901: /);
    assert.match(log.Changed, /price 15000 -> 16000/);
    await request(app).get('/api/rooms/1').expect(404);
  });

  it('rolls back the whole update when validation passes but nothing exists (404)', async () => {
    await admin.put('/api/rooms/4242').send(validRoom()).expect(404);
  });

  it('uploads images as { imageId, url } in upload order, serves them, and removes one by imageId', async () => {
    const upload = await admin.post('/api/rooms/9901/images')
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(200);
    const { images } = upload.body.data;
    assert.equal(images.length, 2);
    for (const image of images) {
      assert.deepEqual(Object.keys(image).sort(), ['imageId', 'url']);
      assert.equal(typeof image.imageId, 'number');
      assert.match(image.url, /^\/uploads\/9901-[0-9a-f]+\.png$/);
    }
    assert.ok(images[0].imageId < images[1].imageId);
    await request(app).get(images[0].url).expect(200);

    // An image id that belongs to another room, or is not a number, is "not found".
    await admin.delete(`/api/rooms/1201/images/${images[0].imageId}`).expect(404);
    await admin.delete('/api/rooms/9901/images/abc').expect(404);

    const removed = await admin.delete(`/api/rooms/9901/images/${images[0].imageId}`).expect(200);
    assert.deepEqual(removed.body.data.images, [images[1]]);
    assert.ok(!fs.existsSync(path.join(process.env.UPLOAD_DIR, path.basename(images[0].url))));
    await admin.delete(`/api/rooms/9901/images/${images[0].imageId}`).expect(404);
  });

  it('rejects bad uploads with 400', async () => {
    await admin.post('/api/rooms/9901/images').expect(400);
    await admin.post('/api/rooms/9901/images')
      .attach('images', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' }).expect(400);
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    await admin.post('/api/rooms/9901/images')
      .attach('images', big, { filename: 'big.png', contentType: 'image/png' }).expect(400);
    await admin.post('/api/rooms/4242/images')
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(404);
  });

  it('checks magic bytes: a fake image rejects the whole request and deletes every file it saved', async () => {
    const before = fs.readdirSync(process.env.UPLOAD_DIR).sort();
    const roomBefore = await request(app).get('/api/rooms/9901').expect(200);
    const res = await admin.post('/api/rooms/9901/images')
      .attach('images', PNG, { filename: 'real.png', contentType: 'image/png' })
      .attach('images', Buffer.from('not an image'), { filename: 'fake.jpg', contentType: 'image/jpeg' })
      .expect(400);
    assert.equal(res.body.error.fields.images, 'file is not a valid jpg, png or webp image');
    assert.deepEqual(fs.readdirSync(process.env.UPLOAD_DIR).sort(), before);
    const roomAfter = await request(app).get('/api/rooms/9901').expect(200);
    assert.deepEqual(roomAfter.body.data.images, roomBefore.body.data.images);
    // A real PNG declared as JPEG does not match its declared type either.
    await admin.post('/api/rooms/9901/images')
      .attach('images', PNG, { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(400);
  });

  it('accepts real JPEG and WEBP signatures', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
    const res = await admin.post('/api/rooms/9901/images')
      .attach('images', jpeg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('images', webp, { filename: 'b.webp', contentType: 'image/webp' })
      .expect(200);
    const urls = res.body.data.images.map((image) => image.url);
    assert.ok(urls.some((u) => u.endsWith('.jpg')) && urls.some((u) => u.endsWith('.webp')));
  });

  it('deletes a room and its image files', async () => {
    const room = await request(app).get('/api/rooms/9901').expect(200);
    const files = room.body.data.images.map((image) => path.join(process.env.UPLOAD_DIR, path.basename(image.url)));
    assert.ok(files.length > 0 && files.every((f) => fs.existsSync(f)));
    const res = await admin.delete('/api/rooms/9901').expect(200);
    assert.deepEqual(res.body, { data: { ok: true } });
    assert.ok(files.every((f) => !fs.existsSync(f)));
    await request(app).get('/api/rooms/9901').expect(404);
    await admin.delete('/api/rooms/9901').expect(404);
    assert.deepEqual(await lastLog(), { Username: 'listing_ploy', Changed: 'DELETE RoomUnit 9901' });
  });
});
