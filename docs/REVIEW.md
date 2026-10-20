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

- Backend layers are strict: routes → controllers → services; no SQL outside services, no `req/res` in services. Every `${}` in SQL is a placeholder list or a whitelisted ORDER BY.
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
admin status (inactive accounts), booking page.

## Open — decisions for the group (not bugs)

1. The wireframe still shows Floor, room condition (สภาพห้อง) and room images, but the Data Dictionary has none of them, so the website does not either. Either add them to the Data Dictionary or remove them from the wireframe so the report matches the website.
2. Deleting an admin also deletes that admin's Log rows (Log.Username is NOT NULL, so `ON DELETE SET NULL` is impossible). If the history must be kept, make Log.Username nullable in the Data Dictionary.
3. LogID `L-x` uses the same `L-` prefix as RoomID `L-xxxx`; consider a different prefix (e.g. `G-`) in the Data Dictionary.
4. The admin form shows one checkbox per appliance name, so a room cannot have two appliances with the same name (the database would allow it).
5. No login rate-limit; sessions in memory (logout on restart) — fine for a course demo.
6. Team page uses placeholder members — replace with the real group.
