// Tests for POST /api/rooms/:id/images and DELETE /api/rooms/:id/images/:imageId,
// plus "deleting a room deletes its image files".
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  app, request, resetTestDb, closeDb, loginAs, lastLog, validRoom,
} = require('./helpers');

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const ROOM_ID = 'L-9911';

function uploadedFiles() {
  return fs.readdirSync(process.env.UPLOAD_DIR).sort();
}

function fileOf(image) {
  return path.join(process.env.UPLOAD_DIR, path.basename(image.url));
}

let admin;

before(async () => {
  await resetTestDb();
  admin = await loginAs('listing');
  await admin.post('/api/rooms').send(validRoom({ roomId: ROOM_ID })).expect(201);
});
after(closeDb);

describe('room images', () => {
  it('requires login (401)', async () => {
    await request(app).post(`/api/rooms/${ROOM_ID}/images`).expect(401);
    await request(app).delete(`/api/rooms/${ROOM_ID}/images/1`).expect(401);
  });

  it('uploads real PNGs, returns the Room with { imageId, url } in order, serves the file with nosniff', async () => {
    const res = await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(200);
    const room = res.body.data;
    assert.equal(room.roomId, ROOM_ID);
    assert.equal(room.images.length, 2);
    for (const image of room.images) {
      assert.deepEqual(Object.keys(image).sort(), ['imageId', 'url']);
      assert.equal(typeof image.imageId, 'number');
      assert.match(image.url, /^\/uploads\/L-9911-[0-9a-f]+\.png$/);
      assert.ok(fs.existsSync(fileOf(image)));
    }
    assert.ok(room.images[0].imageId < room.images[1].imageId);
    const file = await request(app).get(room.images[0].url).expect(200);
    assert.equal(file.headers['content-type'], 'image/png');
    assert.equal(file.headers['x-content-type-options'], 'nosniff');
    assert.match((await lastLog()).Changed, /^UPDATE RoomUnit L-9911: added 2 image\(s\)/);
    const detail = await request(app).get(`/api/rooms/${ROOM_ID}`).expect(200);
    assert.deepEqual(detail.body.data.images, room.images);
  });

  it('accepts real JPEG and WEBP content', async () => {
    const res = await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
      .attach('images', WEBP, { filename: 'd.webp', contentType: 'image/webp' })
      .expect(200);
    const urls = res.body.data.images.map((image) => image.url);
    assert.equal(urls.length, 4);
    assert.ok(urls[2].endsWith('.jpg') && urls[3].endsWith('.webp'));
  });

  it('rejects a fake jpg by its content, and keeps no file from that request', async () => {
    const filesBefore = uploadedFiles();
    const res = await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', PNG, { filename: 'real.png', contentType: 'image/png' })
      .attach('images', Buffer.from('this is not an image'), { filename: 'fake.jpg', contentType: 'image/jpeg' })
      .expect(400);
    assert.ok(res.body.error.fields.images);
    assert.deepEqual(uploadedFiles(), filesBefore);
    // A real PNG that claims to be a JPEG does not match its declared type either.
    await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', PNG, { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(400);
    // Not an allowed type at all.
    await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' }).expect(400);
    assert.deepEqual(uploadedFiles(), filesBefore);
    const room = await request(app).get(`/api/rooms/${ROOM_ID}`).expect(200);
    assert.equal(room.body.data.images.length, 4);
  });

  it('rejects a file over 2 MB, more than 5 files, a wrong field name and an empty upload (400)', async () => {
    const filesBefore = uploadedFiles();
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const tooBig = await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('images', big, { filename: 'big.png', contentType: 'image/png' }).expect(400);
    assert.match(tooBig.body.error.fields.images, /2 MB/);

    let six = admin.post(`/api/rooms/${ROOM_ID}/images`);
    for (let i = 0; i < 6; i++) {
      six = six.attach('images', PNG, { filename: `p${i}.png`, contentType: 'image/png' });
    }
    const tooMany = await six.expect(400);
    assert.ok(tooMany.body.error.fields.images);

    await admin.post(`/api/rooms/${ROOM_ID}/images`)
      .attach('photo', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
    const empty = await admin.post(`/api/rooms/${ROOM_ID}/images`).expect(400);
    assert.ok(empty.body.error.fields.images);
    assert.deepEqual(uploadedFiles(), filesBefore);
  });

  it('accepts exactly 5 files', async () => {
    let five = admin.post(`/api/rooms/${ROOM_ID}/images`);
    for (let i = 0; i < 5; i++) {
      five = five.attach('images', PNG, { filename: `p${i}.png`, contentType: 'image/png' });
    }
    const res = await five.expect(200);
    assert.equal(res.body.data.images.length, 9);
  });

  it('answers 404 for a missing room and 400 for a bad room id, without keeping the files', async () => {
    const filesBefore = uploadedFiles();
    await admin.post('/api/rooms/L-4242/images')
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(404);
    await admin.post('/api/rooms/9911/images')
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(400);
    assert.deepEqual(uploadedFiles(), filesBefore);
  });

  it('deletes one image (row + file) and returns the Room', async () => {
    const before = (await request(app).get(`/api/rooms/${ROOM_ID}`).expect(200)).body.data.images;
    const target = before[0];
    // An image of another room, or an id that is not a number, is "not found".
    await admin.delete(`/api/rooms/L-1201/images/${target.imageId}`).expect(404);
    await admin.delete(`/api/rooms/${ROOM_ID}/images/abc`).expect(404);
    await admin.delete(`/api/rooms/9911/images/${target.imageId}`).expect(400);

    const res = await admin.delete(`/api/rooms/${ROOM_ID}/images/${target.imageId}`).expect(200);
    assert.deepEqual(res.body.data.images, before.slice(1));
    assert.ok(!fs.existsSync(fileOf(target)));
    assert.match((await lastLog()).Changed, /removed image/);
    await admin.delete(`/api/rooms/${ROOM_ID}/images/${target.imageId}`).expect(404);
  });

  it('deleting the room deletes its image rows and files', async () => {
    const room = await request(app).get(`/api/rooms/${ROOM_ID}`).expect(200);
    const files = room.body.data.images.map(fileOf);
    assert.ok(files.length > 0 && files.every((f) => fs.existsSync(f)));
    await admin.delete(`/api/rooms/${ROOM_ID}`).expect(200);
    assert.ok(files.every((f) => !fs.existsSync(f)));
    assert.deepEqual(uploadedFiles(), []);
    assert.deepEqual(await lastLog(), { Username: 'listing_ploy', Changed: `DELETE RoomUnit ${ROOM_ID}` });
  });
});
