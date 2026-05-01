// menu.js — include on every page AFTER supabase.js and auth-guard.js

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

function _modal(title, bodyHtml) {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  el.querySelector('.modal-close').onclick = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  return el;
}

async function _openProfile(user) {
  const meta = user.user_metadata || {};
  const displayName = meta.display_name || user.email.split('@')[0];
  const color = _avatarColor(user.id);
  const initials = _initials(user);

  const overlay = _modal('Profile', `
    <div class="profile-header">
      <div class="profile-avatar-lg" style="background:${color}">${initials}</div>
      <div>
        <div class="profile-name">${displayName}</div>
        <div class="profile-email">${user.email}</div>
      </div>
    </div>
    <p class="muted scores-loading">Loading scores…</p>`);

  const body = overlay.querySelector('.modal-body');
  const { data } = await sb.from('scores').select('game,payload').eq('player_id', user.id);

  body.querySelector('.scores-loading')?.remove();

  if (!data?.length) {
    body.insertAdjacentHTML('beforeend', '<p class="muted">No scores yet — play some games!</p>');
    return;
  }

  const m = {};
  data.forEach(r => { m[r.game] = r.payload; });

  const cards = [];

  if (m.typing) {
    cards.push(`<div class="score-card">
      <div class="score-label">Typing Simulator</div>
      <div class="score-val">${m.typing.wpm} <span class="score-unit">WPM</span></div>
      <div class="score-sub">${m.typing.accuracy}% accuracy</div>
    </div>`);
  }

  if (m.cps) {
    const rows = [1,2,5,10,30,60,100]
      .filter(d => m.cps['d'+d] != null)
      .map(d => `<div class="score-row"><span class="score-sub">${d}s</span> <span class="score-val-sm">${m.cps['d'+d]} CPS</span></div>`)
      .join('');
    if (rows) cards.push(`<div class="score-card"><div class="score-label">CPS Test</div>${rows}</div>`);
  }

  if (m.clicker) {
    cards.push(`<div class="score-card">
      <div class="score-label">Cookie Clicker</div>
      <div class="score-val">${Number(m.clicker.score).toLocaleString()} <span class="score-unit">cookies</span></div>
    </div>`);
  }

  body.insertAdjacentHTML('beforeend',
    cards.length ? `<div class="score-grid">${cards.join('')}</div>` : '<p class="muted">No scores yet — play some games!</p>');
}

async function _openSettings(user) {
  const meta = user.user_metadata || {};
  const overlay = _modal('Settings', `
    <div class="settings-form">
      <label class="field-label">Display name</label>
      <input id="_sname" type="text" placeholder="Your name" value="${meta.display_name || ''}">
      <div class="field-row">
        <button id="_sname_btn" class="btn-primary">Save</button>
        <span id="_sname_st" class="field-status"></span>
      </div>

      <div class="settings-divider"></div>

      <label class="field-label">New password</label>
      <input id="_spw" type="password" placeholder="Min 6 characters">
      <div class="field-row">
        <button id="_spw_btn" class="btn-primary">Change password</button>
        <span id="_spw_st" class="field-status"></span>
      </div>
    </div>`);

  overlay.querySelector('#_sname_btn').onclick = async () => {
    const name = overlay.querySelector('#_sname').value.trim();
    const st = overlay.querySelector('#_sname_st');
    st.textContent = 'Saving…'; st.className = 'field-status';
    const { error } = await sb.auth.updateUser({ data: { display_name: name } });
    if (error) { st.textContent = error.message; return; }
    st.textContent = 'Saved!'; st.className = 'field-status ok';
    const avatar = document.querySelector('.menu-avatar');
    if (avatar) {
      avatar.textContent = name
        ? name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : user.email[0].toUpperCase();
    }
  };

  overlay.querySelector('#_spw_btn').onclick = async () => {
    const pw = overlay.querySelector('#_spw').value;
    const st = overlay.querySelector('#_spw_st');
    if (pw.length < 6) { st.textContent = 'Too short'; st.className = 'field-status'; return; }
    st.textContent = 'Saving…'; st.className = 'field-status';
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { st.textContent = error.message; return; }
    st.textContent = 'Changed!'; st.className = 'field-status ok';
    overlay.querySelector('#_spw').value = '';
  };
}

async function _openDelete(user) {
  const meta = user.user_metadata || {};
  const confirmStr = meta.display_name || user.email.split('@')[0];
  const overlay = _modal('Delete account', `
    <p class="muted">This is permanent and cannot be undone.</p>
    <p class="muted">Type <strong style="color:#f1f5f9">${confirmStr}</strong> to confirm.</p>
    <input id="_dconf" type="text" placeholder="Type to confirm" autocomplete="off">
    <div class="field-row">
      <button id="_dbtn" class="btn-danger">Delete my account</button>
      <span id="_dst" class="field-status"></span>
    </div>`);

  overlay.querySelector('#_dbtn').onclick = async () => {
    const val = overlay.querySelector('#_dconf').value;
    const st = overlay.querySelector('#_dst');
    if (val !== confirmStr) { st.textContent = 'Text does not match'; st.className = 'field-status'; return; }
    st.textContent = 'Deleting…'; st.className = 'field-status';
    await sb.from('scores').delete().eq('player_id', user.id);
    const { error } = await sb.rpc('delete_own_account');
    if (error) { st.textContent = error.message; return; }
    await sb.auth.signOut();
    window.location.href = '/auth/index.html';
  };
}

(async () => {
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
  right.appendChild(dropdown);
  menu.appendChild(right);

  let dropOpen = false;

  avatar.onclick = e => {
    e.stopPropagation();
    dropOpen = !dropOpen;
    if (dropOpen) {
      const rect = avatar.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + 8) + 'px';
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
    if (action === 'profile')  _openProfile(user);
    if (action === 'settings') _openSettings(user);
    if (action === 'signout')  { await sb.auth.signOut(); window.location.href = '/auth/index.html'; }
    if (action === 'delete')   _openDelete(user);
  });
})();
