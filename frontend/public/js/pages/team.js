import { h, renderFooter, renderPublicHeader } from '../ui.js';

// PLACEHOLDER DATA — the group replaces these 5 members with real names, roles, bios and links.
// `photo`: path to an image in frontend/public (e.g. 'img/team/somchai.jpg'), or '' to show initials.
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

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function memberCard(member) {
  const photo = member.photo
    ? h('img', { className: 'team-card__photo', src: member.photo, alt: member.name })
    : h('div', { className: 'team-card__avatar', text: initials(member.name), 'aria-hidden': 'true' });
  return h('article', { className: 'card team-card' }, [
    photo,
    h('h2', { text: member.name, className: 'team-card__name' }),
    h('p', { className: 'team-card__role', text: member.role }),
    h('p', { className: 'team-card__bio', text: member.bio }),
    h('div', { className: 'team-card__links' },
      member.links.map((link) => h('a', { href: link.url, text: link.label, target: '_blank', rel: 'noopener noreferrer' }))),
  ]);
}

renderPublicHeader('team');
renderFooter();
document.getElementById('team').replaceChildren(...TEAM_MEMBERS.map(memberCard));
