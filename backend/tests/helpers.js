// Shared test setup: point the app at a separate database and a temp upload folder
// BEFORE anything requires src/config/db.js, so dev data is never touched.
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
const pool = require('../src/config/db');

const LOGINS = {
  super: { username: 'admin_main', password: 'Admin@1234' },
  listing: { username: 'listing_ploy', password: 'Listing@1234' },
  inactive: { username: 'ops_niran', password: 'Ops@12345' },
};

async function resetTestDb() {
  await resetDatabase({ dbName: TEST_DB });
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

async function lastLog() {
  const [rows] = await pool.execute('SELECT Username, Changed FROM Log ORDER BY LogID DESC LIMIT 1');
  return rows[0];
}

function validRoom(overrides = {}) {
  return {
    roomId: 9901,
    floor: 9,
    roomType: 'Deluxe',
    bedrooms: 1,
    size: 34.5,
    price: 15000,
    description: 'Test room',
    conditionRating: 4,
    minimumLease: 12,
    available: true,
    appliances: ['Sofa', 'Fridge'],
    owner: { name: 'Test Owner', phone: '080-000-0000', email: 'owner@example.com', lineId: 'owner1' },
    ...overrides,
  };
}

/** Date string N days from today in Bangkok time (matches the server's "today"). */
function bangkokDate(daysFromToday) {
  const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

module.exports = {
  app, pool, request, LOGINS, resetTestDb, closeDb, loginAs, lastLog, validRoom, bangkokDate,
};
