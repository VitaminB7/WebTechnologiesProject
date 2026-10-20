# AURA Sukhumvit 36: Room Rental Management

ITDS241 Web Technologies, Phase 2. Node.js (Express) + MySQL 8.4 back end, plain HTML/CSS/JS front end.
Express serves the API at `/api` and the front end (`frontend/public`) at `/`, so everything runs from one server.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- API contract: [docs/API.md](docs/API.md)
- Database: [db/schema.sql](db/schema.sql) (tables) + [db/seed.sql](db/seed.sql) (sample data)

## Project layout

```
aura-rental/
  backend/            Express API + serves the front end (see "Back-end layout" below)
  frontend/public/    8 pages: plain HTML + CSS + JS, no build step
    css/              base.css (all pages), admin.css (admin pages)
    js/api.js         the only file that calls fetch()
    js/ui.js          shared UI helpers (header, cards, messages)
    js/pages/         one script per page
    admin/            room management + account management (login required)
  db/                 schema.sql (tables) + seed.sql (sample data)
  docs/               SPEC.md (pages + rules), API.md (contract), REVIEW.md (review + open decisions)
```

## Requirements

- Node.js 20 or newer (developed on Node 24)
- MySQL 8.x running locally (the default setup assumes `root` with no password on port 3306)

You do **not** need the `mysql` command-line client. The reset script runs the SQL files through Node.

## 1. Install

Open a terminal (PowerShell, cmd or Git Bash) in the project folder:

```bash
cd backend
npm install
copy .env.example .env      # Git Bash / macOS / Linux: cp .env.example .env
```

Edit `backend/.env` if your MySQL user, password or port is different:

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL server |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* | MySQL login |
| `DB_NAME` | `aura_rental` | database used by the app |
| `SESSION_SECRET` | | any long random string |
| `PORT` | `3000` | web server port |

## 2. Create the database

```bash
npm run db:reset
```

This **drops and recreates** the database named in `DB_NAME`, loads `db/schema.sql`, then `db/seed.sql`
(20 rooms on floors 2-30, 3 admins, 3 bookings). Run it again any time you want fresh sample data.

## 3. Run

```bash
npm start        # or: npm run dev   (restarts automatically when a file changes)
```

Open http://localhost:3000. Quick check: http://localhost:3000/api/rooms should return JSON rooms.

## Test logins

| Username | Password | Role | Status |
|---|---|---|---|
| `admin_main` | `Admin@1234` | super_admin | active (can manage admin accounts) |
| `listing_ploy` | `Listing@1234` | listing_admin | active |
| `ops_niran` | `Ops@12345` | operations | **inactive**, login is refused (403) |

You can also log in with an email instead of the username, e.g. `admin@aura36.co.th` / `Admin@1234`.

## 4. Test

```bash
npm test
```

The tests use a **separate database `aura_rental_test`**. They create it from `schema.sql` + `seed.sql` before
each test file, so your dev data in `aura_rental` is never touched. Uploaded test images go to a temp folder.
MySQL must be running.

## Back-end layout

```
backend/
  scripts/db-reset.js   npm run db:reset (also used by the tests)
  src/server.js         loads .env, starts the server
  src/app.js            builds the Express app (exported for tests)
  src/config/           MySQL pool, upload folder
  src/routes/           URL -> middleware + controller only
  src/controllers/      read request, call service, send response
  src/services/         business rules + SQL (parameterised queries only)
  src/validators/       pure functions: input -> { value, errors }
  src/middleware/       requireAuth / requireRole, requireRoomId, upload (multer), errorHandler
  src/utils/            HttpError, mappers (DB row -> API object), logAction, transaction helper
  tests/                node:test + supertest
  uploads/              room images (served at /uploads, not committed)
```

## Troubleshooting

- `ECONNREFUSED 127.0.0.1:3306`: MySQL is not running. Start the MySQL service, then retry.
- `Access denied for user 'root'`: set `DB_PASSWORD` in `backend/.env`.
- `EADDRINUSE :3000`: another server is already on port 3000. Stop it or change `PORT` in `.env`.

## Working with Git

- `main` always runs: `npm test` passes before anything is merged.
- New work goes on a branch: `feature/<short-name>`, `fix/<short-name>` or `docs/<short-name>`,
  then a pull request into `main`.
- Commit messages: `type(scope): what changed`, e.g. `feat(frontend): add booking form`,
  `fix(backend): reject past move-in dates`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Never commit `backend/.env`, `node_modules/` or uploaded images (already in `.gitignore`).
