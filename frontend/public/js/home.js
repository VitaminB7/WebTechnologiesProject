// home.js — สคริปต์หน้าแรก: ใส่ตัวเลขสรุป (จำนวนห้อง, แบบห้อง, ห้องว่าง) จาก /api/stats

// TODO(ยังขาด): ยังไม่ได้เชื่อม "เว็บเซอร์วิสสาธารณะ" (rubric เว็บเซอร์วิสข้อ 11 = 2 คะแนน)
//   ตัวเลือก: แผนที่ตึก (OpenStreetMap), อัตราแลกเปลี่ยนสำหรับผู้เช่าต่างชาติ, หรือสภาพอากาศกรุงเทพ
//   เรียกผ่านฟังก์ชันใหม่ใน api.js (api.js เป็นไฟล์เดียวที่เรียก fetch)

// โหลดตัวเลขสรุปแล้วใส่ลงการ์ด
async function loadStats() {
  const total = document.getElementById('stat-total-rooms');
  const types = document.getElementById('stat-room-types');
  const available = document.getElementById('stat-available');
  try {
    const stats = await getStats();
    total.textContent = stats.totalRooms;
    types.textContent = stats.roomTypes;
    available.textContent = stats.availableRooms + ' room(s) available right now.';
  } catch (error) {
    total.textContent = '–';
    types.textContent = '–';
    available.textContent = 'Could not load room statistics: ' + error.message;
  }
}

setupPublicHeader(true);
loadStats();
