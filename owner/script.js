let userMap = {}; // id -> { email, display_name }

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/auth/index.html'; return; }

  const { data: me } = await sb.from('users').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'owner') {
    window.location.href = '/';
    return;
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
    };
  });

  // Fetch users first so scores/ctf can show emails
  await loadUsers();
  loadScores();
  loadCtf();
})();

// ── Users ────────────────────────────────────────────────────────────────────

async function loadUsers() {
  const el = document.getElementById('tab-users');
  const { data, error } = await sb.from('users').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) { el.innerHTML = `<p class="muted">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">No users yet.</p>'; return; }

  data.forEach(u => { userMap[u.id] = { email: u.email, display_name: u.display_name }; });

  const rows = data.map(u => {
    const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
    return `
    <tr>
      <td>${_esc(u.email) || '—'}</td>
      <td>${u.display_name ? _esc(u.display_name) : '<span style="color:#475569">—</span>'}</td>
      <td>
        <select class="role-select" data-uid="${u.id}" data-orig="${u.role}">
          <option value="user"  ${u.role==='user'  ? 'selected':''}>user</option>
          <option value="admin" ${u.role==='admin' ? 'selected':''}>admin</option>
          <option value="owner" ${u.role==='owner' ? 'selected':''}>owner</option>
        </select>
      </td>
      <td>
        <button class="btn-save" data-uid="${u.id}" onclick="saveRole(this)">save</button>
        <span class="save-st" id="st-${u.id}"></span>
      </td>
      <td style="color:#475569;font-size:11px">${joined}</td>
      <td class="mono">${u.id}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">USERS</span>
        <span class="table-count">${data.length} rows</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Email</th><th>Display Name</th><th>Role</th><th></th><th>Joined</th><th>ID</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function saveRole(btn) {
  const uid = btn.dataset.uid;
  const sel = document.querySelector(`.role-select[data-uid="${uid}"]`);
  const st  = document.getElementById('st-' + uid);
  const role = sel.value;

  btn.disabled = true;
  st.textContent = 'saving…'; st.className = 'save-st';

  const { error } = await sb.from('users').update({ role }).eq('id', uid);
  btn.disabled = false;

  if (error) {
    const msg = error.message.includes('protected') ? 'Protected — cannot change.'
              : error.message.includes('owner')     ? 'Last owner — cannot remove.'
              : error.message.includes('admin')     ? 'Last admin — cannot remove.'
              : error.message;
    st.textContent = msg; st.className = 'save-st err';
  } else {
    st.textContent = 'saved!'; st.className = 'save-st';
    sel.dataset.orig = role;
    setTimeout(() => { st.textContent = ''; }, 2000);
  }
}

// ── Scores ───────────────────────────────────────────────────────────────────

function scoreBadge(game) {
  return { typing: 'badge-typing', cps: 'badge-cps', clicker: 'badge-clicker' }[game] || 'badge-other';
}

function scoreSummary(game, payload) {
  if (!payload) return '—';
  if (game === 'typing')  return `${payload.wpm} WPM · ${payload.accuracy}% acc`;
  if (game === 'cps') {
    const best = Object.entries(payload).reduce((a, b) => b[1] > a[1] ? b : a, ['', 0]);
    return best[0] ? `${best[1]} CPS (${best[0].slice(1)}s)` : '—';
  }
  if (game === 'clicker') return `${Number(payload.score).toLocaleString()} cookies`;
  return JSON.stringify(payload).slice(0, 60);
}

async function loadScores() {
  const el = document.getElementById('tab-scores');
  const { data, error } = await sb.from('scores').select('*').order('game').limit(500);
  if (error) { el.innerHTML = `<p class="muted">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">No scores yet.</p>'; return; }

  const rows = data.map(r => {
    const u = userMap[r.player_id];
    return `
    <tr id="sr-${r.player_id}-${r.game}">
      <td>${u?.email ? _esc(u.email) : `<span class="mono">${r.player_id}</span>`}</td>
      <td><span class="badge ${scoreBadge(r.game)}">${_esc(r.game)}</span></td>
      <td>${_esc(scoreSummary(r.game, r.payload))}</td>
      <td><button class="btn-del" onclick="deleteScore('${r.player_id}','${r.game}',this)">del</button></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">SCORES</span>
        <span class="table-count">${data.length} rows</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Player</th><th>Game</th><th>Score</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function deleteScore(playerId, game, btn) {
  if (!confirm(`Delete ${game} score for this player?`)) return;
  btn.disabled = true;
  const { error } = await sb.from('scores').delete().eq('player_id', playerId).eq('game', game);
  if (error) { alert(error.message); btn.disabled = false; return; }
  document.getElementById(`sr-${playerId}-${game}`)?.remove();
}

// ── CTF Progress ─────────────────────────────────────────────────────────────

async function loadCtf() {
  const el = document.getElementById('tab-ctf');
  const { data, error } = await sb.from('ctf_progress').select('*').order('player_id').limit(500);
  if (error) { el.innerHTML = `<p class="muted">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">No CTF progress yet.</p>'; return; }

  const grouped = {};
  data.forEach(r => {
    if (!grouped[r.player_id]) grouped[r.player_id] = [];
    grouped[r.player_id].push(r.level);
  });

  const rows = Object.entries(grouped).map(([pid, levels]) => {
    const u = userMap[pid];
    return `
    <tr>
      <td>${u?.email ? _esc(u.email) : `<span class="mono">${pid}</span>`}</td>
      <td>${levels.sort((a,b) => a-b).join(', ')}</td>
      <td>${levels.length}</td>
      <td><button class="btn-del" onclick="deleteCtf('${pid}',this)">del all</button></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">CTF PROGRESS</span>
        <span class="table-count">${Object.keys(grouped).length} players · ${data.length} rows</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Player</th><th>Levels Solved</th><th>Count</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function deleteCtf(playerId, btn) {
  const u = userMap[playerId];
  if (!confirm(`Delete ALL CTF progress for ${u?.email || playerId}?`)) return;
  btn.disabled = true;
  const { error } = await sb.from('ctf_progress').delete().eq('player_id', playerId);
  if (error) { alert(error.message); btn.disabled = false; return; }
  btn.closest('tr')?.remove();
}
