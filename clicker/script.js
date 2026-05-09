// Clicker script — server-authoritative score via delta saves

async function banSelf() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await sb.from('blacklist').insert({ email: session.user.email }).maybeSingle();
  await sb.auth.signOut();
  window.location.href = '/auth/index.html?banned=1';
}

function getEffectiveCost(up) {
  const n = buyCounts[up.id] || 0;
  return Math.ceil(up.cost * Math.pow(1.15, n));
}

function updateDisplay() {
  scoreDisplay.textContent = formatNumber(Math.floor(score));
  gpcDisplay.textContent = formatNumber(Math.floor(gpc * gpcMultiplier * _staffMult));
  gpsDisplay.textContent = formatNumber(Math.floor(gps * gpsMultiplier * _staffMult));
  updateButtons();
}

function formatNumber(num) {
  if (num >= 1e33) return (num / 1e33).toFixed(1) + "D";
  if (num >= 1e30) return (num / 1e30).toFixed(1) + "N";
  if (num >= 1e27) return (num / 1e27).toFixed(1) + "O";
  if (num >= 1e24) return (num / 1e24).toFixed(1) + "s";
  if (num >= 1e21) return (num / 1e21).toFixed(1) + "S";
  if (num >= 1e18) return (num / 1e18).toFixed(1) + "q";
  if (num >= 1e15) return (num / 1e15).toFixed(1) + "Q";
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "T";
  if (num >= 1e9)  return (num / 1e9).toFixed(1)  + "B";
  if (num >= 1e6)  return (num / 1e6).toFixed(1)  + "M";
  if (num >= 1e3)  return (num / 1e3).toFixed(1)  + "K";
  return Math.floor(num);
}

function updateButtons() {
  upgrades.forEach(up => {
    const button = document.getElementById(up.id);

    if (up.type === 'gpsMulti' && purchasedMults.has(up.id)) {
      button.disabled = true;
      button.classList.remove('affordable', 'unaffordable');
      button.classList.add('one-time-bought');
      const costEl = button.querySelectorAll('p')[1];
      if (costEl) costEl.textContent = '✓ purchased';
      return;
    }

    const cost = up.type === 'gpsMulti' ? up.cost : getEffectiveCost(up);
    const costEl = button.querySelectorAll('p')[1];
    if (costEl) costEl.textContent = 'Cost: ' + formatNumber(Math.ceil(cost));

    if (score >= cost) {
      button.classList.add('affordable');
      button.classList.remove('unaffordable');
    } else {
      button.classList.add('unaffordable');
      button.classList.remove('affordable');
    }
  });
}

let cachedSession = null;
let gameLoaded = false;

async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  cachedSession = session;
  return session;
}

// ── Delta trackers — only these are sent to the server ─────────────────────
let _clicks = 0;           // clicks accumulated since last save
let _pendingPurchases = []; // upgrade IDs bought since last save

function _syncState(state) {
  // Overwrite local vars with server-authoritative values
  score         = state.score;
  gpc           = state.gpc;
  gps           = state.gps;
  gpsMultiplier = state.gpsm;
  gpcMultiplier = state.gpcm;
  Object.assign(buyCounts, state.bc || {});
  purchasedMults.clear();
  (state.pm || []).forEach(id => {
    purchasedMults.add(id);
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = true;
      btn.classList.add('one-time-bought');
      const costEl = btn.querySelectorAll('p')[1];
      if (costEl) costEl.textContent = '✓ purchased';
    }
  });
  updateDisplay();
}

// On page close: fire-and-forget the remaining deltas via keepalive fetch
function saveGameSync() {
  if (!cachedSession || !gameLoaded) return;
  const clicks    = _clicks;
  const purchases = [..._pendingPurchases];
  _clicks = 0;
  _pendingPurchases = [];
  fetch(`${SUPABASE_URL}/rest/v1/rpc/save_clicker_score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + cachedSession.access_token,
    },
    body: JSON.stringify({ p_clicks: clicks, p_purchases: purchases }),
    keepalive: true
  });
}

async function saveGame() {
  const session = await getSession();
  if (!session) return;

  // Snapshot and clear deltas before the async call so rapid clicks/purchases
  // that arrive mid-request are counted in the next save, not double-counted.
  const clicks    = _clicks;
  const purchases = [..._pendingPurchases];
  _clicks = 0;
  _pendingPurchases = [];

  const status = document.getElementById('save-status');
  status.textContent = '⬤ saving...';
  status.className = 'saving';

  const { data: state, error } = await sb.rpc('save_clicker_score', {
    p_clicks: clicks,
    p_purchases: purchases
  });

  if (error) {
    // Put deltas back so they aren't lost
    _clicks += clicks;
    _pendingPurchases = [...purchases, ..._pendingPurchases];
    status.textContent = '⬤ error';
    status.className = '';
    return;
  }

  if (!state || state.banned) {
    cheaterBlocked = true;
    alert('STTTOPPP CHEATTTING');
    status.textContent = '⛔ cheater';
    status.className = '';
    banSelf();
    return;
  }

  _syncState(state);
  status.textContent = '⬤ saved';
  status.className = 'saved';
  setTimeout(() => { status.textContent = '⬤ saved'; status.className = ''; }, 2000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGameSync();
});
window.addEventListener('pagehide', saveGameSync);

async function loadGame() {
  const session = await getSession();
  if (!session) return;
  const { data, error } = await sb.from('scores')
    .select('payload')
    .eq('player_id', session.user.id)
    .eq('game', 'clicker')
    .maybeSingle();
  if (error) {
    console.error('load error:', error);
    gameLoaded = true;
    updateDisplay();
    return;
  }
  if (data?.payload) {
    _syncState({
      score: data.payload.score || 0,
      gpc:   data.payload.gpc   || 1,
      gps:   data.payload.gps   || 0,
      gpsm:  data.payload.gpsm  || 1,
      gpcm:  data.payload.gpcm  || 1,
      bc:    data.payload.bc    || {},
      pm:    data.payload.pm    || [],
    });
  }
  gameLoaded = true;
  updateDisplay();
}

let score = 0;
let gps = 0;
let gpc = 1;
let gpsMultiplier = 1;
let gpcMultiplier = 1;
let _staffMult = 1; // display-only, never saved; server applies its own boost
let cheaterBlocked = false;
const purchasedMults = new Set();
const buyCounts = {};

// Autoclick detection
const _clickLog = [];
function _recordClick() {
  const now = Date.now();
  _clickLog.push(now);
  while (_clickLog.length && now - _clickLog[0] > 2000) _clickLog.shift();

  const lastSec = _clickLog.filter(t => now - t < 1000).length;
  if (lastSec > 25) return true;

  if (_clickLog.length >= 12) {
    const recent = _clickLog.slice(-12);
    const intervals = recent.slice(1).map((t, i) => t - recent[i]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    if (variance < 8 && mean < 60) return true;
  }
  return false;
}

const scoreDisplay = document.getElementById('score');
const gpcDisplay   = document.getElementById('gpc');
const gpsDisplay   = document.getElementById('gps');
const cookie       = document.getElementById('cookie');

const upgrades = [
  { id: 'up1',  type: 'gps', value: 0.25,        cost: 25 },
  { id: 'up2',  type: 'gpc', value: 1,            cost: 100 },
  { id: 'up3',  type: 'gpc', value: 10,           cost: 500 },
  { id: 'up4',  type: 'gps', value: 4,            cost: 1500 },
  { id: 'up5',  type: 'gpc', value: 50,           cost: 2000 },
  { id: 'up6',  type: 'gps', value: 15,           cost: 10000 },
  { id: 'up7',  type: 'gpc', value: 450,          cost: 15000 },
  { id: 'up8',  type: 'gps', value: 50,           cost: 100000 },
  { id: 'up9',  type: 'gps', value: 200,          cost: 200000 },
  { id: 'up10', type: 'gpc', value: 3000,         cost: 1000000 },
  { id: 'up11', type: 'gpc', value: 20000,        cost: 6000000 },
  { id: 'up12', type: 'gps', value: 1000,         cost: 18000000 },
  { id: 'up13', type: 'gpc', value: 100000,       cost: 80000000 },
  { id: 'up14', type: 'gps', value: 10000,        cost: 160000000 },
  { id: 'up15', type: 'gpc', value: 10000000,     cost: 1000000000 },
  { id: 'up16', type: 'gps', value: 500000,       cost: 10000000000 },
  { id: 'up17', type: 'gps', value: 10e6,         cost: 50e9 },
  { id: 'up18', type: 'gpc', value: 200e6,        cost: 200e9 },
  { id: 'up19', type: 'gps', value: 100e6,        cost: 1e12 },
  { id: 'up20', type: 'gpc', value: 2e9,          cost: 5e12 },
  { id: 'up21', type: 'gps', value: 1e9,          cost: 25e12 },
  { id: 'up22', type: 'gpc', value: 20e9,         cost: 125e12 },
  { id: 'up23', type: 'gps', value: 10e9,         cost: 625e12 },
  { id: 'up24', type: 'gpc', value: 200e9,        cost: 3e15 },
  { id: 'up25', type: 'gpsMulti', value: 2,       cost: 20e15 },
  { id: 'up26', type: 'gpsMulti', value: 5,       cost: 200e15 },
  { id: 'up27', type: 'gpsMulti', value: 10,      cost: 2.5e18 },
  { id: 'up28', type: 'gpsMulti', value: 50,      cost: 35e18 },
  { id: 'up29', type: 'gpsMulti', value: 100,     cost: 500e18 },
  { id: 'up30', type: 'gpsMulti', value: 1000,    cost: 1e22 },
  { id: 'up31', type: 'gpsMulti', value: 20000,   cost: 1e24 },
];

updateButtons();
loadGame().then(applyStaffBoost);

async function applyStaffBoost() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('users').select('role').eq('id', session.user.id).single();
  if (data?.role !== 'admin' && data?.role !== 'owner') return;

  // Display hint only — actual 3× bonus is applied server-side in the RPC
  _staffMult = 3;
  updateDisplay();

  const boostBtn = document.createElement('div');
  boostBtn.id = 'staff-boost-btn';
  boostBtn.innerHTML = '👑 Staff Boost active (3×)';
  boostBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(250,204,21,0.15);border:1px solid rgba(250,204,21,0.3);border-radius:8px;color:#fde047;font-family:"JetBrains Mono",monospace;font-size:11px;padding:8px 14px;z-index:99;opacity:0.6;pointer-events:none';
  document.body.appendChild(boostBtn);
}

// Click: increment delta counter, optimistically update local display
cookie.addEventListener("click", () => {
  if (cheaterBlocked) return;
  if (_recordClick()) { cheaterBlocked = true; banSelf(); return; }
  _clicks++;
  score += gpc * gpcMultiplier * _staffMult; // optimistic — server corrects on next save
  updateDisplay();
});

cookie.addEventListener("click", (e) => {
  const popup = document.createElement("div");
  popup.textContent = "+" + formatNumber(Math.floor(gpc * gpcMultiplier * _staffMult));
  popup.style.cssText = `
    position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
    font-size: 20px; font-weight: bold; color: #e5e7eb;
    pointer-events: none; animation: floatUp 1s ease-out forwards; z-index: 999;
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);

  for (let i = 0; i < 6; i++) {
    const mini = document.createElement("img");
    mini.src = "cookie.png";
    mini.style.cssText = `
      position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
      width: 30px; height: 30px; pointer-events: none; z-index: 999;
    `;
    document.body.appendChild(mini);
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const dx = Math.cos(angle) * (40 + Math.random() * 40);
    let posX = e.clientX, posY = e.clientY, velY = -3 - Math.random() * 3, opacity = 1;
    const fall = setInterval(() => {
      velY += 0.5; posX += dx * 0.05; posY += velY; opacity -= 0.03;
      mini.style.left = posX + "px"; mini.style.top = posY + "px"; mini.style.opacity = opacity;
      if (opacity <= 0) { clearInterval(fall); mini.remove(); }
    }, 16);
  }
});

// Purchase: queue ID as delta, optimistically update local display
upgrades.forEach(up => {
  const button = document.getElementById(up.id);
  button.addEventListener("click", () => {
    if (up.type === 'gpsMulti' && purchasedMults.has(up.id)) return;
    const cost = up.type === 'gpsMulti' ? up.cost : getEffectiveCost(up);
    if (score < cost) return;
    _pendingPurchases.push(up.id); // tell server about this purchase
    score -= cost;
    if (up.type === 'gps') {
      gps += up.value;
      buyCounts[up.id] = (buyCounts[up.id] || 0) + 1;
    } else if (up.type === 'gpc') {
      gpc += up.value;
      buyCounts[up.id] = (buyCounts[up.id] || 0) + 1;
    } else if (up.type === 'gpsMulti') {
      gpsMultiplier *= up.value;
      gpcMultiplier *= up.value;
      purchasedMults.add(up.id);
      button.disabled = true;
    }
    button.classList.add('purchased');
    setTimeout(() => button.classList.remove('purchased'), 400);
    updateDisplay();
  });
});

setInterval(() => { if (!cheaterBlocked) score += (gps * gpsMultiplier * _staffMult) / 60; }, 1000 / 60);
setInterval(updateDisplay, 100);
setInterval(() => { if (gameLoaded) saveGame(); }, 1000);
