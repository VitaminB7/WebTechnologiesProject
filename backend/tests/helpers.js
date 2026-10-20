// Shared test setup: point the app at a separate database and a temp upload folder
// BEFORE anything requires src/db.js, so dev data and real room photos are never touched.
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEST_DB = 'aura_rental_test';
process.env.DB_NAME = TEST_DB;
process.env.SESSION_SECRET = 'test-only-secret';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-uploads-'));
// Fills DB_HOST/DB_USER/... from .env if present; never overrides the values set above.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const request = require('supertest');
const { resetDatabase } = require('../scripts/db-reset');
const app = require('../src/app');
const pool = require('../src/db');

const LOGINS = {
  super: { username: 'admin_main', password: 'Admin@1234' },
  listing: { username: 'listing_ploy', password: 'Listing@1234' },
  ops: { username: 'ops_niran', password: 'Ops@12345' },
};

async function resetTestDb() {
  await resetDatabase(TEST_DB);
}

async function closeDb() {
  await pool.end();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
}

/** A supertest agent that keeps the session cookie after logging in. */
async function loginAs(who) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(LOGINS[who]);
  if (res.status !== 200) throw new Error(`login as ${who} failed: ${res.status}`);
  return agent;
}

/** Newest Log row by LogID number (L-10 is newer than L-9). */
async function lastLog() {
  const [rows] = await pool.execute(
    'SELECT Username, Changed FROM Log ORDER BY CAST(SUBSTRING(LogID, 3) AS UNSIGNED) DESC LIMIT 1',
  );
  return rows[0];
}

function validRoom(overrides = {}) {
  return {
    roomId: 'L-9901',
    building: 'Building C',
    floor: 9,
    roomType: 'Deluxe room',
    bedrooms: 1,
    size: 34.5,
    price: 15000,
    description: 'Test room',
    conditionRating: 4,
    minimumLease: 12,
    available: true,
    appliances: [
      { serialNumber: 'SF-9901-01', name: 'Sofa' },
      { serialNumber: 'FR-9901-02', name: 'Fridge' },
    ],
    owner: { name: 'Test Owner', phone: '080-000-0000', email: 'owner@example.com', lineId: 'owner1' },
    ...overrides,
  };
}

module.exports = {
  app, pool, request, LOGINS, resetTestDb, closeDb, loginAs, lastLog, validRoom,
};
