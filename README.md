# CONDONG condo — ITDS242 Project Phase 2

ระบบค้นหาห้องเช่าและจัดการข้อมูลห้องกับบัญชีแอดมิน

| รายการ | หน้าที่ |
|---|---|
| `sec2_gr1_fe_src/` | Front-end server ที่ `http://localhost:8080` |
| `sec2_gr1_ws_src/` | Express Web Service ที่ `http://localhost:3000/api` |
| `sec2_gr1_database.sql` | โครงสร้าง MySQL และข้อมูลสาธิต |
| `sec2_gr1_postman_collection.json` | ชุดทดสอบเว็บเซอร์วิส |

## ติดตั้ง

1. ติดตั้งโปรแกรมที่ต้องใช้ แล้วเปิด MySQL ไว้
   - **Node.js 20 ขึ้นไป** — เช็กด้วย `node -v` ในเทอร์มินัล ต้องขึ้น `v20` หรือสูงกว่า
   - **MySQL 8.x** และ **MySQL Workbench** — MySQL ต้องเปิดทำงานอยู่ (ถ้า Workbench เชื่อมต่อได้ แปลว่าเปิดอยู่)
2. สร้างฐานข้อมูลด้วย MySQL Workbench
   - เชื่อมต่อ MySQL ของเครื่อง แล้วไปที่เมนู **File → Open SQL Script...** เลือก `sec2_gr1_database.sql`
   - กดปุ่ม ⚡ **Execute** (ปุ่มสายฟ้าธรรมดา ไม่ใช่ปุ่มที่มีรูปเคอร์เซอร์) เพื่อรันทั้งไฟล์
   - กด refresh ที่แถบ Schemas ต้องเห็นฐานข้อมูล `condong_condo`
   - ถ้าขึ้น `Table ... already exists` แปลว่าเคยสร้างไว้แล้ว ให้รัน `DROP DATABASE condong_condo;` แล้วรันไฟล์ใหม่ (ข้อมูลเดิมจะหายหมด)
3. เปลี่ยนชื่อ `.env.example` ใน `sec2_gr1_ws_src` เป็น `.env`
4. เปิดไฟล์ `.env` แล้วแก้ 3 บรรทัดนี้ (บรรทัดอื่นไม่ต้องแก้)
   - `DB_USER=` username เดียวกับที่ใช้ login ใน MySQL Workbench (เช่น `root`) — ค่า `test1` ที่ติดมาใช้กับเครื่องคุณไม่ได้
   - `DB_PASSWORD=` รหัสผ่านของ user นั้น
   - `SESSION_SECRET=` พิมพ์ข้อความยาว ๆ อะไรก็ได้
5. เปิดเทอร์มินัลที่โฟลเดอร์โปรเจกต์ แล้วรัน

   ```
   cd sec2_gr1_ws_src
   npm install
   npm start
   ```

   - สำเร็จเมื่อเห็นบรรทัด `CONDONG Web Service: http://localhost:3000/api` (ครั้งแรกจะเห็น `Imported 80 photos` ก่อน = นำเข้ารูปห้องอัตโนมัติ)
   - **เปิดเทอร์มินัลนี้ค้างไว้** ห้ามปิด ไม่งั้นเว็บจะดึงข้อมูลไม่ได้
   - ถ้าขึ้น `Web Service startup failed: ...`
     - `ER_ACCESS_DENIED_ERROR` → `DB_USER` / `DB_PASSWORD` ใน `.env` ผิด (กลับไปข้อ 4)
     - `ER_BAD_DB_ERROR` → ยังไม่ได้สร้างฐานข้อมูล (กลับไปข้อ 2)
     - `ECONNREFUSED` → MySQL ไม่ได้เปิดอยู่
6. เปิดเทอร์มินัล **ใหม่อีกหน้าต่าง** ที่โฟลเดอร์โปรเจกต์ (อย่าใช้หน้าต่างเดิมของข้อ 5) แล้วรัน

   ```
   cd sec2_gr1_fe_src
   npm install
   npm start
   ```

   - สำเร็จเมื่อเห็นบรรทัด `CONDONG Front-end: http://localhost:8080`
   - เปิดเทอร์มินัลนี้ค้างไว้เช่นกัน ตอนนี้ต้องมี 2 หน้าต่างเปิดอยู่พร้อมกัน
7. เปิด `http://localhost:8080/` ในเบราว์เซอร์
   - ต้องเห็นการ์ดห้องพร้อมรูป ถ้าไม่มีห้องหรือรูปขึ้น ให้เช็กว่าเทอร์มินัลของข้อ 5 ยังเปิดอยู่และไม่มี error
   - เข้าหน้าแอดมิน: กดปุ่ม **Login** มุมขวาบน แล้วใช้บัญชีจาก [บัญชีทดสอบ](#บัญชีทดสอบ) ด้านล่าง (เช่น `admin_main` / `Admin@1234`) จะเข้าไปที่หน้าจัดการห้อง

## เปิดใช้งานครั้งถัดไป

ไม่ต้องสร้างฐานข้อมูลหรือแก้ `.env` ใหม่ ทำแค่นี้:

1. เปิด MySQL ไว้
2. เทอร์มินัลที่ 1: `cd sec2_gr1_ws_src` แล้ว `npm start`
3. เทอร์มินัลที่ 2: `cd sec2_gr1_fe_src` แล้ว `npm start`
4. เปิด `http://localhost:8080/`

ปิดเซิร์ฟเวอร์: กด `Ctrl+C` ในแต่ละเทอร์มินัล

หลัง `git pull` ให้รัน `npm install` ในทั้ง 2 โฟลเดอร์ก่อน `npm start` อีกครั้ง เผื่อมีคนเพิ่ม package ใหม่

## บัญชีทดสอบ

| Username | Password | สิทธิ์ |
|---|---|---|
| `admin_main` | `Admin@1234` | SuperAdmin จัดการห้อง บัญชี และดู Activity log |
| `listing_ploy` | `Listing@1234` | Admin จัดการห้อง |
| `ops_niran` | `Ops@12345` | Admin จัดการห้อง |

## อ่านโค้ดและทดสอบ

- เริ่มจาก `sec2_gr1_fe_src/public/js/api.js` (Fetch) → `sec2_gr1_ws_src/src/app.js` (CORS, session, router) → `src/routes/` (ตรวจข้อมูล, SQL, JSON) ดูรายละเอียดใน [API contract](docs/API.md)
- หน้ารายละเอียดห้องใช้ [Frankfurter](https://frankfurter.dev/javascript/) แสดงค่าเช่า USD โดยประมาณ ราคาหลักแสดงเป็นบาทเสมอ
- รัน `npm test` ใน `sec2_gr1_ws_src` โดยใช้บัญชี MySQL ที่มีสิทธิ์สร้างและลบฐานทดสอบ `condong_condo_test`
- นำเข้า Postman Collection และรันตามลำดับด้วยฐานข้อมูลสาธิต เริ่มที่ Login เพื่อเก็บ session cookie เลือก PNG/JPEG/WebP ขนาดไม่เกิน 2 MB ในช่อง `images` ก่อนทดสอบอัปโหลด
- ใช้ผลทดสอบจริงและ HTTP status ประกอบรายงาน ดู [งานที่กลุ่มต้องเติม](TODO.md)

## ใช้ฐานข้อมูลเดิม

เมื่อเปิด Web Service ระบบจะคัดลอกรูปจาก `prototype_rooms` ไปที่ `uploads` และเพิ่ม path ลงตาราง `RoomImage` ให้ตรงกับรหัสห้องโดยอัตโนมัติ โดยข้ามห้องที่มีรูปอยู่แล้ว การเปิดเซิร์ฟเวอร์ซ้ำไม่เพิ่มรูปซ้ำ ไม่ต้องรันคำสั่งนำเข้ารูปแยก และไม่ต้องล้างฐานข้อมูล

คำสั่ง `npm run db:reset` ในโฟลเดอร์ Web Service จะ **ลบและสร้างฐานข้อมูลใน DB_NAME ใหม่** ใช้เมื่อต้องการกลับไปที่ข้อมูลสาธิต


## การใช้รูปภาพหลัง clone หรือ pull

รูปห้องต้นฉบับและรูปทีมอยู่ใน Git แล้ว เว็บเซอร์วิสรองรับรูปห้องต้นฉบับแม้ uploads ว่าง ดูรายละเอียดและข้อแตกต่างของรูปที่อัปโหลดเพิ่มใน [คู่มือรูปภาพ](docs/IMAGES.md)
