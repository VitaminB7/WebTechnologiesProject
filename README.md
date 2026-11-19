# CONDONG condo — ITDS242 Project Phase 2

ระบบค้นหาห้องเช่าและจัดการข้อมูลห้องกับบัญชีแอดมิน

| รายการ | หน้าที่ |
|---|---|
| `sec2_gr1_fe_src/` | Front-end server ที่ `http://localhost:8080` |
| `sec2_gr1_ws_src/` | Express Web Service ที่ `http://localhost:3000/api` |
| `sec2_gr1_database.sql` | โครงสร้าง MySQL และข้อมูลสาธิต |
| `sec2_gr1_postman_collection.json` | ชุดทดสอบเว็บเซอร์วิส |

## ติดตั้ง

1. ติดตั้ง Node.js 20 ขึ้นไปและ MySQL 8.x เปิด 
2. เปิด MySQL Workbench สำหรับการติดตั้งใหม่ 
3. แล้ว open sql script เลือก `sec2_gr1_database.sql` แล้วรันไฟล์จะสร้าง `condong_condo` 
4. เปลี่ยนชื่อ `.env.example` ใน `sec2_gr1_ws_src` เป็น `.env`
5. เอาข้อมูล user ที่เข้าถึง `condong_condo` ได้ ใส่ใน `.env` ตั้ง `DB_USER`, `DB_PASSWORD` และ `SESSION_SECRET`(เป็นอะไรก็ได้) หรือ `PORT` ถ้าไม่ได้ใช้ default
6. เปิดเทอร์มินัลแล้ว cd ไปที่ `sec2_gr1_ws_src` แล้วรัน `npm install` และ `npm start`
7. เปิดอีกเเทอร์มินัลแล้ว cd ไปที่ `sec2_gr1_fe_src` แล้วรัน `npm install` และ `npm start`
8. เปิด `http://localhost:8080/`

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

คำสั่ง `npm run db:reset` ในโฟลเดอร์ Web Service จะ **ลบและสร้างฐานข้อมูลใน DB_NAME ใหม่** ใช้เมื่อต้องการกลับไปที่ข้อมูลสาธิต