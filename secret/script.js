// ============================================================
// SKILL HUB — SECRET ROOM
// Your SHA-256 challenge is below. Crack it to enter.
// Hint: 8 digits, all numbers.
//
// _HASH_ = will be replaced at runtime from your profile
// ============================================================

let _currentUser = null;
let _displayName = '';
let _realtimeSub = null;

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/auth/index.html'; return; }

  _currentUser = session.user;

  const { data: profile } = await sb.from('users').select('secret_hash, display_name').eq('id', _currentUser.id).single();
  _displayName = profile?.display_name || _currentUser.email.split('@')[0];

  if (!profile?.secret_hash) {
    document.getElementById('gate-msg').textContent = 'No key assigned to your account yet.';
    return;
  }

  // ============================================================
  // YOUR CHALLENGE HASH (visible by design — crack it):
  window.__challenge = profile.secret_hash;
  console.log('%c[SECRET ROOM] SHA-256 = ' + profile.secret_hash, 'color:#ef4444');
  // ============================================================

  document.getElementById('key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryKey();
  });
})();

async function tryKey() {
  const input = document.getElementById('key-input').value.trim();
  const msg   = document.getElementById('gate-msg');

  if (!/^\d{8}$/.test(input)) {
    msg.textContent = '8 digits only.';
    return;
  }

  msg.textContent = 'checking…';
  const hash = await sha256(input);

  if (hash !== window.__challenge) {
    msg.textContent = 'wrong key.';
    return;
  }

  document.getElementById('gate').style.display = 'none';
  document.getElementById('chat').style.display = 'block';
  document.body.style.alignItems = 'flex-start';
  initChat();
}

// ── Chat ─────────────────────────────────────────────────────

async function initChat() {
  await loadMessages();

  _realtimeSub = sb.channel('secret-room')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      appendMessage(payload.new);
    })
    .subscribe();

  document.getElementById('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMsg();
  });
}

async function loadMessages() {
  const { data } = await sb.from('messages').select('*').order('created_at').limit(200);
  (data || []).forEach(appendMessage);
}

function appendMessage(msg) {
  const box = document.getElementById('chat-box');
  document.getElementById('chat-empty')?.remove();

  const mine = msg.sender_id === _currentUser.id;
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const el = document.createElement('div');
  el.className = 'msg' + (mine ? ' msg-mine' : '');
  el.innerHTML = `
    <div class="msg-meta">
      <span class="msg-name">${_esc(msg.sender_name)}</span>
      <span class="msg-time">${time}</span>
    </div>
    <div class="msg-text">${_esc(msg.content)}</div>`;

  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

async function sendMsg() {
  const input = document.getElementById('msg-input');
  const btn   = document.getElementById('send-btn');
  const content = input.value.trim();
  if (!content) return;

  btn.disabled = true;
  input.value = '';

  await sb.from('messages').insert({
    sender_id: _currentUser.id,
    sender_name: _displayName,
    content
  });

  btn.disabled = false;
  input.focus();
}
