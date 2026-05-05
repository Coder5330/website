function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/auth/index.html'; return; }

  const { data: me } = await sb.from('users').select('role').eq('id', session.user.id).single();
  if (!me || (me.role !== 'admin' && me.role !== 'owner')) {
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

  loadScores();
  loadCtf();
})();

function scoreBadge(game) {
  return { typing: 'badge-typing', cps: 'badge-cps', clicker: 'badge-clicker' }[game] || 'badge-other';
}

function scoreSummary(game, payload) {
  if (!payload) return '—';
  if (game === 'typing') return `${payload.wpm} WPM · ${payload.accuracy}% acc`;
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

  const rows = data.map(r => `
    <tr>
      <td class="mono">${r.player_id}</td>
      <td><span class="badge ${scoreBadge(r.game)}">${_esc(r.game)}</span></td>
      <td>${_esc(scoreSummary(r.game, r.payload))}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">SCORES</span>
        <span class="table-count">${data.length} rows</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Player ID</th><th>Game</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

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

  const rows = Object.entries(grouped).map(([pid, levels]) => `
    <tr>
      <td class="mono">${pid}</td>
      <td>${levels.sort((a,b) => a-b).join(', ')}</td>
      <td>${levels.length}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">CTF PROGRESS</span>
        <span class="table-count">${Object.keys(grouped).length} players · ${data.length} rows</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Player ID</th><th>Levels Solved</th><th>Count</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
