# SPEC — AURA Sukhumvit 36 (Room Rental Management System)

ITDS241 Web Technologies — Phase 2 implementation of the Phase 1 wireframes (Figma board).
Stack: **Node.js (Express) + MySQL 8.4**, front end = plain HTML/CSS/JavaScript (no framework, no build step).

## Folder structure (fixed — do not invent other top-level folders)

```
aura-rental/
├── README.md                 how to install / run / test
├── docs/SPEC.md  docs/API.md the contract (API.md wins on field names)
├── db/schema.sql             PM owns. Tables + constraints
├── db/seed.sql               BE writes. Sample data
├── backend/
│   ├── package.json          scripts: start, dev, test, db:reset
│   ├── .env.example          DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, SESSION_SECRET, PORT=3000
│   ├── src/
│   │   ├── server.js         only: load env, app.listen
│   │   ├── app.js            build express app (exported, used by tests)
│   │   ├── config/db.js      mysql2/promise pool
│   │   ├── routes/           one file per resource; only maps URL → controller + middleware
│   │   ├── controllers/      read req, call service, send res. No SQL here
│   │   ├── services/         business logic + SQL (parameterised queries only)
│   │   ├── validators/       pure functions: body → { value, errors }
│   │   ├── middleware/       requireAuth, requireRole, requireRoomId, errorHandler
│   │   └── utils/            mappers (DB row → camelCase), HttpError, logAction
│   └── tests/                node:test + supertest against a test DB
└── frontend/public/          served statically by Express at /
    ├── index.html            Home
    ├── login.html
    ├── search.html
    ├── room.html             Detail template (?id=L-1201)
    ├── team.html
    ├── admin/rooms.html      Product/Service management (CRUD)
    ├── admin/accounts.html   User account management (CRUD)
    ├── css/base.css          tokens + layout + components shared by all pages
    ├── css/admin.css
    ├── js/api.js             THE ONLY file that calls fetch(). Exposes functions per endpoint
    ├── js/ui.js              shared helpers: header/footer render, toast, formatPrice, query params
    ├── js/auth-guard.js      admin pages: GET /api/auth/me, redirect to /login.html if 401
    └── js/pages/<page>.js    one script per page
```

## Pages (from Figma wireframes)

Common public header: logo "N" + **AURA SUKHUMVIT 36** / "One residence. Better renting." · nav Home / Search / Team (active underline) · Login button on the right (shows "Admin" + Logout when logged in).
Admin header: "ADMIN PAGE" · nav Product management / User management · Logout. Admin footer: dark navy, "AURA CONDO".

1. **Home** `index.html` — eyebrow "ONE CONDO. SELECTED WITH CARE." · H1 "Your next room at AURA Sukhumvit 36." · paragraph · blue button "View Available Rooms" → search.html · checks: One trusted property / Clear monthly rent / Viewing support · 3 stat cards from `/api/stats` (Rental rooms, Room layouts, 24/7 Building security) · right: image placeholder + "ABOUT THE RESIDENCE" text.
2. **Login** `login.html` — centered card, header strip with logo · "Username / Email" + "Password" · dark Login button. Show error message from API under the form. On success → `admin/rooms.html`.
3. **Search** `search.html` — filter bar: Room type · Min price · Max price · Bedrooms · "Available only" chip · "Clear all filters" · green "Search Room" button. Filters are also read from/written to the URL query string. Results = card grid (image, ♡ icon, Room Number, Owner name, Price per month, "N bedroom · size m²"). Pagination. Empty state message. Card click → room.html?id=L-1201. Floor and room-condition filters from the wireframe are **not** built: the Data Dictionary has no such columns.
4. **Detail** `room.html?id=` — image gallery (1 big + 3 small, always grey placeholders: no image table) · title "Room L-1201" + building · fact row: bedrooms · size m² · Room type (no Floor / condition box: not in the Data Dictionary) · owner card (name, phone, email, LINE ID) · "About this room" · Appliances list with icons · right sticky box: MONTHLY RENT ฿15,000 / month · badge Available now / Occupied · Minimum lease N months · bottom: 3 similar rooms. 404 → friendly "Room not found".
6. **Room management** `admin/rooms.html` — left "Search Room" card (Room ID, Room Type, Status, Search button) · right table: Room ID · Type badge · Price/Month · Status badge (Available green / Occupied grey) · Actions ✎ edit, 🗑 delete (confirm dialog) · "Showing 1-6 of N rooms" + pagination. Below: tabs **Add New Room / Edit Room** form: Room details (Room ID `L-xxxx`, Building, Room Type, Size, Monthly Rent, Status, Bedrooms, Min lease) · Appliances: 10 checkboxes, each with a serial-number input (required when ticked) · Room owner details (name, phone `000-000-0000`, email, LINE ID) · Room Description textarea · Cancel / Save Room. No image upload (no image table).
7. **Account management** `admin/accounts.html` (SuperAdmin only; others see "No permission") — "ADMINISTRATION" eyebrow · "User account management" · "+ Add administrator" · filters: search box, Role · table: Username · Display name · Role · Email · Edit / Reset password / Delete (red). Add/Edit panel "Add administrator": Username*, First name*, Last name*, Email + Confirm email, Address, Role* (Admin / SuperAdmin), Password* + Confirm password (add only) · "Reset password" · Cancel / Save changes.
8. **Team** `team.html` — "The People Behind the Work" · 5 rounded cards: photo, name, role, short bio, social links. Data lives in a JS array at the top of `js/pages/team.js` (placeholder members — group will replace).

## Visual tokens (match wireframe)
- Font: Inter (Google Fonts) · text #111827 · muted #6b7280 · bg #f8fafc · card #fff, border #e5e7eb, radius 8px
- Primary blue #2563eb (View rooms / Book Now) · admin green #2f5d50 (Search Room / Save / Add admin) · danger #dc2626 · navy footer #13233f
- Container max-width 1200px, 16px side gutter on mobile; cards grid 3 col → 2 → 1

## Coding rules (PM will review against these)
1. **Structure**: layers above are strict. Routes no logic, controllers no SQL, services no `req/res`.
2. **Security**: SQL only through `pool.execute(sql, params)` — never string-concatenate user input. Passwords bcrypt (cost 10). Front end inserts user/DB text only via `textContent` or `escapeHtml()` — never raw `innerHTML` with data. Session cookie `httpOnly`, `sameSite: 'lax'`.
3. **Errors**: throw `HttpError(status, message, fields)`; one `errorHandler` turns it into the API.md error shape. 500s log the stack to console, send generic message.
4. **Naming**: camelCase JS, PascalCase DB columns, kebab-case file names for HTML/CSS, `<resource>.routes.js / .controller.js / .service.js / .validator.js`.
5. **Readable**: small functions (≤ ~40 lines), no dead code, no commented-out code, comments only where the *why* is not obvious. No external UI frameworks.
6. **No secrets in repo**: `.env` gitignored, `.env.example` committed.
