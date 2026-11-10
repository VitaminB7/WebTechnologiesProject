// transaction.js — runInTransaction(): ทำงานหลายคำสั่ง SQL แบบ "สำเร็จทั้งหมด หรือ ไม่เกิดอะไรเลย"
// วิธีใช้:
//   await runInTransaction(async (connection) => {
//     await connection.execute('INSERT ...', [...]);
//     await writeLog(connection, username, 'CREATE ...');
//   });
// ถ้าคำสั่งไหนพัง (throw) ทุกอย่างจะถูกยกเลิก (rollback) และ error ถูกส่งต่อออกไป
const pool = require('../db');

// บางครั้ง MySQL เจอ 2 transaction แย่งล็อกกัน (deadlock) แล้วยกเลิกตัวหนึ่ง
// ตัวที่โดนยกเลิกถูก rollback หมดแล้ว จึงลองใหม่ได้อย่างปลอดภัย (สูงสุด 3 รอบ)
const MAX_TRIES = 3;

// ทำ 1 รอบ: begin -> work -> commit (ถ้าพังก็ rollback)
async function runOnce(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release(); // คืน connection ให้ pool เสมอ
  }
}

async function runInTransaction(work) {
  let tryNumber = 1;
  while (true) {
    try {
      return await runOnce(work);
    } catch (err) {
      const isDeadlock = err.code === 'ER_LOCK_DEADLOCK';
      if (!isDeadlock || tryNumber >= MAX_TRIES) {
        throw err;
      }
      tryNumber = tryNumber + 1;
    }
  }
}

module.exports = { runInTransaction };
