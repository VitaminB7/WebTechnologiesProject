const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// No MySQL server or existing upload files are needed for these checks.
const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'condong-bundled-images-'));
process.env.UPLOAD_DIR = uploadDirectory;
const { SOURCE_DIR, bundledImagePath, resolveRoomImagePath } = require('../src/helpers/room-image-files');
const pool = require('../src/db');
const { seedRoomImages } = require('../src/helpers/seed-room-images');

after(async () => {
  await pool.end();
  assert.equal(path.dirname(uploadDirectory), os.tmpdir());
  fs.rmSync(uploadDirectory, { recursive: true, force: true });
});

test('every bundled room photo resolves with an empty uploads directory', () => {
  let count = 0;
  for (const room of fs.readdirSync(SOURCE_DIR, { withFileTypes: true })) {
    if (!room.isDirectory() || !/^L-\d{4}$/.test(room.name)) continue;
    for (const filename of fs.readdirSync(path.join(SOURCE_DIR, room.name))) {
      if (!/\.(jpg|jpeg|png|webp)$/.test(filename)) continue;
      const expected = path.join(SOURCE_DIR, room.name, filename);
      const actual = resolveRoomImagePath('/uploads/prototype-' + filename);
      assert.equal(actual, expected);
      assert.ok(fs.statSync(actual).size > 0);
      count++;
    }
  }
  assert.equal(count, 80);
  assert.deepEqual(fs.readdirSync(uploadDirectory), []);
});

test('a custom uploaded photo is still used without modifying it', () => {
  const filename = 'L-0203-custom.jpg';
  const file = path.join(uploadDirectory, filename);
  const bytes = Buffer.from('custom upload fixture');
  fs.writeFileSync(file, bytes);
  assert.equal(resolveRoomImagePath('/uploads/' + filename), file);
  assert.deepEqual(fs.readFileSync(file), bytes);
  fs.unlinkSync(file);
});

test('an existing uploaded copy takes precedence over its bundled original', () => {
  const filename = 'prototype-L-0203-1.jpg';
  const file = path.join(uploadDirectory, filename);
  fs.writeFileSync(file, 'existing local copy');
  assert.equal(resolveRoomImagePath('/uploads/' + filename), file);
  assert.equal(fs.readFileSync(file, 'utf8'), 'existing local copy');
  fs.unlinkSync(file);
});

test('the fallback rejects traversal, private files and unknown images', () => {
  for (const name of [
    '../.env', '..\\.env', 'prototype-../../.env',
    'prototype-L-0203-../.env', 'L-0203-custom.jpg',
    'prototype-L-9999-1.jpg', 'prototype-L-0203-999.jpg',
  ]) {
    assert.equal(bundledImagePath(name), null);
  }
  assert.equal(resolveRoomImagePath('/uploads/L-9999-missing.jpg'), null);
  assert.equal(resolveRoomImagePath(null), null);
});

function fakeConnection(images) {
  const state = { images: images.map(image => ({ ...image })), deleted: [], inserted: [], released: false };
  return {
    state,
    async beginTransaction() { },
    async commit() { },
    async rollback() { throw new Error('Unexpected rollback'); },
    release() { state.released = true; },
    async execute(sql, values) {
      if (sql.startsWith('SELECT RoomID')) {
        return [values[0] === 'L-0203' ? [{ RoomID: 'L-0203' }] : []];
      }
      if (sql.startsWith('SELECT ImageID')) {
        return [values[0] === 'L-0203' ? state.images : []];
      }
      if (sql.startsWith('DELETE FROM RoomImage')) {
        state.deleted.push(values[0]);
        state.images = state.images.filter(image => image.ImageID !== values[0]);
        return [{}];
      }
      if (sql.startsWith('INSERT INTO RoomImage')) {
        state.inserted.push(values);
        state.images.push({ ImageID: 100 + state.images.length, FilePath: values[1] });
        return [{}];
      }
      throw new Error('Unexpected query: ' + sql);
    },
  };
}

test('startup preserves image IDs from a shared database on a fresh clone', async t => {
  const images = [1, 2, 3, 4].map(id => ({
    ImageID: id,
    FilePath: '/uploads/prototype-L-0203-' + id + '.jpg',
  }));
  const connection = fakeConnection(images);
  t.mock.method(pool, 'getConnection', async () => connection);
  await seedRoomImages();
  assert.deepEqual(connection.state.images, images);
  assert.deepEqual(connection.state.deleted, []);
  assert.deepEqual(connection.state.inserted, []);
  assert.deepEqual(fs.readdirSync(uploadDirectory), []);
  assert.equal(connection.state.released, true);
});

test('a first startup registers bundled photos once and repeat startup keeps them', async t => {
  const connection = fakeConnection([]);
  t.mock.method(pool, 'getConnection', async () => connection);
  await seedRoomImages();
  assert.equal(connection.state.inserted.length, 4);
  const firstImages = connection.state.images.map(image => ({ ...image }));
  await seedRoomImages();
  assert.equal(connection.state.inserted.length, 4);
  assert.deepEqual(connection.state.images, firstImages);
  for (const image of firstImages) {
    assert.ok(resolveRoomImagePath(image.FilePath));
  }
  for (const file of fs.readdirSync(uploadDirectory)) {
    fs.unlinkSync(path.join(uploadDirectory, file));
  }
});

test('startup preserves custom photos alongside bundled photos', async t => {
  const custom = path.join(uploadDirectory, 'L-0203-custom.jpg');
  fs.writeFileSync(custom, 'custom upload fixture');
  const images = [
    { ImageID: 11, FilePath: '/uploads/L-0203-custom.jpg' },
    { ImageID: 12, FilePath: '/uploads/prototype-L-0203-2.jpg' },
  ];
  const connection = fakeConnection(images);
  t.mock.method(pool, 'getConnection', async () => connection);
  await seedRoomImages();
  assert.deepEqual(connection.state.images, images);
  assert.deepEqual(connection.state.deleted, []);
  assert.deepEqual(connection.state.inserted, []);
  assert.equal(fs.readFileSync(custom, 'utf8'), 'custom upload fixture');
  fs.unlinkSync(custom);
});
