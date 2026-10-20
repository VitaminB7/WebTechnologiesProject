# AURA Sukhumvit 36: Room Rental Management

ITDS241 Web Technologies, Phase 2. Node.js (Express) + MySQL 8.4 back end (`npm start` works without installing MySQL), plain HTML/CSS/JS front end.
Express serves the API at `/api` and the front end (`frontend/public`) at `/`, so everything runs from one server.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- API contract: [docs/API.md](docs/API.md)
- Database: [db/schema.sql](db/schema.sql) (tables, follows the report's Data Dictionary) + [db/seed.sql](db/seed.sql) (sample data)

## Project layout

```
aura-rental/
  backend/            Express API + serves the front end (see "Back-end layout" below)
  frontend/public/    7 pages: plain HTML + CSS + JS, no build step
    css/              base.css (all pages), admin.css (admin pages)
    js/api.js         the only file that calls fetch()
    js/ui.js          shared UI helpers (header, cards, messages)
    js/pages/         one script per page
    admin/            room management + account management (login required)
  db/                 schema.sql (tables) + seed.sql (sample data)
  docs/               SPEC.md (pages + rules), API.md (contract), REVIEW.md (review + open decisions)
```

## Quick start (no database setup)

Needs only **Node.js 20 or newer**. Open a terminal in the project folder:

```bash
cd backend
npm install
npm start
```

Open http://localhost:3000.

`npm start` looks for MySQL first:

| Your computer | What `npm start` does |
|---|---|
| MySQL running, `aura_rental` exists | uses it, your data is kept |
| MySQL running, no `aura_rental` yet | creates it from `db/schema.sql` + `db/seed.sql` |
| No MySQL (or wrong login) | starts a **temporary MySQL** with the sample data. Everything you change is lost when you stop the server |

The temporary MySQL is real MySQL 8.4 run by [mysql-memory-server](https://www.npmjs.com/package/mysql-memory-server).
If MySQL 8.4 is not installed, the first `npm start` downloads it from cdn.mysql.com (a few hundred MB,
once), so the first start can take a few minutes. Stop the server with `Ctrl + C`; the temporary MySQL stops with it.

## Using your own MySQL (keeps data between runs)

Install MySQL 8.x, then create `backend/.env`:

```bash
copy .env.example .env      # Git Bash / macOS / Linux: cp .env.example .env
```

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL server |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* | MySQL login |
| `DB_NAME` | `aura_rental` | database used by the app |
| `SESSION_SECRET` | random each start | any long random string (keeps you logged in across restarts) |
| `PORT` | `3000` | web server port |

To go back to the sample data at any time:

```bash
npm run db:reset
```

This **drops and recreates** the database named in `DB_NAME`, loads `db/schema.sql`, then `db/seed.sql`
(20 rooms L-0203 … L-3001 with 115 appliances, 3 admins). You do not need the `mysql` command-line client.

Other commands: `npm run dev` restarts automatically when a file changes.
Quick check: http://localhost:3000/api/rooms should return JSON rooms.

## Test logins

| Username | Password | Role | Can do |
|---|---|---|---|
| `admin_main` | `Admin@1234` | SuperAdmin | rooms + admin accounts + logs |
| `listing_ploy` | `Listing@1234` | Admin | rooms |
| `ops_niran` | `Ops@12345` | Admin | rooms (has no email) |

You can also log in with an email instead of the username, e.g. `admin@aura36.co.th` / `Admin@1234`.

## 4. Test

```bash
npm test
```

The tests use a **separate database `aura_rental_test`**. They create it from `schema.sql` + `seed.sql` before
each test file, so your dev data in `aura_rental` is never touched. Uploaded test images go to a temp folder.
The tests need a running MySQL (they do not start the temporary one).

## Back-end layout

```
backend/
  scripts/db-reset.js   npm run db:reset (also used by the tests)
  src/server.js         loads .env, prepares the database, starts the server
  src/app.js            builds the Express app (exported for tests)
  src/config/           MySQL pool, temporary-MySQL fallback (ensure-database.js)
  src/routes/           URL -> middleware + controller only
  src/controllers/      read request, call service, send response
  src/services/         business rules + SQL (parameterised queries only)
  src/validators/       pure functions: input -> { value, errors }
  src/middleware/       requireAuth / requireRole, requireRoomId, errorHandler
  src/utils/            HttpError, mappers (DB row -> API object), logAction, transaction helper
  tests/                node:test + supertest
```

## Troubleshooting

- Data disappears after restarting: you are on the temporary MySQL (the start message says so). Use your own MySQL to keep data.
- `Access denied for user 'root'` in `npm test`: set `DB_PASSWORD` in `backend/.env`.
- First `npm start` seems stuck: it is downloading MySQL. Wait, and check your internet connection.
- `EADDRINUSE :3000`: another server is already on port 3000. Stop it or change `PORT` in `.env`.

## Working with Git

Step-by-step guide for group members (Thai): [CONTRIBUTING.md](CONTRIBUTING.md)

- `main` always runs: `npm test` passes before anything is merged.
- New work goes on a branch: `feature/<short-name>`, `fix/<short-name>` or `docs/<short-name>`,
  then a pull request into `main`.
- Commit messages: `type(scope): what changed`, e.g. `feat(frontend): add room filter`,
  `fix(backend): reject past move-in dates`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Never commit `backend/.env` or `node_modules/` (already in `.gitignore`).
