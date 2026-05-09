const MAIN_ID = '00000000-0000-0000-0000-000000000001';

let me = null;
let meRow = null;
let activeConvId = null;
let msgChannel = null;
let typingChannel = null;
let realNameMap = {};
let replyingTo = null;
let _typingTimer = null;
let _typingGen   = 0;
let _iAmTyping   = false;

function _updateTypingUI() {
  if (!typingChannel) return;
  const state = typingChannel.presenceState();
  const typers = Object.entries(state)
    .filter(([key]) => key !== me?.id)
    .flatMap(([, presences]) => presences)
    .filter(p => p.typing && p.name)
    .map(p => p.name);
  const el = document.getElementById('typing-indicator');
  if (!typers.length) {
    el.innerHTML = '';
  } else {
    const names = typers.length > 2
      ? typers.slice(0, 2).join(', ') + ` and ${typers.length - 2} more`
      : typers.join(' and ');
    el.innerHTML = `<span>${names} ${typers.length === 1 ? 'is' : 'are'} typing</span><span class="typing-dots"><span></span><span></span><span></span></span>`;
  }
}

// ── Context menu ──────────────────────────────────────────────────────────────
let ctxMsg = null;
let editingMsg = null; // msg object currently being edited
let _ctxX = 0, _ctxY = 0;

function showCtxMenu(e, msg, canDelete) {
  e.preventDefault();
  e.stopPropagation();
  ctxMsg = msg;
  const menu = document.getElementById('msg-ctx-menu');
  const isMine = msg.sender_id === me.id;
  document.getElementById('ctx-delete').style.display = (canDelete && !msg.deleted) ? '' : 'none';
  document.getElementById('ctx-edit').style.display   = (isMine && !msg.deleted) ? '' : 'none';
  document.getElementById('ctx-react').style.display  = !msg.deleted ? '' : 'none';
  document.getElementById('ctx-copy').style.display   = !msg.deleted ? '' : 'none';
  document.getElementById('ctx-reply').style.display  = !msg.deleted ? '' : 'none';
  _ctxX = Math.min(e.clientX, window.innerWidth - 170);
  _ctxY = Math.min(e.clientY, window.innerHeight - 200);
  menu.style.left = _ctxX + 'px';
  menu.style.top  = _ctxY + 'px';
  menu.classList.add('open');
}

function hideCtxMenu() {
  document.getElementById('msg-ctx-menu').classList.remove('open');
  ctxMsg = null;
}

function ctxReply() {
  if (!ctxMsg || ctxMsg.deleted) return;
  setReply(ctxMsg.id, ctxMsg.sender_name, ctxMsg.content);
  hideCtxMenu();
}

function ctxCopy() {
  if (!ctxMsg) return;
  navigator.clipboard.writeText(ctxMsg.content).catch(() => {});
  hideCtxMenu();
}

function ctxDelete() {
  if (!ctxMsg) return;
  deleteMsg(ctxMsg.id);
  hideCtxMenu();
}

// ── React ─────────────────────────────────────────────────────────────────────
function ctxReact() {
  if (!ctxMsg || ctxMsg.deleted) return;
  const picker = document.getElementById('emoji-picker');
  picker._pendingMsg = ctxMsg; // save before hideCtxMenu nulls ctxMsg
  const x = _ctxX;
  const y = _ctxY;
  hideCtxMenu();
  // defer so the click event finishes bubbling before we open the picker
  // (otherwise the document click handler immediately closes it again)
  setTimeout(() => {
    picker.classList.add('open');
    const pw = picker.offsetWidth  || 290;
    const ph = picker.offsetHeight || 60;
    // prefer above the click point, fall back to below if not enough room
    let py = y - ph - 8;
    if (py < 8) py = y + 8;
    let px = Math.min(x, window.innerWidth - pw - 8);
    if (px < 8) px = 8;
    picker.style.left = px + 'px';
    picker.style.top  = py + 'px';
  }, 0);
}

async function pickEmoji(emoji) {
  const picker = document.getElementById('emoji-picker');
  const msg = picker._pendingMsg;
  picker.classList.remove('open');
  picker._pendingMsg = null;
  if (!msg) return;
  await sb.rpc('toggle_reaction', { p_msg_id: msg.id, p_emoji: emoji });
}

async function toggleReaction(msgId, emoji) {
  await sb.rpc('toggle_reaction', { p_msg_id: msgId, p_emoji: emoji });
}

document.addEventListener('click', e => {
  hideCtxMenu();
  if (!document.getElementById('emoji-picker').contains(e.target))
    document.getElementById('emoji-picker').classList.remove('open');
});
document.addEventListener('contextmenu', hideCtxMenu);

// ── Edit ──────────────────────────────────────────────────────────────────────
function ctxEdit() {
  if (!ctxMsg || ctxMsg.sender_id !== me.id || ctxMsg.deleted) return;
  const msg = ctxMsg;
  hideCtxMenu();
  const bubble = document.querySelector(`#msg-${msg.id} .msg-bubble`);
  if (!bubble) return;
  editingMsg = msg;
  bubble.dataset.origHtml = bubble.innerHTML;
  bubble.innerHTML = `
    <textarea class="edit-input" rows="3">${_esc(msg.content)}</textarea>
    <div class="edit-actions">
      <button class="save-btn" onclick="saveEdit('${msg.id}')">Save</button>
      <button onclick="cancelEdit('${msg.id}')">Cancel</button>
    </div>`;
  const ta = bubble.querySelector('.edit-input');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); }
    if (e.key === 'Escape') cancelEdit(msg.id);
  });
}

async function saveEdit(msgId) {
  const bubble = document.querySelector(`#msg-${msgId} .msg-bubble`);
  if (!bubble) return;
  const newContent = bubble.querySelector('.edit-input')?.value.trim();
  if (!newContent) return;
  await sb.rpc('edit_chat_message', { p_msg_id: msgId, p_content: newContent });
  editingMsg = null;
}

function cancelEdit(msgId) {
  const bubble = document.querySelector(`#msg-${msgId} .msg-bubble`);
  if (!bubble) return;
  bubble.innerHTML = bubble.dataset.origHtml || '';
  editingMsg = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _linkify(s) {
  return _esc(s).replace(
    /(https?:\/\/[^\s<>&"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}
function _avatarColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h << 5) - h + c.charCodeAt(0);
  return `hsl(${Math.abs(h) % 360},55%,40%)`;
}
function _initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function _time(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function _renderReactions(reactions, msgId) {
  if (!reactions) return '';
  const entries = Object.entries(reactions).filter(([, users]) => users?.length);
  if (!entries.length) return '';
  const badges = entries.map(([emoji, users]) => {
    const isMine = me && users.includes(me.id);
    return `<span class="reaction-badge${isMine ? ' mine' : ''}" onclick="toggleReaction('${msgId}','${emoji}')">${emoji} ${users.length}</span>`;
  }).join('');
  return `<div class="msg-reactions">${badges}</div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  me = session.user;

  const { data } = await sb.from('users').select('display_name, email, role, protected').eq('id', me.id).single();
  meRow = data;

  if (meRow?.role === 'owner') {
    const [{ data: nameRows }, { data: userRows }] = await Promise.all([
      sb.from('student_name_map').select('email, name'),
      sb.from('users').select('id, email')
    ]);
    const emailToName = {};
    (nameRows || []).forEach(r => { emailToName[r.email] = r.name; });
    (userRows || []).forEach(r => { if (emailToName[r.email]) realNameMap[r.id] = emailToName[r.email]; });
  }

  openConv(MAIN_ID);
  await loadPrivateConvs();

  // Enter to send
  document.getElementById('msg-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });

  // Message search
  document.getElementById('msg-search').addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    document.querySelectorAll('#messages-area .msg-group').forEach(el => {
      if (!q) {
        el.classList.remove('search-hidden');
        // remove any highlights
        el.querySelectorAll('.msg-search-highlight').forEach(h => {
          h.replaceWith(document.createTextNode(h.textContent));
        });
        return;
      }
      const bubble = el.querySelector('.msg-bubble');
      if (!bubble) return;
      const text = bubble.textContent.toLowerCase();
      el.classList.toggle('search-hidden', !text.includes(q));
    });
  });

  // Typing indicator broadcast
  const _msgInput = document.getElementById('msg-input');
  _msgInput.addEventListener('input', () => {
    if (!activeConvId || !typingChannel) return;
    _iAmTyping = true;
    _updateTypingUI();
    typingChannel.track({ typing: true, name: meRow?.display_name || me?.email || '…' });
    clearTimeout(_typingTimer);
    const gen = _typingGen; // capture so timer knows if conv switched
    _typingTimer = setTimeout(() => {
      if (gen !== _typingGen) return; // conv switched, ignore
      _iAmTyping = false;
      if (typingChannel) typingChannel.untrack();
      _updateTypingUI();
    }, 2000);
  });
  _msgInput.addEventListener('blur', () => {
    clearTimeout(_typingTimer);
    _iAmTyping = false;
    if (typingChannel) typingChannel.untrack();
    _updateTypingUI();
  });

  // Modal search input
  const chatSearchInput = document.getElementById('chat-search-input');
  let chatSearchTimer;
  chatSearchInput.addEventListener('input', () => {
    clearTimeout(chatSearchTimer);
    const q = chatSearchInput.value.trim();
    const results = document.getElementById('chat-search-results');
    if (!q) { results.classList.remove('open'); results.innerHTML = ''; return; }
    chatSearchTimer = setTimeout(() => doModalSearch(q), 300);
  });

  // Close modal on overlay click
  document.getElementById('chat-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('chat-modal-overlay')) closeNewChatModal();
  });

  // New private conv realtime
  sb.channel('new-conv-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members' }, async payload => {
      if (payload.new.user_id === me.id) await loadPrivateConvs();
    })
    .subscribe();

  setInterval(loadPrivateConvs, 8000);
})();

// ── Conversations ─────────────────────────────────────────────────────────────
async function loadPrivateConvs() {
  const { data, error } = await sb.rpc('get_my_conversations');
  const el = document.getElementById('private-convs');
  if (error) { console.error('loadPrivateConvs error:', error); return; }
  if (!data || !data.length) { el.innerHTML = ''; return; }

  // Deduplicate by conversation_id — RPC may return one row per member
  // Prefer rows that have a conv_name set
  const seen = new Map();
  for (const c of data) {
    const existing = seen.get(c.conversation_id);
    if (!existing || (!existing.conv_name && c.conv_name)) {
      seen.set(c.conversation_id, c);
    }
  }
  const convs = Array.from(seen.values());

  // Sort by last_message_at descending (most recent first)
  convs.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at) : new Date(0);
    const tb = b.last_message_at ? new Date(b.last_message_at) : new Date(0);
    return tb - ta;
  });

  el.innerHTML = convs.map(c => {
    const name = c.conv_name || c.other_display_name || c.other_email || '?';
    const initials = c.conv_name ? c.conv_name.slice(0,2).toUpperCase() : _initials(c.other_display_name || c.other_email);
    const preview = c.last_message ? _esc(c.last_message.slice(0, 40)) : 'No messages yet';
    const color = c.conv_name ? _avatarColor(c.conversation_id) : _avatarColor(c.other_user_id || c.conversation_id);
    const active = activeConvId === c.conversation_id ? ' active' : '';
    const unread = c.last_message_at && c.sender_id !== me.id &&
      (!c.last_read_at || new Date(c.last_message_at) > new Date(c.last_read_at));
    return `<div class="conv-item${active}" id="conv-${c.conversation_id}" onclick="openConv('${c.conversation_id}')">
      <div class="conv-avatar" style="background:${color}">${_esc(initials)}</div>
      <div class="conv-info">
        <div class="conv-name">${_esc(name)}</div>
        <div class="conv-preview${unread ? ' unread' : ''}">${preview}</div>
      </div>
      ${unread ? '<span class="conv-unread-badge">NEW</span>' : ''}
    </div>`;
  }).join('');
}

async function openConv(convId) {
  activeConvId = convId;

  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  document.getElementById(convId === MAIN_ID ? 'conv-main' : `conv-${convId}`)?.classList.add('active');

  const titleEl = document.getElementById('conv-title');
  const subEl = document.getElementById('conv-subtitle');
  document.getElementById('edit-conv-btn')?.remove();

  if (convId === MAIN_ID) {
    titleEl.textContent = 'Main Chat';
    subEl.textContent = 'Everyone';
  } else {
    const { data } = await sb.rpc('get_my_conversations');
    const c = data?.find(x => x.conversation_id === convId);

    // Fetch name directly too in case RPC doesn't return it
    const { data: convRow } = await sb.from('conversations').select('name').eq('id', convId).single();
    const convName = convRow?.name || null;

    const displayName = convName || c?.other_display_name || c?.other_email || 'Private Chat';
    titleEl.textContent = displayName;
    subEl.textContent = convName ? 'Group chat' : 'Private';

    const editBtn = document.createElement('button');
    editBtn.id = 'edit-conv-btn';
    editBtn.textContent = '⚙';
    editBtn.title = 'Edit chat';
    editBtn.onclick = () => openEditModal(convId, displayName);
    document.getElementById('conv-header').appendChild(editBtn);
  }

  const area = document.getElementById('messages-area');
  area.innerHTML = `
    <div class="skeleton-messages">
      ${[1,0.7,0.9,0.5,0.8].map((w,i) => `
        <div class="sk-row ${i%2===0?'sk-mine':''}">
          <div class="sk-avatar"></div>
          <div class="sk-bubble" style="width:${Math.round(w*180+40)}px"></div>
        </div>`).join('')}
    </div>`;

  const { data: msgs } = await sb.from('chat_messages')
    .select('*').eq('conversation_id', convId)
    .order('created_at', { ascending: true }).limit(100);

  renderMessages(msgs || []);

  if (convId !== MAIN_ID) {
    sb.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId).eq('user_id', me.id)
      .then(() => {
        document.querySelector(`#conv-${convId} .conv-unread-badge`)?.remove();
        document.querySelector(`#conv-${convId} .conv-preview`)?.classList.remove('unread');
      });
  }

  if (msgChannel)    { sb.removeChannel(msgChannel);    msgChannel    = null; }
  if (typingChannel) { sb.removeChannel(typingChannel); typingChannel = null; }
  document.getElementById('typing-indicator').textContent = '';

  // Typing presence channel
  _iAmTyping = false;
  ++_typingGen;
  typingChannel = sb.channel(`typing-${convId}`, { config: { presence: { key: me.id } } });

  typingChannel
    .on('presence', { event: 'sync'  }, _updateTypingUI)
    .on('presence', { event: 'join'  }, _updateTypingUI)
    .on('presence', { event: 'leave' }, () => setTimeout(_updateTypingUI, 60))
    .subscribe();

  msgChannel = sb.channel(`msgs-${convId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
      if (payload.new.conversation_id === activeConvId) appendMessage(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, payload => {
      if (payload.new.conversation_id === activeConvId) updateMessage(payload.new);
    })
    .subscribe();
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function _dateLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function renderMessages(msgs) {
  const area = document.getElementById('messages-area');
  area.innerHTML = '';
  msgs.forEach(m => appendMessage(m, false));
  area.scrollTop = area.scrollHeight;
}

function appendMessage(msg, scroll = true) {
  const area = document.getElementById('messages-area');
  // Find the last msg-group (not a divider) to check its date
  const groups = area.querySelectorAll('.msg-group');
  const lastTs = groups.length ? groups[groups.length - 1].dataset.ts : null;
  if (!lastTs || new Date(lastTs).toDateString() !== new Date(msg.created_at).toDateString()) {
    const div = document.createElement('div');
    div.className = 'date-divider';
    div.textContent = _dateLabel(msg.created_at);
    area.appendChild(div);
  }
  const el = buildMsgEl(msg);
  el.dataset.ts = msg.created_at;
  area.appendChild(el);
  if (scroll) area.scrollTop = area.scrollHeight;
}

function updateMessage(msg) {
  const existing = document.getElementById(`msg-${msg.id}`);
  if (existing) existing.replaceWith(buildMsgEl(msg));
}

function buildMsgEl(msg) {
  const isMine = msg.sender_id === me.id;
  const isMod = meRow?.role === 'admin' || meRow?.role === 'owner';
  const canDelete = isMine || isMod;

  const wrap = document.createElement('div');
  wrap.className = `msg-group${isMine ? ' mine' : ''}`;
  wrap.id = `msg-${msg.id}`;

  if (msg.deleted) {
    wrap.innerHTML = `
      <div class="msg-avatar deleted">??</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-sender deleted">deleted</span>
          <span class="msg-time">${_time(msg.created_at)}</span>
        </div>
        <div class="msg-bubble deleted">This message was deleted.</div>
      </div>`;
  } else {
    const color = _avatarColor(msg.sender_id);
    const initials = _initials(msg.sender_name);
    const realName = realNameMap[msg.sender_id];
    const realNameTag = realName
      ? `<span style="font-size:10px;color:#86efac;font-weight:600;margin-left:5px">(${_esc(realName)})</span>`
      : '';
    const replyPreview = msg.reply_to_id ? `
      <div class="msg-reply-preview">
        <span class="reply-sender">${_esc(msg.reply_to_sender)}</span>
        <span class="reply-text">${_esc((msg.reply_to_content || '').slice(0, 80))}</span>
      </div>` : '';

    const editedTag = msg.edited ? '<span class="msg-edited">(edited)</span>' : '';
    const reactionsHtml = _renderReactions(msg.reactions, msg.id);

    wrap.innerHTML = `
      <div class="msg-avatar" style="background:${color}">${_esc(initials)}</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-sender">${_esc(msg.sender_name)}</span>${realNameTag}
          <span class="msg-time">${_time(msg.created_at)}</span>${editedTag}
        </div>
        <div class="msg-bubble">${replyPreview}${_linkify(msg.content)}</div>
        ${reactionsHtml}
      </div>`;

    // Right-click context menu on bubble
    wrap.querySelector('.msg-bubble').addEventListener('contextmenu', e => {
      showCtxMenu(e, msg, canDelete);
    });
  }
  return wrap;
}

// ── Reply ─────────────────────────────────────────────────────────────────────
function setReply(id, senderName, content) {
  replyingTo = { id, sender_name: senderName, content };
  document.getElementById('reply-bar-sender').textContent = senderName;
  document.getElementById('reply-bar-text').textContent = content.slice(0, 80);
  document.getElementById('reply-bar').style.display = 'flex';
  document.getElementById('msg-input').focus();
}

function cancelReply() {
  replyingTo = null;
  document.getElementById('reply-bar').style.display = 'none';
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !activeConvId) return;
  input.value = '';
  clearTimeout(_typingTimer);
  _iAmTyping = false;
  if (typingChannel) typingChannel.untrack();
  _updateTypingUI();

  const senderName = meRow?.display_name || meRow?.email || me.email;
  const row = { conversation_id: activeConvId, sender_id: me.id, sender_name: senderName, content };
  if (replyingTo) {
    row.reply_to_id = replyingTo.id;
    row.reply_to_sender = replyingTo.sender_name;
    row.reply_to_content = replyingTo.content;
    cancelReply();
  }
  const { error } = await sb.from('chat_messages').insert(row);
  if (error) { input.value = content; alert('Send failed: ' + error.message); }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteMsg(msgId) {
  await sb.from('chat_messages').update({ deleted: true }).eq('id', msgId);
}

// ── New / edit chat modal ─────────────────────────────────────────────────────
let modalMode = 'create'; // 'create' | 'edit'
let modalConvId = null;
let selectedUsers = [];

function openNewChatModal() {
  modalMode = 'create';
  modalConvId = null;
  selectedUsers = [];
  document.getElementById('chat-modal-title').textContent = 'New Chat';
  document.getElementById('chat-name-input').value = '';
  document.getElementById('chat-name-input').placeholder = 'Chat name (optional)';
  document.getElementById('chat-modal-submit').textContent = 'Create Chat';
  _renderSelectedUsers();
  _clearModalSearch();
  document.getElementById('chat-modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('chat-search-input').focus(), 50);
}

function openEditModal(convId, currentName) {
  modalMode = 'edit';
  modalConvId = convId;
  selectedUsers = [];
  document.getElementById('chat-modal-title').textContent = 'Edit Chat';
  document.getElementById('chat-name-input').value = currentName !== 'Private' && currentName !== 'Group chat' ? currentName : '';
  document.getElementById('chat-name-input').placeholder = 'Rename chat…';
  document.getElementById('chat-modal-submit').textContent = 'Save';
  _renderSelectedUsers();
  _clearModalSearch();
  document.getElementById('chat-modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('chat-name-input').focus(), 50);
}

function closeNewChatModal() {
  document.getElementById('chat-modal-overlay').style.display = 'none';
  _clearModalSearch();
  selectedUsers = [];
}

function _clearModalSearch() {
  document.getElementById('chat-search-input').value = '';
  const results = document.getElementById('chat-search-results');
  results.classList.remove('open');
  results.innerHTML = '';
}

function _renderSelectedUsers() {
  const el = document.getElementById('selected-users');
  if (!selectedUsers.length) { el.innerHTML = ''; return; }
  el.innerHTML = selectedUsers.map(u => {
    const name = _esc(u.display_name || u.email);
    return `<div class="selected-chip">
      <span>${name}</span>
      <button onclick="removeSelectedUser('${u.id}')">✕</button>
    </div>`;
  }).join('');
}

function removeSelectedUser(uid) {
  selectedUsers = selectedUsers.filter(u => u.id !== uid);
  _renderSelectedUsers();
}

function _addSelectedUser(user) {
  if (user.id === me.id) return;
  if (!selectedUsers.find(u => u.id === user.id)) {
    selectedUsers.push(user);
    _renderSelectedUsers();
  }
  document.getElementById('chat-search-input').value = '';
  document.getElementById('chat-search-results').classList.remove('open');
  document.getElementById('chat-search-results').innerHTML = '';
  document.getElementById('chat-search-input').focus();
}

const _modalUserCache = {};

async function doModalSearch(q) {
  const results = document.getElementById('chat-search-results');
  const { data } = await sb.rpc('search_users', { query: q });
  if (!data || !data.length) {
    results.innerHTML = '<div class="search-item" style="color:#475569">No users found</div>';
    results.classList.add('open');
    return;
  }
  // Store users by id so onclick can look them up safely (no JSON in attribute)
  data.forEach(u => { _modalUserCache[u.id] = u; });
  results.innerHTML = data.map(u => {
    const name = u.display_name || u.email;
    const color = _avatarColor(u.id);
    const alreadyAdded = !!selectedUsers.find(s => s.id === u.id);
    return `<div class="search-item${alreadyAdded ? ' already-added' : ''}" data-uid="${u.id}">
      <div class="conv-avatar" style="background:${color};width:28px;height:28px;font-size:10px">${_esc(_initials(name))}</div>
      <div>
        <div class="si-name">${_esc(name)}</div>
        <div class="si-email">${_esc(u.email)}</div>
      </div>
      ${alreadyAdded ? '<span style="color:#475569;font-size:10px">Added</span>' : ''}
    </div>`;
  }).join('');
  results.classList.add('open');
  // Use event delegation — no inline JSON in onclick
  results.querySelectorAll('.search-item[data-uid]').forEach(el => {
    el.addEventListener('click', () => {
      const u = _modalUserCache[el.dataset.uid];
      if (u) _addSelectedUser(u);
    });
  });
}

async function submitChatModal() {
  const name = document.getElementById('chat-name-input').value.trim() || null;

  if (modalMode === 'edit') {
    const tasks = [];
    if (name !== null) {
      tasks.push(sb.from('conversations').update({ name }).eq('id', modalConvId));
    }
    for (const u of selectedUsers) {
      tasks.push(sb.rpc('add_member_to_conversation', { conv_id: modalConvId, new_user_id: u.id }));
    }
    await Promise.all(tasks);
    closeNewChatModal();
    await loadPrivateConvs();
    if (activeConvId === modalConvId) await openConv(modalConvId);
    return;
  }

  // Create mode
  if (!selectedUsers.length) {
    document.getElementById('chat-search-input').focus();
    return;
  }

  let convId;
  if (selectedUsers.length === 1 && !name) {
    const { data, error } = await sb.rpc('get_or_create_conversation', { other_user_id: selectedUsers[0].id });
    if (error) { alert('Could not create: ' + error.message); return; }
    convId = data;
  } else {
    const { data, error } = await sb.rpc('create_group_conversation', {
      p_user_ids: selectedUsers.map(u => u.id),
      p_name: name
    });
    if (error) { alert('Could not create: ' + error.message); return; }
    convId = data;
  }

  closeNewChatModal();
  await loadPrivateConvs();
  await openConv(convId);
}
