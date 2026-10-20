# PM Review — 20 Oct 2026

Scope: backend (BE agent) + frontend (FE agent) against `docs/SPEC.md`, `docs/API.md` and the Figma wireframes.
Final state: **`npm test` 62/62 pass**, API attack run passed, browser walk-through passed.

## 1. Correctness (vs wireframe + contract)

| Check | Result |
|---|---|
| 8 pages exist and match wireframe sections (Home, Login, Search, Detail, Booking, Room mgmt, Account mgmt, Team) | ✅ |
| Search: 6 criteria + "available only", URL keeps filters; `type=Deluxe&minPrice=10000&available=true` → 5 rooms = same as direct SQL count | ✅ |
| Admin edit room → save → API + Log row `UPDATE RoomUnit 203: price 9500 -> 9900` | ✅ |
| Login by username **or** email, inactive account refused (403) | ✅ |
| Contract gap found by FE: `images` had no `imageId` → contract changed to `[{imageId,url}]`, both sides updated | ✅ fixed |

## 2. Bugs / tester (attack run against live server)

| Attack | Expected | Result |
|---|---|---|
| SQL injection in `q`, `sort` | no 500, no effect | ✅ 200 empty / 400 whitelist |
| Path traversal `/../backend/.env`, encoded variants | 404 | ✅ |
| 2 MB JSON body / broken JSON | 413 / 400 | ✅ |
| Admin API without login / listing_admin → `/api/admins` | 401 / 403 | ✅ |
| Super admin demotes or deletes self | 400 | ✅ |
| Stored XSS in owner name / description | shown as text | ✅ (no `innerHTML` anywhere) |
| Booking: past date, 31 Feb, occupied room | 400 | ✅ |
| **Upload a text file declared as image/jpeg** | 400 | ❌ → **fixed** (magic-byte check, test added) |
| Broken image file in gallery | placeholder | ❌ → **fixed** (img onerror → placeholder) |
| Booking phone `+66…` | client = server rule | ❌ mismatch → **fixed** |

## 3. Readability / structure

- (Round 1 layout; replaced in round 3 by the year-1 friendly layout: one route file per topic with SQL inside.) Every `${}` in SQL is a placeholder list or a whitelisted ORDER BY.
- Transactions around room+appliances and admin+emails; files deleted only after commit.
- Frontend: `api.js` is the only `fetch`; one script per page; loading/empty/error states everywhere.
- Fixed in review: dead code removed (`escapeHtml`, `getCurrentAdmin`, legacy `toImage` branch), `UNIQUE(Email)` added to `AdminEmail`, `X-Content-Type-Options: nosniff`.

## Round 2 — database changed to the report's Data Dictionary (20 Oct 2026)

Group decision: follow the Data Dictionary exactly (AdminAccount, RoomUnit, Log, Appliance), drop Booking and RoomImage, RoomID = `L-xxxx`.

| Check | Result |
|---|---|
| schema.sql + seed.sql load; CHECK constraints block bad RoomID / RoomType / Role | ✅ |
| `npm test` (rewritten for the new contract) | ✅ 54/54 |
| 10 logins at the same moment on an empty Log table → all 200, LogIDs L-1…L-11 unique | ✅ after fix: transactions now retry once on a MySQL deadlock |
| Browser: search `Deluxe room` ≥ 15000 → 9 rooms = API count; detail L-1201 has no Floor/condition/Book button | ✅ |
| Browser (Admin): bad Room ID / phone / missing serial blocked with messages; add L-1999 with 2 appliances; edit price; Log rows written | ✅ |
| Browser: Admin does not see "User management" and gets "No permission" on the URL; SuperAdmin adds an admin; confirm email/password mismatch blocked; duplicate email → 409 | ✅ |

Removed because the Data Dictionary has no column for them: floor and room-condition filters/box, room images,
admin status (inactive accounts), booking page. (Floor, condition and images came back in round 3.)

## Round 3 — wireframe features back + code rewritten for year-1 readers (20 Oct 2026)

Group decision: keep what the wireframe needs (Floor, ConditionRating, RoomImage), keep Booking and admin status removed,
and rewrite the code so a year-1 student can read it (see SPEC "Coding rules").

| Check | Result |
|---|---|
| Schema + seed load (Floor, ConditionRating, RoomImage added and marked "added for the wireframe") | ✅ |
| `npm test` | ✅ 64/64 (new: image upload by file content, floor/condition rules + filters, admin search by 3 criteria) |
| Back end: one file per topic, every route = Thai comment + ≥ 2 Postman examples → checks → SQL → JSON | ✅ read by PM |
| Front end: plain `<script>` tags, `api.js` only fetch, every value through `escapeHtml()` | ✅ read by PM |
| Browser: login page has nav; add room L-1998 with floor 19, condition 4, a PNG photo → detail shows Floor 19, "สภาพห้อง 4.0★ ดีมาก", the photo and "Photo source" | ✅ |
| Browser: owner name `<img src=x onerror=...>` and description `<script>` show as text, nothing injected | ✅ |
| Browser: admin search Role=Admin + email "aura36" → only listing_ploy; delete image removes the file (404); delete room; Log L-2…L-5 | ✅ |
| Browser console errors | none |

## Still missing for the assignment (ITDS242 Phase II, due 20 Nov 2569 23:55)

| # | Missing | Rubric | Who |
|---|---|---|---|
| 1 | Front-end server and web-service server are one Express app; the assignment draws two servers | Task 4 / submission | dev |
| 2 | Submission names: `sec2_gr1_fe_src/`, `sec2_gr1_ws_src/`, `sec2_gr1_database.sql` (SQL export with data) | WS 12 (2 pts) | dev |
| 3 | No public web service yet (e.g. OpenStreetMap map, exchange rate, weather) | WS 11 (2 pts) | dev |
| 4 | Team / About Us page still has placeholder members: needs real names, photos and ≥ 1 social link each | Web 7 (2 pts) | group |
| 5 | Seed rooms have no photos (detail page shows grey boxes until photos are uploaded); real photos need a cited source | Web 4 | group |
| 6 | `readme.txt` (rubric says readme.txt, submission says README.md: ship both) | Web 12 | dev |
| 7 | Postman test results for every service (screenshots for the report) — a ready-to-import Postman collection would help | WS 6, Report 4 | group (+ dev) |
| 8 | Report PDF: page map, admin pages, web-service details + code, test results, references, AI disclosure (must tick "เขียนโค้ด" and "แก้ไขและตรวจสอบโค้ด") | Report | group |
| 9 | Data Dictionary in the report must add Floor, ConditionRating and RoomImage so it matches the database | Report 1–2 | group |
| 10 | Brand: report says CONDONG CONDO, website says AURA Sukhumvit 36 — pick one | consistency | group |

## Open — decisions for the group (not bugs)

1. Deleting an admin also deletes that admin's Log rows (Log.Username is NOT NULL in the Data Dictionary).
2. LogID `L-x` uses the same `L-` prefix as RoomID `L-xxxx`.
3. The admin form shows one checkbox per appliance name, so a room cannot have two appliances with the same name.
4. No login rate-limit; sessions in memory (logout on restart) — fine for a course demo.
