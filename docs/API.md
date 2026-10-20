# API Contract — AURA Sukhumvit 36

**This file is the contract between front end and back end. Neither side may change field names without updating this file.**

- Base URL: same origin, prefix `/api` (Express serves the front end from `frontend/public` too → no CORS)
- Body: JSON (`Content-Type: application/json`) except image upload (multipart)
- Auth: cookie session (`express-session`). Front end calls `fetch(url, { credentials: 'same-origin' })`
- JSON field names are **camelCase** (back end maps from DB PascalCase)

## Response format (every endpoint)

Success: `{ "data": <payload> }` (list endpoints add `"meta": { "page", "pageSize", "total" }`)
Error:   `{ "error": { "message": "human readable", "fields": { "price": "must be >= 0" } } }` (`fields` optional)

| Status | When |
|---|---|
| 200 / 201 | ok / created |
| 400 | validation failed (`fields` filled) |
| 401 | not logged in |
| 403 | logged in but role not allowed / account inactive |
| 404 | not found |
| 409 | duplicate key (RoomID / Username already exists) |
| 500 | unexpected (never leak SQL/stack to client) |

## Objects

### Room
```json
{
  "roomId": 1201, "building": "AURA Sukhumvit 36", "floor": 12,
  "roomType": "Deluxe", "bedrooms": 1, "size": 34.0, "price": 15000,
  "description": "A bright, fully furnished...", "conditionRating": 3,
  "minimumLease": 12, "available": true,
  "appliances": ["Sofa", "Fridge"],
  "images": [{ "imageId": 7, "url": "/uploads/1201-a1b2.jpg" }],
  "owner": { "name": "...", "phone": "080-123-1234", "email": "...", "lineId": "..." },
  "updatedAt": "2026-10-20T10:00:00.000Z"
}
```
- `roomType` ∈ `Standard | Deluxe | Suite`
- `appliances` ⊂ `Sofa, Water heater, Fridge, TV, HomePhone, Air conditioner, Heater, Washing machine, Microwave, Induction stove`
- Public endpoints return `owner` too (detail page shows owner contact).
- `images` is ordered by SortOrder then imageId; `[]` when none.
- Validation error keys for nested owner fields use dot notation: `owner.name`, `owner.phone`, `owner.email`, `owner.lineId`.
- Optional text fields may be sent as `null` or `""` — both mean empty (stored as NULL).

### Admin
```json
{ "username": "admin_main", "firstName": "Somchai", "lastName": "Jaidee",
  "displayName": "Somchai J.", "address": null, "role": "super_admin",
  "status": "active", "emails": ["a@x.com"], "updatedAt": "..." }
```
- `displayName` is computed by the back end = `firstName + " " + lastName` (read-only, not stored)
- `role` ∈ `super_admin | listing_admin | operations`; `status` ∈ `active | inactive`
- **Password is never returned.**

### Booking
```json
{ "bookingId": 1, "roomId": 1201, "fullName": "...", "identityNumber": "1103700000000",
  "phone": "0801231234", "email": "...", "moveInDate": "2026-11-01",
  "status": "pending", "createdAt": "..." }
```

## Endpoints

### Auth
| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/api/auth/login` | – | `{ username, password }` (username OR an email in AdminEmail) | `{ data: Admin }` 401 on wrong creds, 403 if inactive |
| POST | `/api/auth/logout` | – | – | `{ data: { ok: true } }` |
| GET | `/api/auth/me` | – | – | `{ data: Admin }` or 401 |

### Rooms (public read)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/rooms` | – | Query (all optional): `type`, `floor`, `minPrice`, `maxPrice`, `bedrooms`, `minCondition`, `available` (`true`/`false`), `q` (matches roomId or owner name), `page` (default 1), `pageSize` (default 12, max 50), `sort` (`price_asc`, `price_desc`, `newest`; default `roomId`). Returns `Room[]` + `meta`. |
| GET | `/api/rooms/:id` | – | `Room`, 404 if not found |
| GET | `/api/rooms/:id/similar` | – | up to 3 rooms, same `roomType`, excluding itself |
| GET | `/api/stats` | – | `{ totalRooms, roomTypes, availableRooms }` for the home page |

### Rooms (admin)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/rooms` | login | body = Room fields (without `images`, `updatedAt`) → 201 `Room`. 409 if `roomId` exists |
| PUT | `/api/rooms/:id` | login | full update (same body; `roomId` in body ignored) → `Room` |
| DELETE | `/api/rooms/:id` | login | → `{ data: { ok: true } }`, also deletes image files |
| POST | `/api/rooms/:id/images` | login | multipart field `images` (max 5 files, jpg/png/webp, ≤ 2 MB each) → `Room` |
| DELETE | `/api/rooms/:id/images/:imageId` | login | → `Room` |

Validation for room body: `roomId` int 1–99999, `floor` int 1–99, `roomType` enum, `bedrooms` int 0–10, `size` > 0, `price` ≥ 0, `conditionRating` int 1–5, `minimumLease` int ≥ 1, `owner.name` required, `owner.email` valid email if present, `appliances` only allowed values.

### Admin accounts (super_admin only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admins` | Query: `q` (username/name), `role`, `status`. Returns `Admin[]` |
| GET | `/api/admins/:username` | `Admin` |
| POST | `/api/admins` | `{ username, password, firstName, lastName, address?, role, status, emails[] }` → 201. password ≥ 8 chars. 409 on duplicate |
| PUT | `/api/admins/:username` | same body minus `username`; `password` optional (blank = keep) → `Admin` |
| DELETE | `/api/admins/:username` | cannot delete yourself (400) |
| POST | `/api/admins/:username/reset-password` | `{ password }` |

### Bookings
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/bookings` | – | `{ roomId, fullName, identityNumber, phone, email, moveInDate }` → 201. 400 if room not available. identityNumber = 13 digits; phone = 9–15 digits after removing spaces/dashes; email valid; moveInDate `YYYY-MM-DD` not before today (server local date, Asia/Bangkok) |
| GET | `/api/bookings` | login | list newest first |
| PATCH | `/api/bookings/:id` | login | `{ status }` |

### Logs
| GET | `/api/logs` | super_admin | latest 100 |

Every create/update/delete of room/admin/booking-status, plus login, writes one `Log` row: e.g. `"UPDATE RoomUnit 1201: price 15000 -> 16000"`.
