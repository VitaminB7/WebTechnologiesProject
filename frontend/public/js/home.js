// home.js — สคริปต์หน้าแรก: ใส่ตัวเลขสรุป (จำนวนห้อง, แบบห้อง) จาก /api/stats และการ์ดห้องแนะนำ 1 ห้อง

// TODO(ยังขาด): ยังไม่ได้เชื่อม "เว็บเซอร์วิสสาธารณะ" (rubric เว็บเซอร์วิสข้อ 11 = 2 คะแนน)
//   ตัวเลือก: แผนที่ตึก (OpenStreetMap), อัตราแลกเปลี่ยนสำหรับผู้เช่าต่างชาติ, หรือสภาพอากาศกรุงเทพ
//   เรียกผ่านฟังก์ชันใหม่ใน api.js (api.js เป็นไฟล์เดียวที่เรียก fetch)

// โหลดตัวเลขสรุปแล้วใส่ลงการ์ด
async function loadStats() {
  const total = document.getElementById('stat-total-rooms');
  const types = document.getElementById('stat-room-types');
  try {
    const stats = await getStats();
    total.textContent = stats.totalRooms;
    types.textContent = stats.roomTypes;
  } catch (error) {
    total.textContent = '–';
    types.textContent = '–';
    showToast('Could not load room statistics: ' + error.message, 'error');
  }
}

// การ์ดห้องแนะนำ: ห้องว่างห้องแรก (ไม่มีห้องว่างเลย -> ซ่อนการ์ด)
async function loadFeaturedRoom() {
  const container = document.getElementById('featured-room');
  try {
    const answer = await listRooms({ available: 'true', pageSize: 1 });
    if (answer.data.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = roomCard(answer.data[0]);
  } catch (error) {
    showState(container, 'error', error.message, 'Could not load rooms');
  }
}

setupPublicHeader();
loadStats();
loadFeaturedRoom();
