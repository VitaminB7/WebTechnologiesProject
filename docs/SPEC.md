# SPEC — AURA Sukhumvit 36 (Room Rental Management System)

ITDS241 Web Technologies — Phase 2 implementation of the Phase 1 wireframes (Figma board).
Stack: **Node.js (Express) + MySQL 8.4**, front end = plain HTML/CSS/JavaScript (no framework, no build step).

## Folder structure (fixed — do not invent other top-level folders)

Written so a **year-1 student** can follow it: few folders, one file per topic, SQL next to the code that uses it.

```
aura-rental/
├── README.md                 how to install / run / test
├── docs/SPEC.md  docs/API.md the contract (API.md wins on field names)
├── db/schema.sql             PM owns. Tables + constraints
├── db/seed.sql               PM owns. Sample data
├── backend/
│   ├── package.json          scripts: start, dev, test, db:reset
│   ├── .env.example          DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, SESSION_SECRET, PORT=3000
│   ├── scripts/db-reset.js   npm run db:reset (also used by tests and by database-setup.js)
│   ├── src/
│   │   ├── server.js         start: prepare database, then app.listen
│   │   ├── app.js            build the Express app: middleware + routes (exported for tests)
│   │   ├── db.js             the MySQL connection pool
│   │   ├── database-setup.js npm start without MySQL -> temporary MySQL (mysql-memory-server)
│   │   ├── routes/           ONE FILE PER TOPIC, each route = validate -> SQL -> send JSON
│   │   │   ├── auth.js       /api/auth/*
│   │   │   ├── rooms.js      /api/rooms*, /api/stats
│   │   │   ├── room-images.js /api/rooms/:id/images*
│   │   │   ├── admins.js     /api/admins*
│   │   │   └── logs.js       /api/logs
│   │   └── helpers/          small shared functions used by several routes
│   │       ├── auth.js       requireLogin, requireSuperAdmin (Express middleware)
│   │       ├── validate.js   simple checks: isBlank, isEmail, isIntBetween, ...
│   │       ├── log.js        writeLog(): insert one row into table Log
│   │       └── transaction.js runInTransaction(): begin / commit / rollback (+ retry on deadlock)
│   ├── uploads/              room photos (gitignored, keep .gitkeep)
│   └── tests/                node:test + supertest against the test DB aura_rental_test
└── frontend/public/          served statically by Express at /
    ├── index.html            Home
    ├── login.html
    ├── search.html
    ├── room.html             Detail template (?id=L-1201)
    ├── team.html             About Us
    ├── admin/rooms.html      Product/Service management (CRUD)
    ├── admin/accounts.html   User account management (CRUD)
    ├── css/style.css         shared by all pages
    ├── css/admin.css         admin pages only
    └── js/
        ├── api.js            THE ONLY file that calls fetch(): one function per API endpoint
        ├── common.js         shared: header/nav, footer, escapeHtml, formatPrice, roomCard, ...
        └── <page>.js         one script per page: home.js, login.js, search.js, room.js, team.js,
                              admin-rooms.js, admin-accounts.js
```

## Pages (from Figma wireframes)

Common public header: logo "N" + **AURA SUKHUMVIT 36** / "One residence. Better renting." · nav Home / Search / Team (active underline) · Login button on the right (shows "Admin" + Logout when logged in).
Admin header: "ADMIN PAGE" · nav Product management / User management · Logout. Admin footer: dark navy, "AURA CONDO".

1. **Home** `index.html` — eyebrow "ONE CONDO. SELECTED WITH CARE." · H1 "Your next room at AURA Sukhumvit 36." · paragraph · blue button "View Available Rooms" → search.html · checks: One trusted property / Clear monthly rent / Viewing support · 3 stat cards from `/api/stats` (Rental rooms, Room layouts, 24/7 Building security) · right: image placeholder + "ABOUT THE RESIDENCE" text.
2. **Login** `login.html` — public header with nav (the assignment needs a nav bar on every page) · centered card, header strip with logo · "Username / Email" + "Password" · dark Login button. Show error message from API under the form. On success → `admin/rooms.html`.
3. **Search** `search.html` — filter bar: Room type · Floor number · Room condition (min rating) · Min price · Max price · Bedrooms · "Available only" chip · "Clear all filters" · green "Search Room" button. Filters are also read from/written to the URL query string. Results = card grid (image, ♡ icon, Room Number, Owner name, Price per month, "N bedroom · size m²"). Pagination. Empty state message. Card click → room.html?id=L-1201.
4. **Detail** `room.html?id=` — image gallery from `images` (1 big + 3 small, grey placeholder when missing or broken) + small "Photo source" credit line · title "Room L-1201" + building · fact row: bedrooms · size m² · Floor · Room type · condition box "สภาพห้อง 3.0★ <label>" (1 แย่ / 2 พอใช้ / 3 สภาพดี / 4 ดีมาก / 5 ใหม่มาก) · owner card (name, phone, email, LINE ID) · "About this room" · Appliances list with icons · right sticky box: MONTHLY RENT ฿15,000 / month · badge Available now / Occupied · Minimum lease N months · bottom: 3 similar rooms. 404 → friendly "Room not found".
6. **Room management** `admin/rooms.html` — left "Search Room" card (Room ID, Room Type, Status, Search button) · right table: Room image thumb · Room ID · Type badge · Price/Month · Status badge (Available green / Occupied grey) · Actions ✎ edit, 🗑 delete (confirm dialog) · "Showing 1-6 of N rooms" + pagination. Below: tabs **Add New Room / Edit Room** form: Room details (Room ID `L-xxxx`, Building, Floor, Room Type, Size, Monthly Rent, Status, Bedrooms, Min lease, Condition rating 1–5) · Appliances: 10 checkboxes, each with a serial-number input (required when ticked) · Room owner details (name, phone `000-000-0000`, email, LINE ID) · Room Description textarea · Room Images upload (edit mode: list with remove buttons; add mode: upload after the room is created) · Cancel / Save Room.
7. **Account management** `admin/accounts.html` (SuperAdmin only; others see "No permission") — "ADMINISTRATION" eyebrow · "User account management" · "+ Add administrator" · filters: Username/name, Role, Email (3 criteria, any combination) · table: Username · Display name · Role · Email · Edit / Reset password / Delete (red). Add/Edit panel "Add administrator": Username*, First name*, Last name*, Email + Confirm email, Address, Role* (Admin / SuperAdmin), Password* + Confirm password (add only) · "Reset password" · Cancel / Save changes.
8. **Team** `team.html` — "The People Behind the Work" · 5 rounded cards: photo, name, role, short bio, social links. Data lives in a JS array at the top of `js/pages/team.js` (placeholder members — group will replace).

## Visual tokens (match wireframe)
- Font: Inter (Google Fonts) · text #111827 · muted #6b7280 · bg #f8fafc · card #fff, border #e5e7eb, radius 8px
- Primary blue #2563eb (View rooms / Book Now) · admin green #2f5d50 (Search Room / Save / Add admin) · danger #dc2626 · navy footer #13233f
- Container max-width 1200px, 16px side gutter on mobile; cards grid 3 col → 2 → 1

## Coding rules (PM will review against these)

Target reader: **a year-1 student** who knows basic JavaScript, HTML forms and SQL. If a line needs a JavaScript trick to understand, rewrite it plainly.

1. **Simple JavaScript**: `const`/`let`, `if`, `for...of`, `async/await`, template strings, plain functions.
   Avoid: `reduce`, chained `.map().filter()` longer than one step, optional chaining `?.`, `??`, clever destructuring/spread tricks,
   functions that return functions, classes. Small helper functions are fine; one function = one job, ≤ ~40 lines.
2. **Back end route shape** (every route the same, so students learn one pattern):
   comment block → `router.METHOD(path, middleware, async (req, res, next) => { try { 1. read+check input  2. SQL  3. res.json } catch (err) { next(err) } })`.
   SQL lives in the route, always `pool.execute(sql, [values])` with `?` placeholders — never string-concatenate user input.
   Validation = plain `if` statements that fill an `errors` object; if it is not empty → `res.status(400).json({ error: { message, fields: errors } })`.
3. **Comments (graded)**: every file starts with a comment saying what it is for. Every route has a comment block:
   what it does, who may call it, and **at least 2 Postman examples** (method, URL, body) — the assignment requires this:
   ```
   // ---------------------------------------------------------------
   // POST /api/rooms  — เพิ่มห้องใหม่ (ต้องล็อกอิน)
   // Postman ตัวอย่างที่ 1 (สำเร็จ → 201)
   //   method: POST   URL: http://localhost:3000/api/rooms
   //   body (raw JSON): { "roomId": "L-1999", ... }
   // Postman ตัวอย่างที่ 2 (ข้อมูลผิด → 400)
   //   ...
   // ---------------------------------------------------------------
   ```
   Explanation comments are written **in Thai** (short, plain). Code names stay in English.
   Front end: same — a comment at the top of each file and above each function explaining what it does.
4. **Front end**: plain `<script src>` tags (no `import`/modules), loaded in this order: `api.js`, `common.js`, page script.
   Build HTML with template strings + `innerHTML`, and wrap **every** value that comes from the API or the user in `escapeHtml()`.
   `api.js` is the only file that calls `fetch`.
5. **Assignment CSS rules**: external CSS on every page; use at least one element selector, one class selector **and one ID selector** (e.g. `#site-header`).
   Every page uses semantic elements (`header`, `nav`, `main`, `section`/`article`, `footer`) and has the nav bar.
6. **Security** stays: bcrypt (cost 10) passwords, session cookie `httpOnly` + `sameSite: 'lax'`, uploads checked by file content, 500 errors never leak SQL/stack.
7. **No secrets in repo**: `.env` gitignored, `.env.example` committed.
