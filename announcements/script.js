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

  await loadAnnouncements();

  // Realtime: new announcement
  sb.channel('ann-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, async () => {
      await loadAnnouncements();
    })
    .subscribe();
})();

async function loadAnnouncements() {
  const el = document.getElementById('ann-list');
  const { data: anns, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<p class="muted">Error: ${_esc(error.message)}</p>`; return; }
  if (!anns || !anns.length) { el.innerHTML = '<p class="muted">No announcements yet.</p>'; return; }

  const { data: reads } = await sb.from('announcement_reads').select('announcement_id').eq('user_id', meId);
  const readSet = new Set((reads || []).map(r => r.announcement_id));

  // Mark all as read
  const unread = anns.filter(a => !readSet.has(a.id));
  if (unread.length) {
    await sb.from('announcement_reads').upsert(
      unread.map(a => ({ user_id: meId, announcement_id: a.id })),
      { onConflict: 'user_id,announcement_id' }
    );
    // Update bell
    document.dispatchEvent(new CustomEvent('ann-read-all'));
  }

  const isOwner = meRow?.role === 'owner';
  el.innerHTML = anns.map(a => {
    const unreadClass = !readSet.has(a.id) ? ' unread' : '';
    const dot = !readSet.has(a.id) ? '<div class="ann-unread-dot"></div>' : '';
    const delBtn = isOwner ? `<button class="ann-del" onclick="deleteAnn('${a.id}', this)">del</button>` : '';
    const time = new Date(a.created_at).toLocaleString();
    return `<div class="ann-card${unreadClass}" id="ann-${a.id}">
      ${delBtn}
      <div class="ann-header">
        <div class="ann-title-text">${_esc(a.title)}</div>
        ${dot}
      </div>
      <div class="ann-content">${_esc(a.content)}</div>
      <div class="ann-meta">
        <span>${_esc(a.author_name)}</span>
        <span>${time}</span>
      </div>
    </div>`;
  }).join('');
}

async function postAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const content = document.getElementById('ann-content').value.trim();
  const st = document.getElementById('ann-st');
  if (!title) { st.textContent = 'Title required'; st.className = 'field-status'; return; }
  if (!content) { st.textContent = 'Content required'; st.className = 'field-status'; return; }

  st.textContent = 'Posting…'; st.className = 'field-status';
  document.getElementById('ann-post-btn').disabled = true;

  const authorName = meRow?.display_name || meRow?.email;
  const { error } = await sb.from('announcements').insert({
    title, content, author_id: meId, author_name: authorName
  });

  document.getElementById('ann-post-btn').disabled = false;
  if (error) { st.textContent = error.message; st.className = 'field-status'; return; }

  st.textContent = 'Posted!'; st.className = 'field-status ok';
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-content').value = '';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

async function deleteAnn(id, btn) {
  if (!confirm('Delete this announcement?')) return;
  btn.disabled = true;
  await sb.from('announcements').delete().eq('id', id);
  document.getElementById('ann-' + id)?.remove();
}
