// log.js — writeLog(): บันทึกประวัติการแก้ไข 1 แถวลงตาราง Log
// ทุกครั้งที่เพิ่ม/แก้/ลบห้องหรือแอดมิน และทุกครั้งที่ล็อกอินสำเร็จ ต้องเรียก writeLog()
// ต้องส่ง connection ของ transaction เข้ามา (จาก runInTransaction) เพื่อให้ Log บันทึกพร้อมกับการแก้ไขจริง
// ถ้าการแก้ไขถูกยกเลิก Log ก็ถูกยกเลิกด้วย

const MAX_LENGTH = 500; // คอลัมน์ Changed ยาวได้ 500 ตัวอักษร

// LogID เป็นข้อความ เช่น "L-12" จึงต้องตัด "L-" ออกแล้วแปลงเป็นตัวเลขก่อนเทียบ (ไม่งั้น L-9 จะมากกว่า L-10)
const LOG_NUMBER_SQL = 'CAST(SUBSTRING(LogID, 3) AS UNSIGNED)';

// หาเลข LogID ถัดไป = เลขที่มากที่สุด + 1
// FOR UPDATE = ล็อกตาราง Log ไว้จนจบ transaction ทำให้ 2 คนที่บันทึกพร้อมกันไม่ได้เลขซ้ำกัน
async function nextLogId(connection) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(${LOG_NUMBER_SQL}), 0) AS maxNumber FROM Log FOR UPDATE`,
  );
  const nextNumber = Number(rows[0].maxNumber) + 1;
  return `L-${nextNumber}`;
}

async function writeLog(connection, username, message) {
  let text = message;
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH - 3) + '...';
  }
  const logId = await nextLogId(connection);
  await connection.execute(
    'INSERT INTO Log (LogID, Username, Changed, DateTime) VALUES (?, ?, ?, UTC_TIMESTAMP())',
    [logId, username, text],
  );
}

// แปลงค่าเป็นข้อความสำหรับ Log: ค่าว่างเขียนเป็น "(empty)"
function valueToText(value) {
  if (value === null || value === undefined || value === '') {
    return '(empty)';
  }
  return String(value);
}

// เทียบข้อมูลก่อน/หลังแก้ แล้วเขียนเป็นข้อความ เช่น "price 15000 -> 16000, floor 12 -> 14"
// before และ after เป็น object แบบชั้นเดียว { ชื่อ: ค่า } ที่มี key เหมือนกัน
function describeChanges(before, after) {
  const parts = [];
  for (const key of Object.keys(after)) {
    const oldText = valueToText(before[key]);
    const newText = valueToText(after[key]);
    if (oldText !== newText) {
      parts.push(`${key} ${oldText} -> ${newText}`);
    }
  }
  if (parts.length === 0) {
    return 'no changes';
  }
  return parts.join(', ');
}

module.exports = { writeLog, describeChanges, LOG_NUMBER_SQL };
