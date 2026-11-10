# วิธีเข้าร่วมพัฒนา CONDONG condo

คู่มือสำหรับสมาชิกในกลุ่ม: ลงโปรแกรม → รันเว็บในเครื่อง → แก้โค้ดแล้วส่งขึ้น GitHub

## 1–2. ติดตั้งและรันโปรเจกต์

ทำตามขั้นตอนใน [README.md](README.md) เพื่อติดตั้ง MySQL และเปิด Front-end กับ Web Service แยกกัน

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
| `fix/` | แก้บั๊ก | `fix/search-price` |
| `docs/` | แก้เอกสาร | `docs/report-diagram` |

### แก้เสร็จแล้ว

```bash
cd sec2_gr1_ws_src
npm test                      # ต้องผ่านทั้งหมดก่อนส่ง (ต้องมี MySQL ในเครื่อง)
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
- commit `node_modules/` (`.gitignore` กันไว้แล้ว)

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
| ปิดเว็บแล้วข้อมูลที่แก้หาย | กำลังใช้ MySQL ชั่วคราว (ตอนเปิดจะขึ้นข้อความ `Temporary MySQL ready`) | ปกติของโหมดนี้ ถ้าอยากให้ข้อมูลอยู่ต้องลง MySQL |
| `npm start` ครั้งแรกค้างนาน | กำลังโหลด MySQL | รอ และเช็กว่าเน็ตต่ออยู่ |
| `npm test` ขึ้น `ECONNREFUSED` หรือ `Access denied` | เทสต์ต้องใช้ MySQL ในเครื่อง | ลง/เปิด MySQL แล้วใส่รหัสใน `backend/.env` |
| `EADDRINUSE :3000` | มีเว็บรันค้างอยู่แล้ว | ปิดหน้าต่างเก่า หรือเปลี่ยน `PORT` ใน `.env` |
| `npm warn install-scripts ... bcrypt` | npm ข้ามสคริปต์ของ bcrypt | ไม่ต้องทำอะไร bcrypt ใช้ได้ปกติ |
