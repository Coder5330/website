// menu.js — include on every page AFTER supabase.js and auth-guard.js

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const GAMES = [
  { label: 'Typing Simulator', href: '/typing/index.html' },
  { label: 'Cookie Clicker',   href: '/clicker/index.html' },
  { label: 'CPS Test',         href: '/cps/index.html' },
  { label: 'PianoTiles',       href: '/piano/index.html' },
  { label: 'CTF Challenges',   href: '/ctf/index.html' },
  { label: 'Math Game',        href: '/math_game/index.html' },
  { label: 'Slushie Game',     href: '/slushie/index.html' },
  { label: 'Type Race 🆚',    href: '/typerace/index.html' },
  { label: 'Minecraft 3D ⚒️', href: '/minecraft/index.html' },
  { label: 'Infinite Craft ✨', href: '/infinite/index.html' },
  { label: 'Chess ♟️',         href: '/chess/index.html' },
];

function _addNavLinks() {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  const links = [
    { href: '/chat/index.html', label: 'Chat' },
    { href: '/announcements/index.html', label: 'Announcements' },
    { href: '/events/index.html', label: 'Events' },
    { href: '/homework/index.html', label: 'Homework' },
    { href: '/leaderboard/index.html', label: '🏆 Leaderboard' },
  ];
  for (const { href, label } of links) {
    if (menu.querySelector(`a[href*="${href}"]`)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<a href="${href}">${label}</a>`;
    menu.appendChild(li);
  }
}

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
  return btn;
}

function _menuInitials(user) {
  const name = user.user_metadata?.display_name;
  if (name) return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (user.email || '?')[0].toUpperCase();
}

function _avatarColor(id) {
  let h = 0;
  for (const c of id) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 60%, 42%)`;
}

(async () => {
  const hamburgerBtn = _buildDrawer();
  _addNavLinks();

  const user = await getUser();
  if (!user) return;

  const menu = document.querySelector('.menu');

  const right = document.createElement('div');
  right.className = 'menu-right';

  const avatar = document.createElement('button');
  avatar.className = 'menu-avatar';
  avatar.style.background = _avatarColor(user.id);
  avatar.textContent = _menuInitials(user);

  const { data: userRow } = await sb.from('users').select('role, display_name, email').eq('id', user.id).single();
  const role = userRow?.role ?? 'user';
  const displayName = userRow?.display_name || userRow?.email || user.email;

  const nameEl = document.createElement('span');
  nameEl.className = 'menu-username';
  nameEl.textContent = displayName;
  right.appendChild(nameEl);

  const bell = document.createElement('button');
  bell.className = 'menu-bell';
  bell.setAttribute('aria-label', 'Announcements');
  bell.innerHTML = '🔔<span class="bell-dot" style="display:none"></span>';
  right.appendChild(bell);

  // Bell dropdown panel
  const bellPanel = document.createElement('div');
  bellPanel.className = 'bell-panel';
  bellPanel.innerHTML = `<div class="bell-panel-list">${[1,0.7,0.85].map(() => `<div class="sk-notif"><div class="sk-notif-avatar"></div><div class="sk-notif-lines"><div class="sk-notif-line"></div><div class="sk-notif-line sk-short"></div></div></div>`).join('')}</div>`;
  document.body.appendChild(bellPanel);

  let bellOpen = false;

  function _dedupeConvs(convs) {
    const seen = new Map();
    for (const c of (convs || [])) {
      if (!seen.has(c.conversation_id) || (!seen.get(c.conversation_id).conv_name && c.conv_name))
        seen.set(c.conversation_id, c);
    }
    return Array.from(seen.values());
  }

  async function loadBellPanel() {
    const list = bellPanel.querySelector('.bell-panel-list');
    try {
      const [{ data: anns, error: annErr }, { data: reads }, { data: rawConvs }] = await Promise.all([
        sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
        sb.from('announcement_reads').select('announcement_id').eq('user_id', user.id),
        sb.rpc('get_my_conversations')
      ]);
      if (annErr) throw annErr;

      const readSet = new Set((reads || []).map(r => r.announcement_id));
      const unreadChats = _dedupeConvs(rawConvs).filter(c =>
        c.last_message_at && c.sender_id !== user.id &&
        (!c.last_read_at || new Date(c.last_message_at) > new Date(c.last_read_at))
      );

      let html = '';

      // ── Announcements section ──
      html += `<div class="bell-section-label">ANNOUNCEMENTS<a href="/announcements/index.html" class="bell-panel-viewall">View all →</a></div>`;
      if (!anns || !anns.length) {
        html += '<p class="bell-panel-empty">No announcements yet.</p>';
      } else {
        html += anns.map(a => {
          const unread = !readSet.has(a.id);
          const time = new Date(a.created_at).toLocaleDateString();
          return `<a class="bell-ann-item${unread ? ' unread' : ''}" href="/announcements/index.html">
            <div class="bell-ann-top">
              ${unread ? '<span class="bell-ann-dot"></span>' : ''}
              <span class="bell-ann-title">${_esc(a.title)}</span>
            </div>
            <div class="bell-ann-body">${_esc(a.content.length > 80 ? a.content.slice(0,80)+'…' : a.content)}</div>
            <div class="bell-ann-time">${time}</div>
          </a>`;
        }).join('');
      }

      // ── Chat section ──
      html += `<div class="bell-section-label" style="margin-top:6px">CHATS<a href="/chat/index.html" class="bell-panel-viewall">Open →</a></div>`;
      if (!unreadChats.length) {
        html += '<p class="bell-panel-empty">No unread messages.</p>';
      } else {
        html += unreadChats.slice(0, 5).map(c => {
          const name = c.conv_name || c.other_display_name || c.other_email || 'Chat';
          const preview = c.last_message ? _esc(c.last_message.slice(0, 60)) : '';
          return `<a class="bell-ann-item unread" href="/chat/index.html">
            <div class="bell-ann-top">
              <span class="bell-ann-dot"></span>
              <span class="bell-ann-title">${_esc(name)}</span>
            </div>
            <div class="bell-ann-body">${preview}</div>
          </a>`;
        }).join('');
      }

      list.innerHTML = html;
    } catch (e) {
      list.innerHTML = '<p class="bell-panel-empty">Could not load.</p>';
    }
  }

  async function refreshBell() {
    const [{ data: all }, { data: read }, { data: rawConvs }] = await Promise.all([
      sb.from('announcements').select('id'),
      sb.from('announcement_reads').select('announcement_id').eq('user_id', user.id),
      sb.rpc('get_my_conversations')
    ]);
    const readIds = new Set((read || []).map(r => r.announcement_id));
    const hasUnreadAnn = (all || []).some(a => !readIds.has(a.id));
    const hasUnreadChat = _dedupeConvs(rawConvs).some(c =>
      c.last_message_at && c.sender_id !== user.id &&
      (!c.last_read_at || new Date(c.last_message_at) > new Date(c.last_read_at))
    );
    bell.querySelector('.bell-dot').style.display = (hasUnreadAnn || hasUnreadChat) ? '' : 'none';
  }
  refreshBell();
  document.addEventListener('ann-read-all', refreshBell);

  bell.addEventListener('click', async e => {
    e.stopPropagation();
    bellOpen = !bellOpen;
    if (bellOpen) {
      const rect = bell.getBoundingClientRect();
      bellPanel.style.top = (rect.bottom + 8) + 'px';
      bellPanel.style.right = (window.innerWidth - rect.right) + 'px';
      bellPanel.classList.add('bp-open');
      await loadBellPanel();
    } else {
      bellPanel.classList.remove('bp-open');
    }
  });

  document.addEventListener('click', () => {
    bellOpen = false;
    bellPanel.classList.remove('bp-open');
  });
  bellPanel.addEventListener('click', e => e.stopPropagation());

  // Realtime: refresh bell dot when new chat message arrives
  sb.channel('menu-msg-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
      if (payload.new.sender_id !== user.id) refreshBell();
    })
    .subscribe();

  if (role === 'owner' || role === 'admin') {
    const badge = document.createElement('a');
    badge.href = role === 'owner' ? '/owner/index.html' : '/admin/index.html';
    badge.textContent = role.toUpperCase();
    badge.className = `menu-role-badge menu-role-${role}`;
    right.appendChild(badge);
  }

  const panelLinks = role === 'owner'
    ? `<div class="dd-sep"></div>
       <div class="dd-item" data-a="admin">Admin Panel</div>
       <div class="dd-item" data-a="owner">Owner Panel</div>`
    : role === 'admin'
    ? `<div class="dd-sep"></div>
       <div class="dd-item" data-a="admin">Admin Panel</div>`
    : '';

  const dropdown = document.createElement('div');
  dropdown.className = 'menu-dropdown';
  dropdown.innerHTML = `
    <div class="dd-item" data-a="profile">Profile</div>
    <div class="dd-item" data-a="settings">Settings</div>
    <div class="dd-item" data-a="feedback">💬 Send Feedback</div>
    ${panelLinks}
    <div class="dd-sep"></div>
    <div class="dd-item" data-a="signout">Sign out</div>
    <div class="dd-item dd-danger" data-a="delete">Delete account</div>`;

  right.appendChild(avatar);
  menu.appendChild(right);
  menu.appendChild(hamburgerBtn);
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
    if (action === 'feedback') window.location.href = '/feedback/index.html';
    if (action === 'admin')    window.location.href = '/admin/index.html';
    if (action === 'owner')    window.location.href = '/owner/index.html';
    if (action === 'signout')  { await signOutClean(); window.location.href = '/auth/index.html'; }
    if (action === 'delete')   window.location.href = '/account/index.html#delete';
  });
})();
