# API Contract — AURA Sukhumvit 36

**This file is the contract between front end and back end. Neither side may change field names without updating this file.**
The database follows the group's Data Dictionary (report section 3.2): `AdminAccount`, `RoomUnit`, `Log`, `Appliance`,
plus what the wireframe needs: `RoomUnit.Floor`, `RoomUnit.ConditionRating` and table `RoomImage` — see `db/schema.sql`.

- Base URL: same origin, prefix `/api` (Express serves the front end from `frontend/public` too → no CORS)
- Body: JSON (`Content-Type: application/json`) except image upload (multipart)
- Auth: cookie session (`express-session`). Front end calls `fetch(url, { credentials: 'same-origin' })`
- JSON field names are **camelCase** (back end maps from DB column names)

## Response format (every endpoint)

Success: `{ "data": <payload> }` (list endpoints add `"meta": { "page", "pageSize", "total" }`)
Error:   `{ "error": { "message": "human readable", "fields": { "price": "must be 0 - 999999.99" } } }` (`fields` optional)

| Status | When |
|---|---|
| 200 / 201 | ok / created |
| 400 | validation failed (`fields` filled) |
| 401 | not logged in |
| 403 | logged in but role not allowed |
| 404 | not found |
| 409 | duplicate key (RoomID / Username / Email / serial number already exists) |
| 500 | unexpected (never leak SQL/stack to client) |

## Objects

### Room  (table `RoomUnit` + `Appliance`)
```json
{
  "roomId": "L-1201", "building": "Building A", "floor": 12,
  "roomType": "Deluxe room", "bedrooms": 1, "size": 34.0, "price": 15000,
  "description": "A bright, fully furnished...", "conditionRating": 3,
  "minimumLease": 12, "available": true,
  "appliances": [{ "serialNumber": "SF-1201-01", "name": "Sofa" }],
  "images": [{ "imageId": 7, "url": "/uploads/L-1201-a1b2c3.jpg" }],
  "owner": { "name": "...", "phone": "080-123-1234", "email": "...", "lineId": "..." }
}
```
| JSON | Column | Rule (from the Data Dictionary) |
|---|---|---|
| `roomId` | RoomID | required, format `L-` + 4 digits (`^L-\d{4}$`), e.g. `L-0203`, `L-1201` |
| `building` | Building | required, ≤ 100 chars |
| `floor` | Floor *(added for wireframe)* | required, integer 1–99 |
| `conditionRating` | ConditionRating *(added for wireframe)* | required, integer 1–5 (1 แย่, 2 พอใช้, 3 สภาพดี, 4 ดีมาก, 5 ใหม่มาก) |
| `roomType` | RoomType | required, one of `Studio`, `1 Bedroom`, `2 Bedroom`, `Deluxe room` |
| `bedrooms` | NumberOfBedroom | required, integer 0–10 |
| `size` | RoomSize | optional (`null`), number 1.00–500.00 |
| `price` | Price | required, number 0.00–999999.99 |
| `description` | RoomConditions | optional, ≤ 5000 chars |
| `minimumLease` | MinimumLeases | optional (`null`), integer 1–36 (months) |
| `available` | Availability | required, boolean |
| `owner.name` | OwnerName | required, ≤ 150 chars |
| `owner.phone` | OwnerPhoneNumber | required, format `000-000-0000` (`^\d{3}-\d{3}-\d{4}$`) |
| `owner.email` | OwnerEmail | optional, valid email, ≤ 100 chars |
| `owner.lineId` | OwnerLineID | optional, ≤ 50 chars |
| `appliances[].serialNumber` | Appliance.Serial_number | required, ≤ 50 chars, unique within the room |
| `appliances[].name` | Appliance.Name_appliance | required, ≤ 100 chars |

- `appliances` is ordered by name then serial number; `[]` when none. The admin form offers these names:
  `Sofa, Water heater, Fridge, TV, HomePhone, Air conditioner, Heater, Washing machine, Microwave, Induction stove`.
- `images` (table `RoomImage`, added for wireframe) is read-only in the room body; ordered by SortOrder then imageId; `[]` when none. `url` is relative to the web service.
- Public endpoints return `owner` too (detail page shows owner contact).
- Validation error keys for nested fields use dot notation: `owner.phone`, `appliances.0.serialNumber`.
- Optional text fields may be sent as `null` or `""` — both mean empty (stored as NULL).

### Admin  (table `AdminAccount`)
```json
{ "username": "admin_main", "firstName": "Somchai", "lastName": "Jaidee",
  "displayName": "Somchai Jaidee", "address": null, "role": "SuperAdmin",
  "email": "admin@aura36.co.th", "status": "Active" }
```
| JSON | Column | Rule |
|---|---|---|
| `username` | Username | required on create, 3–50 chars, letters/digits/underscore/dot; cannot be changed |
| `password` | Password | create: required ≥ 8 chars; update: optional (blank = keep). Stored as bcrypt hash, **never returned** |
| `firstName` / `lastName` | Fname / Lname | required, ≤ 100 chars |
| `address` | Address | optional, ≤ 255 chars |
| `role` | Role | required, `Admin` or `SuperAdmin` |
| `email` | Email | optional, valid email, ≤ 100 chars, unique |
| `status` | Status | optional, `Active` or `Inactive`. Create: blank = `Active`. Update: blank = keep. Added for the Figma design |

- `displayName` = `firstName + " " + lastName`, computed by the back end (read-only).
- `Admin` can manage rooms. `SuperAdmin` can also manage admin accounts and read logs.
- An `Inactive` admin cannot log in (403) and an existing session stops working (401). You cannot set yourself `Inactive` (400).

### Log  (table `Log`)
```json
{ "logId": "L-12", "username": "admin_main", "changed": "UPDATE RoomUnit L-1201: price 15000 -> 16000",
  "dateTime": "2026-10-20T10:00:00.000Z" }
```
- `LogID` is assigned by the back end: `L-` + (largest existing number + 1), inside the same transaction as the change.

## Endpoints

### Auth
| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/api/auth/login` | – | `{ username, password }` (username OR the admin's email) | `{ data: Admin }`, 401 on wrong creds |
| POST | `/api/auth/logout` | – | – | `{ data: { ok: true } }` |
| GET | `/api/auth/me` | – | – | `{ data: Admin }` or 401 |

### Rooms (public read)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/rooms` | Query (all optional): `type` (roomType), `minPrice`, `maxPrice`, `bedrooms`, `available` (`true`/`false`), `floor`, `minCondition` (1–5, conditionRating ≥), `q` (matches roomId or owner name), `page` (default 1), `pageSize` (default 12, max 50), `sort` (`price_asc`, `price_desc`; default `roomId`). Returns `Room[]` + `meta`. 400 on bad values |
| GET | `/api/rooms/:id` | `Room`, 404 if not found (400 if `:id` is not `L-` + 4 digits) |
| GET | `/api/rooms/:id/similar` | up to 3 rooms, same `roomType`, excluding itself, available first, closest price |
| GET | `/api/stats` | `{ totalRooms, roomTypes, availableRooms }` for the home page |

### Rooms (login: Admin or SuperAdmin)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/rooms` | body = Room (without `images`) → 201 `Room`. 409 if `roomId` exists |
| PUT | `/api/rooms/:id` | full update (same body; `roomId` in body ignored; appliances replaced) → `Room` |
| DELETE | `/api/rooms/:id` | → `{ data: { ok: true } }` (its appliances, image rows and image files are deleted too) |
| POST | `/api/rooms/:id/images` | multipart field `images` (max 5 files, jpg/png/webp, ≤ 2 MB each; file content checked, not only the name) → `Room` |
| DELETE | `/api/rooms/:id/images/:imageId` | → `Room` (file deleted too) |

### Admin accounts (SuperAdmin only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admins` | Query (all optional, combine any): `q` (username or first/last name contains), `role` (`Admin`/`SuperAdmin`), `email` (contains), `status` (`Active`/`Inactive`). No query = all admins. Returns `Admin[]` |
| GET | `/api/admins/:username` | `Admin` |
| POST | `/api/admins` | `{ username, password, firstName, lastName, address?, role, email? }` → 201. 409 on duplicate username/email |
| PUT | `/api/admins/:username` | same body minus `username`; `password` optional (blank = keep) → `Admin`. Cannot change your own role (400) |
| DELETE | `/api/admins/:username` | cannot delete yourself (400). The admin's Log rows are deleted with it (FK `ON DELETE CASCADE`) |
| POST | `/api/admins/:username/reset-password` | `{ password }` |

### Logs (SuperAdmin only)
| GET | `/api/logs` | latest 100, newest first |

Every create/update/delete of a room or an admin, plus each successful login, writes one `Log` row, e.g.
`"UPDATE RoomUnit L-1201: price 15000 -> 16000"`.
