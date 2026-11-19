CONDONG condo — ITDS242 Project Phase 2

ต้องใช้ Node.js 20 ขึ้นไปและ MySQL 8.x
1. เปิด MySQL และรัน sec2_gr1_database.sql ทั้งไฟล์ผ่าน MySQL Workbench
2. เข้า sec2_gr1_ws_src คัดลอก .env.example เป็น .env ตั้ง DB_USER,
   DB_PASSWORD และ SESSION_SECRET แล้วรัน npm ci และ npm start
3. เปิดเทอร์มินัลอีกหน้าต่างใน sec2_gr1_fe_src รัน npm ci และ npm start
4. เปิด http://localhost:8080/ บัญชีทดสอบ admin_main / Admin@1234
   Web Service อยู่ที่ http://localhost:3000/api/rooms
5. ทดสอบด้วย npm test ใน sec2_gr1_ws_src หรือ import Postman Collection
   แล้วรันตามลำดับ เลือกรูปในช่อง images ก่อนส่งคำขออัปโหลด

ดู README.md สำหรับการใช้ฐานข้อมูลเดิม การเปลี่ยนพอร์ต และรายละเอียดการทดสอบ
