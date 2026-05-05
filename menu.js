// menu.js — include on every page AFTER supabase.js and auth-guard.js

const GAMES = [
  { label: 'Typing Simulator', href: '/typing/index.html' },
  { label: 'Cookie Clicker',   href: '/clicker/index.html' },
  { label: 'CPS Test',         href: '/cps/index.html' },
  { label: 'PianoTiles',       href: '/piano/index.html' },
  { label: 'CTF Challenges',   href: '/ctf/index.html' },
  { label: 'Math Game',        href: '/math_game/index.html' },
  { label: 'Slushie Game',     href: '/slushie/index.html' },
  { label: 'Type Race 🆚',    href: '/typerace/index.html' },
  { label: 'Craft Online ⛏️', href: '/craft/index.html' },
  { label: 'Minecraft 3D ⚒️', href: '/minecraft/index.html' },
];

function _buildDrawer() {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';

  const drawer = document.createElement('nav');
  drawer.className = 'game-drawer';
  drawer.innerHTML = `<div class="drawer-title">Games</div>` +
    GAMES.map(g => {
      const active = window.location.pathname === g.href ? ' active' : '';
      return `<a class="drawer-link${active}" href="${g.href}">${g.label}</a>`;
    }).join('');

  const btn = document.createElement('button');
  btn.className = 'hamburger-btn';
  btn.textContent = '☰';
  btn.setAttribute('aria-label', 'Open games menu');

  const menu = document.querySelector('.menu');
  if (menu) menu.appendChild(btn);
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  let open = false;
  const toggle = () => {
    open = !open;
    drawer.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    btn.textContent = open ? '✕' : '☰';
  };

  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  overlay.addEventListener('click', toggle);
}

function _initials(user) {
  const name = user.user_metadata?.display_name;
  if (name) return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return user.email[0].toUpperCase();
}

function _avatarColor(id) {
  let h = 0;
  for (const c of id) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 60%, 42%)`;
}

(async () => {
  _buildDrawer();

  const user = await getUser();
  if (!user) return;

  const menu = document.querySelector('.menu');

  const right = document.createElement('div');
  right.className = 'menu-right';

  const avatar = document.createElement('button');
  avatar.className = 'menu-avatar';
  avatar.style.background = _avatarColor(user.id);
  avatar.textContent = _initials(user);

  const dropdown = document.createElement('div');
  dropdown.className = 'menu-dropdown';
  dropdown.innerHTML = `
    <div class="dd-item" data-a="profile">Profile</div>
    <div class="dd-item" data-a="settings">Settings</div>
    <div class="dd-sep"></div>
    <div class="dd-item" data-a="signout">Sign out</div>
    <div class="dd-item dd-danger" data-a="delete">Delete account</div>`;

  right.appendChild(avatar);
  menu.appendChild(right);
  document.body.appendChild(dropdown);

  let dropOpen = false;

  avatar.onclick = e => {
    e.stopPropagation();
    dropOpen = !dropOpen;
    if (dropOpen) {
      const rect = avatar.getBoundingClientRect();
      dropdown.style.top   = (rect.bottom + 8) + 'px';
      dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    }
    dropdown.classList.toggle('dd-open', dropOpen);
  };

  document.addEventListener('click', () => {
    dropOpen = false;
    dropdown.classList.remove('dd-open');
  });

  dropdown.addEventListener('click', async e => {
    const action = e.target.closest('[data-a]')?.dataset.a;
    if (!action) return;
    dropOpen = false;
    dropdown.classList.remove('dd-open');
    if (action === 'profile')  window.location.href = '/account/index.html';
    if (action === 'settings') window.location.href = '/account/index.html#settings';
    if (action === 'signout')  { await sb.auth.signOut(); window.location.href = '/auth/index.html'; }
    if (action === 'delete')   window.location.href = '/account/index.html#delete';
  });
})();
