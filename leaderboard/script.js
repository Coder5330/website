// leaderboard/script.js

let _myId     = null;
let _userMap  = {}; // player_id → { display_name, email }
let _scores   = []; // raw rows from scores table
let _activeGame = 'typing';
let _activeDur  = 10;

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) _myId = session.user.id;

  // Load all users for name lookup (same approach as owner panel)
  const { data: users } = await sb.from('users').select('id, display_name, email');
  (users || []).forEach(u => { _userMap[u.id] = u; });

  // Load all scores (requires SELECT policy on scores table)
  const { data, error } = await sb.from('scores').select('player_id, game, payload');
  if (error) {
    document.getElementById('lb-content').innerHTML =
      `<p class="muted lb-empty">Could not load scores: ${_esc(error.message)}</p>`;
    return;
  }
  _scores = data || [];

  // Tab switching
  document.querySelectorAll('.lb-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeGame = btn.dataset.game;
      document.getElementById('cps-subtabs').style.display = _activeGame === 'cps' ? '' : 'none';
      render();
    };
  });

  document.querySelectorAll('.cps-sub').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cps-sub').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeDur = Number(btn.dataset.dur);
      render();
    };
  });

  render();
})();

function getSortVal(row) {
  const p = row.payload;
  if (_activeGame === 'typing')  return Number(p?.wpm ?? 0);
  if (_activeGame === 'cps')     return Number(p?.['s' + _activeDur] ?? 0);
  if (_activeGame === 'clicker') return Number(p?.score ?? 0);
  return 0;
}

function fmtScore(row) {
  const p = row.payload;
  if (_activeGame === 'typing')  return `${p?.wpm ?? 0} WPM`;
  if (_activeGame === 'cps')     return `${p?.['s' + _activeDur] ?? 0} CPS`;
  if (_activeGame === 'clicker') return Number(p?.score ?? 0).toLocaleString() + ' 🍪';
  return '—';
}

function fmtSub(row) {
  const p = row.payload;
  if (_activeGame === 'typing')  return `${p?.accuracy ?? 0}% accuracy`;
  if (_activeGame === 'cps')     return `${_activeDur}s test`;
  return '';
}

function render() {
  const rows = _scores.filter(r => r.game === _activeGame && getSortVal(r) > 0);
  rows.sort((a, b) => getSortVal(b) - getSortVal(a));

  const content = document.getElementById('lb-content');
  if (!rows.length) {
    content.innerHTML = '<p class="muted lb-empty">No scores yet — be the first!</p>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  const html = rows.slice(0, 50).map((row, i) => {
    const u      = _userMap[row.player_id] || {};
    const name   = u.display_name || u.email || 'Unknown';
    const isMine = row.player_id === _myId;
    const rank   = i + 1;
    const rankStr = rank <= 3 ? medals[rank - 1] : `#${rank}`;
    const color  = _avatarColor(row.player_id);
    const inits  = _initials(u.display_name);

    return `<div class="lb-row${isMine ? ' lb-mine' : ''}">
      <div class="lb-rank">${rankStr}</div>
      <div class="lb-avatar" style="background:${color}">${_esc(inits)}</div>
      <div class="lb-info">
        <div class="lb-name">${_esc(name)}${isMine ? ' <span class="lb-you">you</span>' : ''}</div>
        <div class="lb-sub">${_esc(fmtSub(row))}</div>
      </div>
      <div class="lb-score">${_esc(fmtScore(row))}</div>
    </div>`;
  }).join('');

  content.innerHTML = `<div class="lb-list">${html}</div>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function _avatarColor(id) {
  let h = 0;
  for (const c of (id || '')) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360}, 60%, 42%)`;
}
