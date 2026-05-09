// infinite/script.js — Infinite Craft

const STARTERS = [
  { element: 'Water', emoji: '💧' },
  { element: 'Fire',  emoji: '🔥' },
  { element: 'Wind',  emoji: '🌬️' },
  { element: 'Earth', emoji: '🌍' },
];

let _user        = null;
let _userId      = null;
let _discoveries = [];
let _combining   = false;
let _zTop        = 10;

// ── Global drag state ─────────────────────────────────────────────────────────
// One object tracks whatever is being dragged right now.
let _drag = null;
// { node, offsetX, offsetY, fromSidebar, element, emoji }

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  _user   = session.user;
  _userId = _user.id;

  await _loadDiscoveries();
  _renderSidebar();

  document.getElementById('ic-search').addEventListener('input', _renderSidebar);
})();

// ── Global pointer handlers ───────────────────────────────────────────────────

function _getXY(e) {
  if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

document.addEventListener('mousemove', _onDragMove);
document.addEventListener('mouseup',   _onDragEnd);

document.addEventListener('touchmove', e => {
  if (_drag) { e.preventDefault(); _onDragMove(e); }
}, { passive: false });
document.addEventListener('touchend', _onDragEnd);

function _onDragMove(e) {
  if (!_drag) return;
  const { x, y } = _getXY(e);
  const canvas = document.getElementById('ic-canvas');
  const rect   = canvas.getBoundingClientRect();

  const nx = x - rect.left - _drag.offsetX;
  const ny = y - rect.top  - _drag.offsetY;

  _drag.node.style.left = nx + 'px';
  _drag.node.style.top  = ny + 'px';

  // Highlight potential combine target
  const over = _findOverlap(_drag.node);
  canvas.querySelectorAll('.ic-node').forEach(n => {
    n.classList.toggle('ic-node-target', n === over);
  });
}

function _onDragEnd(e) {
  if (!_drag) return;
  const node = _drag.node;
  const fromSidebar = _drag.fromSidebar;
  _drag = null;

  node.classList.remove('ic-dragging');
  document.body.style.userSelect = '';

  const canvas = document.getElementById('ic-canvas');
  canvas.querySelectorAll('.ic-node').forEach(n => n.classList.remove('ic-node-target'));

  // If dragged from sidebar but dropped outside canvas area, remove it
  const cRect = canvas.getBoundingClientRect();
  const nRect = node.getBoundingClientRect();
  const onCanvas = nRect.left < cRect.right && nRect.right > cRect.left &&
                   nRect.top  < cRect.bottom && nRect.bottom > cRect.top;
  if (!onCanvas) {
    node.remove();
    return;
  }

  // Check for combine
  const over = _findOverlap(node);
  if (over) _triggerCombine(node, over);
}

// ── Discoveries ───────────────────────────────────────────────────────────────

async function _loadDiscoveries() {
  const { data } = await sb
    .from('craft_discoveries')
    .select('element, emoji, discovered_at')
    .eq('user_id', _userId)
    .order('discovered_at', { ascending: true });

  if (!data || data.length === 0) {
    await sb.from('craft_discoveries').insert(
      STARTERS.map(s => ({ user_id: _userId, element: s.element, emoji: s.emoji }))
    );
    _discoveries = [...STARTERS];
  } else {
    _discoveries = data.map(r => ({ element: r.element, emoji: r.emoji }));
    for (const s of STARTERS) {
      if (!_discoveries.find(d => d.element === s.element)) {
        await sb.from('craft_discoveries').upsert({ user_id: _userId, element: s.element, emoji: s.emoji });
        _discoveries.unshift(s);
      }
    }
  }
}

function _addDiscovery(element, emoji) {
  if (!_discoveries.find(d => d.element === element)) {
    _discoveries.push({ element, emoji });
    _renderSidebar();
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function _renderSidebar() {
  const q     = (document.getElementById('ic-search')?.value ?? '').toLowerCase();
  const list  = document.getElementById('ic-elem-list');
  const count = document.getElementById('ic-count');

  count.textContent = `${_discoveries.length} element${_discoveries.length !== 1 ? 's' : ''}`;

  const filtered = _discoveries.filter(d => !q || d.element.toLowerCase().includes(q));

  list.innerHTML = filtered
    .map(d => `<div class="ic-pill" data-elem="${_esc(d.element)}" data-emoji="${_esc(d.emoji)}">${d.emoji} ${_esc(d.element)}</div>`)
    .join('');

  list.querySelectorAll('.ic-pill').forEach(pill => {
    // Click → spawn at random canvas position
    pill.addEventListener('click', () => {
      _spawnNode(pill.dataset.elem, pill.dataset.emoji);
    });

    // Drag from sidebar → spawn node that follows cursor
    pill.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      _startSidebarDrag(e.clientX, e.clientY, pill.dataset.elem, pill.dataset.emoji);
    });
    pill.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      _startSidebarDrag(t.clientX, t.clientY, pill.dataset.elem, pill.dataset.emoji);
    }, { passive: false });
  });
}

function _startSidebarDrag(clientX, clientY, element, emoji) {
  const canvas = document.getElementById('ic-canvas');
  const rect   = canvas.getBoundingClientRect();

  // Create node immediately at cursor position
  const node = _createNode(element, emoji);
  const nx   = clientX - rect.left - 30;
  const ny   = clientY - rect.top  - 16;
  node.style.left = nx + 'px';
  node.style.top  = ny + 'px';

  node.classList.add('ic-dragging');
  document.body.style.userSelect = 'none';

  _drag = { node, offsetX: 30, offsetY: 16, fromSidebar: true, element, emoji };
}

// ── Canvas nodes ──────────────────────────────────────────────────────────────

function _spawnNode(element, emoji, x, y) {
  const canvas = document.getElementById('ic-canvas');
  const hint   = document.getElementById('ic-hint');
  if (hint) hint.remove();

  if (x == null) {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    x = 60  + Math.random() * Math.max(cw - 200, 40);
    y = 20  + Math.random() * Math.max(ch - 80,  20);
  }

  const node = _createNode(element, emoji);
  node.style.left = x + 'px';
  node.style.top  = y + 'px';

  requestAnimationFrame(() => node.classList.add('ic-node-in'));
  return node;
}

function _createNode(element, emoji) {
  const canvas = document.getElementById('ic-canvas');
  const hint   = document.getElementById('ic-hint');
  if (hint) hint.remove();

  const node = document.createElement('div');
  node.className = 'ic-node';
  node.dataset.element = element;
  node.dataset.emoji   = emoji;
  node.textContent = `${emoji} ${element}`;
  node.style.zIndex    = ++_zTop;
  canvas.appendChild(node);

  // Drag starts on mousedown / touchstart on the node itself
  node.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    _startNodeDrag(e.clientX, e.clientY, node);
  });
  node.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    _startNodeDrag(t.clientX, t.clientY, node);
  }, { passive: false });

  // Double-click / double-tap → remove
  let lastTap = 0;
  node.addEventListener('dblclick', () => _removeNode(node));
  node.addEventListener('touchend', () => {
    const now = Date.now();
    if (now - lastTap < 300) _removeNode(node);
    lastTap = now;
  });

  return node;
}

function _startNodeDrag(clientX, clientY, node) {
  const canvas = document.getElementById('ic-canvas');
  const rect   = canvas.getBoundingClientRect();
  const nodeX  = parseInt(node.style.left) || 0;
  const nodeY  = parseInt(node.style.top)  || 0;

  // offsetX/Y = cursor position relative to node's top-left
  const offsetX = clientX - rect.left - nodeX;
  const offsetY = clientY - rect.top  - nodeY;

  node.style.zIndex = ++_zTop;
  node.classList.add('ic-dragging');
  document.body.style.userSelect = 'none';

  _drag = { node, offsetX, offsetY, fromSidebar: false };
}

function _removeNode(node) {
  node.classList.add('ic-node-out');
  setTimeout(() => node.remove(), 200);
}

function _findOverlap(dragging) {
  const canvas = document.getElementById('ic-canvas');
  const r1 = dragging.getBoundingClientRect();
  for (const node of canvas.querySelectorAll('.ic-node')) {
    if (node === dragging) continue;
    const r2 = node.getBoundingClientRect();
    if (r1.left < r2.right && r1.right > r2.left &&
        r1.top  < r2.bottom && r1.bottom > r2.top) return node;
  }
  return null;
}

// ── Combining ─────────────────────────────────────────────────────────────────

async function _triggerCombine(nodeA, nodeB) {
  if (_combining) return;
  _combining = true;

  const a = nodeA.dataset.element;
  const b = nodeB.dataset.element;

  nodeA.style.left = nodeB.style.left;
  nodeA.style.top  = nodeB.style.top;

  nodeA.classList.add('ic-combining');
  nodeB.classList.add('ic-combining');
  document.getElementById('ic-loading').style.display = 'flex';

  try {
    const { data, error } = await sb.functions.invoke('craft-combine', {
      body: { a, b, user_id: _userId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    nodeA.classList.remove('ic-combining');
    nodeB.classList.remove('ic-combining');
    document.getElementById('ic-loading').style.display = 'none';

    if (!data.result) {
      nodeA.classList.add('ic-shake');
      nodeB.classList.add('ic-shake');
      setTimeout(() => {
        nodeA.classList.remove('ic-shake');
        nodeB.classList.remove('ic-shake');
        nodeA.style.left = (parseInt(nodeB.style.left) + 130) + 'px';
      }, 500);
      _toast('✖ Nothing happens');
    } else {
      const rx = parseInt(nodeB.style.left) || 0;
      const ry = parseInt(nodeB.style.top)  || 0;
      nodeA.classList.add('ic-node-out');
      nodeB.classList.add('ic-node-out');
      setTimeout(() => { nodeA.remove(); nodeB.remove(); }, 200);

      const result = _spawnNode(data.result, data.emoji, rx, ry);
      if (data.isNew) {
        _addDiscovery(data.result, data.emoji);
        result.classList.add('ic-node-new');
        _toast(`✨ New discovery: ${data.emoji} ${data.result}!`);
      }
    }
  } catch (err) {
    document.getElementById('ic-loading').style.display = 'none';
    nodeA.classList.remove('ic-combining');
    nodeB.classList.remove('ic-combining');
    const msg = err?.message || err?.error_description || JSON.stringify(err);
    _toast('⚠ ' + msg);
    console.error('craft-combine error:', err);
  }

  _combining = false;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;
function _toast(msg) {
  const el = document.getElementById('ic-toast');
  el.textContent = msg;
  el.classList.add('ic-toast-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('ic-toast-show'), 2800);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
