// team.js — สคริปต์หน้าทีม: วาดการ์ดสมาชิกจากรายการ TEAM_MEMBERS ด้านล่าง

// ข้อมูลตัวอย่าง — กลุ่มเปลี่ยนเป็นชื่อ บทบาท ประวัติ และลิงก์ของสมาชิกจริงได้เลย
// photo: path รูปใน frontend/public (เช่น 'img/team/somchai.jpg') หรือ '' เพื่อแสดงตัวอักษรย่อแทน
const TEAM_MEMBERS = [
  {
    name: 'Member One',
    role: 'Project Manager',
    bio: 'Plans the sprints, writes the spec and reviews every pull request.',
    photo: '',
    links: [{ label: 'GitHub', url: 'https://github.com/' }, { label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
  {
    name: 'Member Two',
    role: 'Front-end Developer',
    bio: 'Builds the public pages and makes sure they work on a phone.',
    photo: '',
    links: [{ label: 'GitHub', url: 'https://github.com/' }],
  },
  {
    name: 'Member Three',
    role: 'Back-end Developer',
    bio: 'Designs the Express API, validation and session login.',
    photo: '',
    links: [{ label: 'GitHub', url: 'https://github.com/' }],
  },
  {
    name: 'Member Four',
    role: 'Database Designer',
    bio: 'Owns the data model, MySQL schema and sample data.',
    photo: '',
    links: [{ label: 'GitHub', url: 'https://github.com/' }],
  },
  {
    name: 'Member Five',
    role: 'UX / UI Designer',
    bio: 'Drew the Figma wireframes and keeps the pages consistent.',
    photo: '',
    links: [{ label: 'Instagram', url: 'https://www.instagram.com/' }],
  },
];

// ตัวอักษรย่อจากชื่อ เช่น "Member One" -> "MO" (ใช้เมื่อไม่มีรูป)
function initials(name) {
  let result = '';
  for (const word of name.split(' ')) {
    if (word !== '' && result.length < 2) {
      result += word[0].toUpperCase();
    }
  }
  return result;
}

// การ์ดสมาชิก 1 ใบ
function memberCard(member) {
  let photoHtml = `<div class="team-card__avatar" aria-hidden="true">${escapeHtml(initials(member.name))}</div>`;
  if (member.photo) {
    photoHtml = `<img class="team-card__photo" src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}">`;
  }
  let linksHtml = '';
  for (const link of member.links) {
    linksHtml += `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`;
  }
  return `
    <article class="card team-card">
      ${photoHtml}
      <h2 class="team-card__name">${escapeHtml(member.name)}</h2>
      <p class="team-card__role">${escapeHtml(member.role)}</p>
      <p class="team-card__bio">${escapeHtml(member.bio)}</p>
      <div class="team-card__links">${linksHtml}</div>
    </article>`;
}

// วาดการ์ดสมาชิกทุกคน
function renderTeam() {
  let html = '';
  for (const member of TEAM_MEMBERS) {
    html += memberCard(member);
  }
  document.getElementById('team').innerHTML = html;
}

setupPublicHeader(true);
renderTeam();
