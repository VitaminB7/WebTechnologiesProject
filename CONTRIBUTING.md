# วิธีเข้าร่วมพัฒนา AURA Sukhumvit 36

คู่มือสำหรับสมาชิกในกลุ่ม: ลงโปรแกรม → รันเว็บในเครื่อง → แก้โค้ดแล้วส่งขึ้น GitHub

## 1. ลงโปรแกรม (ครั้งเดียว)

| โปรแกรม | โหลดที่ | หมายเหตุ |
|---|---|---|
| Node.js 20 ขึ้นไป | https://nodejs.org (เลือก LTS) | ลงตามค่าเริ่มต้น |
| MySQL 8.x | https://dev.mysql.com/downloads/installer/ | ตอนติดตั้งจะให้ตั้งรหัส root **จดไว้** |
| Git | https://git-scm.com | ลงตามค่าเริ่มต้น |

โปรเจกต์ทดสอบกับ MySQL 8 เท่านั้น ยังไม่ได้ทดสอบกับ XAMPP (MariaDB)

## 2. รันเว็บในเครื่อง

### ครั้งแรก

```bash
git clone https://github.com/VitaminB7/WebTechnologiesProject.git
cd WebTechnologiesProject/backend
npm install
copy .env.example .env        # Git Bash / macOS / Linux: cp .env.example .env
```

เปิดไฟล์ `backend/.env` แล้วใส่รหัส root ของ MySQL ที่บรรทัด `DB_PASSWORD=` จากนั้น

```bash
npm run db:reset              # สร้างฐานข้อมูล + ข้อมูลตัวอย่าง
npm start
```

เปิด http://localhost:3000 แล้วล็อกอินด้วย `admin_main` / `Admin@1234`
(บัญชีทดสอบทั้งหมดอยู่ใน [README.md](README.md#test-logins))

### ครั้งต่อไป

```bash
cd backend
npm start                     # ปิดเว็บด้วย Ctrl + C
```

`npm run db:reset` ใช้เมื่ออยากล้างข้อมูลกลับเป็นข้อมูลตัวอย่าง (ห้องที่แก้และการจองที่เพิ่มจะหายหมด)

## 3. แก้โค้ดแล้วส่งขึ้น GitHub

ก่อนเริ่ม: เจ้าของ repo ต้องเพิ่มคุณเป็น collaborator ก่อน (Settings → Collaborators) ไม่งั้น push ไม่ได้

### ทุกครั้งที่จะเริ่มงานใหม่

```bash
git checkout main
git pull                      # เอาของล่าสุดของเพื่อนมาก่อน
git checkout -b feature/team-page
```

ตั้งชื่อ branch ตามงาน:

| ขึ้นต้นด้วย | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| `feature/` | เพิ่มของใหม่ | `feature/team-page` |
| `fix/` | แก้บั๊ก | `fix/booking-date` |
| `docs/` | แก้เอกสาร | `docs/report-diagram` |

### แก้เสร็จแล้ว

```bash
cd backend
npm test                      # ต้องผ่านทั้งหมดก่อนส่ง
git add .
git commit -m "feat(frontend): add real team members"
git push -u origin feature/team-page
```

แล้วเข้าหน้า repo บน GitHub กด **Compare & pull request** ให้อีกคนในกลุ่มดูก่อน แล้วค่อยกด Merge เข้า `main`

### รูปแบบข้อความ commit

`ประเภท(ส่วนที่แก้): แก้อะไร` เขียนเป็นภาษาอังกฤษสั้นๆ

| ประเภท | ใช้เมื่อ |
|---|---|
| `feat` | เพิ่มความสามารถใหม่ |
| `fix` | แก้บั๊ก |
| `docs` | แก้เอกสาร |
| `test` | เพิ่มหรือแก้เทสต์ |
| `refactor` | จัดโค้ดใหม่ ผลลัพธ์เหมือนเดิม |
| `chore` | งานจุกจิก เช่น ตั้งค่า, อัปเดต package |

ส่วนที่แก้: `frontend`, `backend`, `db`, `docs`

### ห้าม

- push ตรงเข้า `main`
- commit ไฟล์ `backend/.env` (มีรหัสผ่าน MySQL ของเครื่องคุณ)
- commit `node_modules/` หรือรูปใน `backend/uploads/` (`.gitignore` กันไว้แล้ว)

## 4. ก่อนแก้โค้ด อ่านอะไร

| ไฟล์ | มีอะไร |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | หน้าเว็บทั้ง 8 หน้า, สี/ฟอนต์, กติกาการเขียนโค้ด |
| [docs/API.md](docs/API.md) | API ทุกเส้น (front end กับ back end ต้องตรงกับไฟล์นี้) |
| [docs/REVIEW.md](docs/REVIEW.md) | ผลตรวจโค้ด + เรื่องที่กลุ่มยังต้องตัดสินใจ |

ถ้าแก้ API ให้แก้ `docs/API.md` ใน pull request เดียวกันด้วย

## 5. ปัญหาที่เจอบ่อย

| ข้อความ | สาเหตุ | แก้ |
|---|---|---|
| `Access denied for user 'root'` | รหัสใน `.env` ไม่ตรงกับ MySQL | แก้ `DB_PASSWORD` ใน `backend/.env` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL ยังไม่เปิด | เปิด MySQL (Services → MySQL80 → Start) |
| `EADDRINUSE :3000` | มีเว็บรันค้างอยู่แล้ว | ปิดหน้าต่างเก่า หรือเปลี่ยน `PORT` ใน `.env` |
| `npm warn install-scripts ... bcrypt` | npm ข้ามสคริปต์ของ bcrypt | ไม่ต้องทำอะไร bcrypt ใช้ได้ปกติ |
