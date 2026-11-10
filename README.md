# CONDONG condo — ITDS242 Project Phase 2

ระบบค้นหาห้องเช่าและจัดการข้อมูลห้องกับบัญชีแอดมิน

| รายการ | หน้าที่ |
|---|---|
| `sec2_gr1_fe_src/` | Front-end server ที่ `http://localhost:8080` |
| `sec2_gr1_ws_src/` | Express Web Service ที่ `http://localhost:3000/api` |
| `sec2_gr1_database.sql` | โครงสร้าง MySQL และข้อมูลสาธิต |
| `sec2_gr1_postman_collection.json` | ชุดทดสอบเว็บเซอร์วิส |

## ติดตั้ง

1. ติดตั้ง Node.js 20 ขึ้นไปและ MySQL 8.x เปิด MySQL แล้วรัน `sec2_gr1_database.sql` ทั้งไฟล์ใน MySQL Workbench สำหรับการติดตั้งใหม่ ไฟล์จะสร้าง `aura_rental` และนำเข้าข้อมูลสาธิต
2. เปิดเทอร์มินัลใน `sec2_gr1_ws_src` คัดลอก `.env.example` เป็น `.env` ตั้ง `DB_USER`, `DB_PASSWORD` และ `SESSION_SECRET` แล้วรัน `npm ci` และ `npm start`
3. เปิดอีกเทอร์มินัลใน `sec2_gr1_fe_src` รัน `npm ci` และ `npm start`
4. เปิด [หน้าเว็บ](http://localhost:8080/) หรือ [API รายการห้อง](http://localhost:3000/api/rooms)

ถ้าเปลี่ยนพอร์ต ให้ตั้ง `FRONTEND_PORT` และ `API_ORIGIN` ตอนรัน Front-end แล้วปรับ `PORT` และ `FRONTEND_ORIGIN` ใน `.env` ของ Web Service ให้ตรงกัน ใช้ชื่อโฮสต์เดียวกัน เช่น `localhost` ทั้งคู่ เพื่อให้ session cookie ทำงาน

## บัญชีทดสอบ

| Username | Password | สิทธิ์ |
|---|---|---|
| `admin_main` | `Admin@1234` | SuperAdmin จัดการห้อง บัญชี และดู Activity log |
| `listing_ploy` | `Listing@1234` | Admin จัดการห้อง |
| `ops_niran` | `Ops@12345` | Admin จัดการห้อง |

## อ่านโค้ดและทดสอบ

- เริ่มจาก `sec2_gr1_fe_src/public/js/api.js` (Fetch) → `sec2_gr1_ws_src/src/app.js` (CORS, session, router) → `src/routes/` (ตรวจข้อมูล, SQL, JSON) ดูรายละเอียดใน [API contract](docs/API.md)
- หน้ารายละเอียดห้องใช้ [Frankfurter](https://frankfurter.dev/javascript/) แสดงค่าเช่า USD โดยประมาณ ราคาหลักแสดงเป็นบาทเสมอ
- รัน `npm test` ใน `sec2_gr1_ws_src` โดยใช้บัญชี MySQL ที่มีสิทธิ์สร้างและลบฐานทดสอบ `aura_rental_test`
- นำเข้า Postman Collection และรันตามลำดับด้วยฐานข้อมูลสาธิต เริ่มที่ Login เพื่อเก็บ session cookie เลือก PNG/JPEG/WebP ขนาดไม่เกิน 2 MB ในช่อง `images` ก่อนทดสอบอัปโหลด
- ใช้ผลทดสอบจริงและ HTTP status ประกอบรายงาน ดู [งานที่กลุ่มต้องเติม](TODO.md)

## ใช้ฐานข้อมูลเดิม

ถ้า `AdminAccount` ยังไม่มี `Status` ให้รัน SQL นี้เพื่อเก็บข้อมูลเดิมไว้

```sql
ALTER TABLE aura_rental.AdminAccount
  ADD COLUMN Status VARCHAR(10) NOT NULL DEFAULT 'Active',
  ADD CONSTRAINT chk_admin_account_status CHECK (Status IN ('Active', 'Inactive'));
```

คำสั่ง `npm run db:reset` ในโฟลเดอร์ Web Service จะ **ลบและสร้างฐานข้อมูลใน DB_NAME ใหม่** ใช้เมื่อต้องการกลับไปที่ข้อมูลสาธิต
