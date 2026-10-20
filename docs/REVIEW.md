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

## Open — decisions for the group (not bugs)

1. Same room can receive many *pending* bookings; confirming one does not mark the room occupied.
2. Deleting a room cascades to its bookings — maybe block delete when bookings exist.
3. No login rate-limit; sessions in memory (logout on restart) — fine for a course demo.
4. `IdentityNumber` is stored in plain text — personal data; mention in the report or mask it.
5. `npm run db:reset` does not empty `backend/uploads/`.
6. Team page uses placeholder members — replace with the real group.
