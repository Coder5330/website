let meId = null, meRow = null;

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  meId = session.user.id;

  const { data } = await sb.from('users').select('role, display_name, email').eq('id', meId).single();
  meRow = data;

  if (meRow?.role === 'admin' || meRow?.role === 'owner') {
    document.getElementById('compose-wrap').style.display = 'block';
  }

  await loadEvents();

  sb.channel('ev-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, loadEvents)
    .subscribe();
})();

async function loadEvents() {
  const el = document.getElementById('ev-list');
  const { data, error } = await sb.from('events').select('*').order('event_date', { ascending: true, nullsFirst: false });
  if (error) { el.innerHTML = `<p class="muted">Error: ${_esc(error.message)}</p>`; return; }
  if (!data || !data.length) { el.innerHTML = '<p class="muted">No events yet.</p>'; return; }

  const isOwner = meRow?.role === 'owner';
  const now = new Date();

  el.innerHTML = data.map(e => {
    const past = e.event_date && new Date(e.event_date) < now;
    const dateStr = e.event_date ? new Date(e.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null;
    const delBtn = isOwner ? `<button class="ann-del" onclick="deleteEvent('${e.id}', this)">del</button>` : '';
    return `<div class="ann-card" id="ev-${e.id}" style="${past ? 'opacity:0.5' : ''}">
      ${delBtn}
      ${dateStr ? `<div class="event-date-badge">📅 ${dateStr}${past ? ' · past' : ''}</div>` : ''}
      <div class="ann-header">
        <div class="ann-title-text">${_esc(e.title)}</div>
      </div>
      <div class="ann-content">${_esc(e.content)}</div>
      <div class="ann-meta">
        <span>${_esc(e.author_name)}</span>
        <span>${new Date(e.created_at).toLocaleDateString()}</span>
      </div>
    </div>`;
  }).join('');
}

async function postEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const content = document.getElementById('ev-content').value.trim();
  const date = document.getElementById('ev-date').value;
  const st = document.getElementById('ev-st');
  if (!title) { st.textContent = 'Title required'; st.className = 'field-status'; return; }
  if (!content) { st.textContent = 'Content required'; st.className = 'field-status'; return; }

  st.textContent = 'Posting…'; st.className = 'field-status';
  document.getElementById('ev-post-btn').disabled = true;

  const { error } = await sb.from('events').insert({
    title, content,
    event_date: date || null,
    author_id: meId,
    author_name: meRow?.display_name || meRow?.email
  });

  document.getElementById('ev-post-btn').disabled = false;
  if (error) { st.textContent = error.message; st.className = 'field-status'; return; }

  st.textContent = 'Posted!'; st.className = 'field-status ok';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-content').value = '';
  document.getElementById('ev-date').value = '';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

async function deleteEvent(id, btn) {
  if (!confirm('Delete this event?')) return;
  btn.disabled = true;
  await sb.from('events').delete().eq('id', id);
  document.getElementById('ev-' + id)?.remove();
}
