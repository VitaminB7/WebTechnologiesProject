// team.js — สคริปต์หน้าทีม: วาดการ์ดสมาชิกจากรายการ TEAM_MEMBERS ด้านล่าง (แถวบน 2 ใบ แถวล่าง 3 ใบ ตาม Figma)

// TODO(ยังขาด): หน้า About Us ยังเป็นสมาชิกตัวอย่าง (rubric ข้อ 7 = 2 คะแนน)
//   ต้องใส่สมาชิกจริงครบ 5 คน: ชื่อ, รหัสนักศึกษา, รูป (เก็บใน frontend/public/img/team/),
//   และลิงก์ Social Media อย่างน้อยคนละ 1 อัน

// ข้อมูลตัวอย่าง — กลุ่มเปลี่ยนเป็นชื่อ รหัสนักศึกษา รูป และลิงก์ของสมาชิกจริงได้เลย
// photo: path รูปใน frontend/public (เช่น 'img/team/somchai.jpg') ตอนนี้ใช้รูปตัวอย่างจาก Figma
const PLACEHOLDER_PHOTO = 'img/team-placeholder.png';
const FIRST_ROW_SIZE = 2; // จำนวนการ์ดแถวบน

const TEAM_MEMBERS = [
  { name: 'Name', studentId: 'Student Number', photo: PLACEHOLDER_PHOTO, links: [{ label: 'GitHub', url: 'https://github.com/' }] },
  { name: 'Name', studentId: 'Student Number', photo: PLACEHOLDER_PHOTO, links: [{ label: 'GitHub', url: 'https://github.com/' }] },
  { name: 'Name', studentId: 'Student Number', photo: PLACEHOLDER_PHOTO, links: [{ label: 'GitHub', url: 'https://github.com/' }] },
  { name: 'Name', studentId: 'Student Number', photo: PLACEHOLDER_PHOTO, links: [{ label: 'GitHub', url: 'https://github.com/' }] },
  { name: 'Name', studentId: 'Student Number', photo: PLACEHOLDER_PHOTO, links: [{ label: 'Instagram', url: 'https://www.instagram.com/' }] },
];

// การ์ดสมาชิก 1 ใบ: รูป ชื่อ รหัสนักศึกษา ลิงก์โซเชียล
function memberCard(member) {
  let linksHtml = '';
  for (const link of member.links) {
    linksHtml += `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`;
  }
  return `
    <article class="team-card">
      <img class="team-card__photo" src="${escapeHtml(member.photo)}" alt="Photo of ${escapeHtml(member.name)}">
      <h2 class="team-card__name">${escapeHtml(member.name)}</h2>
      <p class="team-card__id">${escapeHtml(member.studentId)}</p>
      <div class="team-card__links">${linksHtml}</div>
    </article>`;
}

// วาดการ์ดทุกคน แบ่งเป็น 2 แถว
function renderTeam() {
  let firstRow = '';
  let secondRow = '';
  for (let i = 0; i < TEAM_MEMBERS.length; i = i + 1) {
    if (i < FIRST_ROW_SIZE) {
      firstRow += memberCard(TEAM_MEMBERS[i]);
    } else {
      secondRow += memberCard(TEAM_MEMBERS[i]);
    }
  }
  document.getElementById('team').innerHTML = `
    <div class="team-row">${firstRow}</div>
    <div class="team-row">${secondRow}</div>`;
}

setupPublicHeader();
renderTeam();
