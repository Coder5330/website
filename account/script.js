function _initials(displayName) {
  if (displayName) return displayName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return '?';
}

function _avatarColor(id) {
  let h = 0;
  for (const c of id) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 60%, 42%)`;
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const user = session.user;

  // Load user profile from users table
  const { data: userProfile } = await sb.from('users').select('*').eq('id', user.id).single();

  const hash = window.location.hash.slice(1) || 'profile';
  activateTab(hash, user, userProfile);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      history.replaceState(null, '', '#' + tab);
      activateTab(tab, user, userProfile);
    };
  });
})();

function activateTab(tab, user, userProfile) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  if (tab === 'profile')  loadProfile(user, userProfile);
  if (tab === 'settings') loadSettings(user, userProfile);
  if (tab === 'delete')   loadDelete(user, userProfile);
}

let profileLoaded = false;
async function loadProfile(user, userProfile) {
  if (profileLoaded) return;
  profileLoaded = true;
  const el = document.getElementById('tab-profile');
  const name = userProfile?.display_name || userProfile?.username || user.email;
  const color = _avatarColor(user.id);

  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-lg" style="background:${color}">${_initials(userProfile?.display_name)}</div>
      <div>
        <div class="profile-name">${name}</div>
        <div class="profile-email">${userProfile?.email || user.email}</div>
      </div>
    </div>
    <div class="section-title">Top scores</div>
    <p class="muted" id="scores-loading">Loading…</p>
    <div id="score-grid"></div>`;

  const { data } = await sb.from('scores').select('game,payload').eq('player_id', user.id);
  document.getElementById('scores-loading')?.remove();

  const m = {};
  (data || []).forEach(r => { m[r.game] = r.payload; });
  const grid = document.getElementById('score-grid');

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
      .map(d => `<div class="score-row"><span class="score-sub">${d}s</span><span class="score-val-sm">${m.cps['d'+d]} CPS</span></div>`)
      .join('');
    if (rows) cards.push(`<div class="score-card"><div class="score-label">CPS Test</div>${rows}</div>`);
  }
  if (m.clicker) {
    cards.push(`<div class="score-card">
      <div class="score-label">Cookie Clicker</div>
      <div class="score-val">${Number(m.clicker.score).toLocaleString()} <span class="score-unit">cookies</span></div>
    </div>`);
  }

  grid.innerHTML = cards.length
    ? `<div class="score-grid">${cards.join('')}</div>`
    : '<p class="muted">No scores yet — play some games!</p>';
}

let settingsLoaded = false;
function loadSettings(user, userProfile) {
  if (settingsLoaded) return;
  settingsLoaded = true;
  const el = document.getElementById('tab-settings');

  el.innerHTML = `
    <div class="settings-section">
      <div class="section-title">Display name</div>
      <input id="s-name" type="text" placeholder="Your name" value="${userProfile?.display_name || ''}">
      <div class="field-row">
        <button id="s-name-btn" class="btn-primary">Save</button>
        <span id="s-name-st" class="field-status"></span>
      </div>
    </div>
    <div class="settings-divider"></div>
    <div class="settings-section">
      <div class="section-title">Password</div>
      <input id="s-pw" type="password" placeholder="New password (min 6 characters)">
      <div class="field-row">
        <button id="s-pw-btn" class="btn-primary">Change password</button>
        <span id="s-pw-st" class="field-status"></span>
      </div>
    </div>`;

  document.getElementById('s-name-btn').onclick = async () => {
    const name = document.getElementById('s-name').value.trim();
    const st = document.getElementById('s-name-st');
    st.textContent = 'Saving…'; st.className = 'field-status';
    const { error: err1 } = await sb.from('users').update({ display_name: name }).eq('id', user.id);
    const { error: err2 } = await sb.auth.updateUser({ data: { display_name: name } });
    if (err1 || err2) { st.textContent = (err1 || err2).message; return; }
    st.textContent = 'Saved!'; st.className = 'field-status ok';
    profileLoaded = false;
    const avatar = document.querySelector('.menu-avatar');
    if (avatar) avatar.textContent = _initials(name);
  };

  document.getElementById('s-pw-btn').onclick = async () => {
    const pw = document.getElementById('s-pw').value;
    const st = document.getElementById('s-pw-st');
    if (pw.length < 6) { st.textContent = 'Too short'; st.className = 'field-status'; return; }
    st.textContent = 'Saving…'; st.className = 'field-status';
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { st.textContent = error.message; return; }
    st.textContent = 'Changed!'; st.className = 'field-status ok';
    document.getElementById('s-pw').value = '';
  };
}

let deleteLoaded = false;
function loadDelete(user, userProfile) {
  if (deleteLoaded) return;
  deleteLoaded = true;
  const el = document.getElementById('tab-delete');
  const confirmStr = userProfile?.display_name || userProfile?.username || user.email.split('@')[0];

  el.innerHTML = `
    <p class="muted">This is permanent and cannot be undone.</p>
    <p class="muted">Type <strong style="color:#f1f5f9">${confirmStr}</strong> to confirm.</p>
    <input id="d-conf" type="text" placeholder="Type to confirm" autocomplete="off">
    <div class="field-row">
      <button id="d-btn" class="btn-danger">Delete my account</button>
      <span id="d-st" class="field-status"></span>
    </div>`;

  document.getElementById('d-btn').onclick = async () => {
    const val = document.getElementById('d-conf').value;
    const st = document.getElementById('d-st');
    if (val !== confirmStr) { st.textContent = 'Text does not match'; st.className = 'field-status'; return; }
    st.textContent = 'Deleting…'; st.className = 'field-status';
    await sb.from('scores').delete().eq('player_id', user.id);
    const { error } = await sb.rpc('delete_own_account');
    if (error) { st.textContent = error.message; return; }
    await sb.auth.signOut();
    window.location.href = '/auth/index.html';
  };
}
