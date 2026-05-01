// Clicker script with Supabase save/load

function getEffectiveCost(up) {
  const n = buyCounts[up.id] || 0;
  return Math.ceil(up.cost * Math.pow(1.15, n));
}

function updateDisplay() {
  scoreDisplay.textContent = formatNumber(Math.floor(score));
  gpcDisplay.textContent = formatNumber(Math.floor(gpc));
  gpsDisplay.textContent = formatNumber(Math.floor(gps * gpsMultiplier));
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

let cachedToken = null;

async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  cachedToken = session?.access_token || null;
  return cachedToken;
}

function buildPayload() {
  return JSON.stringify({
    game: 'clicker',
    payload: {
      score: Math.floor(score),
      gpc: Math.floor(gpc),
      gps: Math.floor(gps),
      gpsm: gpsMultiplier,
      pm: [...purchasedMults],
      bc: buyCounts
    }
  });
}

function saveGameSync() {
  if (!cachedToken) return;
  fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cachedToken },
    body: buildPayload(),
    keepalive: true
  });
}

async function saveGame() {
  const token = await getToken();
  if (!token) return;
  const status = document.getElementById('save-status');
  status.textContent = '⬤ saving...';
  status.className = 'saving';
  await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: buildPayload()
  });
  status.textContent = '⬤ saved';
  status.className = 'saved';
  setTimeout(() => { status.textContent = '⬤ saved'; status.className = ''; }, 2000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGameSync();
});
window.addEventListener('pagehide', saveGameSync);

async function loadGame() {
  const token = await getToken();
  if (!token) return;
  const res = await fetch('/api/scores?game=clicker', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const { data } = await res.json();
  if (data?.payload) {
    score         = data.payload.score || 0;
    gpc           = data.payload.gpc   || 1;
    gps           = data.payload.gps   || 0;
    gpsMultiplier = data.payload.gpsm  || 1;
    Object.assign(buyCounts, data.payload.bc || {});
    (data.payload.pm || []).forEach(id => {
      purchasedMults.add(id);
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.classList.add('one-time-bought');
        const costEl = btn.querySelectorAll('p')[1];
        if (costEl) costEl.textContent = '✓ purchased';
      }
    });
  }
  updateDisplay();
}

let score = 0;
let gps = 0;
let gpc = 1;
let gpsMultiplier = 1;
const purchasedMults = new Set();
const buyCounts = {};

const scoreDisplay = document.getElementById('score');
const gpcDisplay   = document.getElementById('gpc');
const gpsDisplay   = document.getElementById('gps');
const cookie       = document.getElementById('cookie');

const upgrades = [
  // ── Existing ──────────────────────────────────────────────
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
  // ── New additive ──────────────────────────────────────────
  { id: 'up17', type: 'gps', value: 10e6,         cost: 50e9 },
  { id: 'up18', type: 'gpc', value: 200e6,        cost: 200e9 },
  { id: 'up19', type: 'gps', value: 100e6,        cost: 1e12 },
  { id: 'up20', type: 'gpc', value: 2e9,          cost: 5e12 },
  { id: 'up21', type: 'gps', value: 1e9,          cost: 25e12 },
  { id: 'up22', type: 'gpc', value: 20e9,         cost: 125e12 },
  { id: 'up23', type: 'gps', value: 10e9,         cost: 625e12 },
  { id: 'up24', type: 'gpc', value: 200e9,        cost: 3e15 },
  // ── GPS multipliers (one-time only, no scaling) ───────────
  { id: 'up25', type: 'gpsMulti', value: 2,       cost: 20e15 },
  { id: 'up26', type: 'gpsMulti', value: 5,       cost: 200e15 },
  { id: 'up27', type: 'gpsMulti', value: 10,      cost: 2.5e18 },
  { id: 'up28', type: 'gpsMulti', value: 50,      cost: 35e18 },
  { id: 'up29', type: 'gpsMulti', value: 100,     cost: 500e18 },
  { id: 'up30', type: 'gpsMulti', value: 1000,    cost: 1e22 },
  { id: 'up31', type: 'gpsMulti', value: 20000,   cost: 1e24 },
];

updateButtons();
loadGame();

cookie.addEventListener("click", () => {
  score += gpc;
  updateDisplay();
});

cookie.addEventListener("click", (e) => {
  const popup = document.createElement("div");
  popup.textContent = "+" + formatNumber(gpc);
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

upgrades.forEach(up => {
  const button = document.getElementById(up.id);
  button.addEventListener("click", () => {
    if (up.type === 'gpsMulti' && purchasedMults.has(up.id)) return;
    const cost = up.type === 'gpsMulti' ? up.cost : getEffectiveCost(up);
    if (score < cost) return;
    score -= cost;
    if (up.type === 'gps') {
      gps += up.value;
      buyCounts[up.id] = (buyCounts[up.id] || 0) + 1;
    } else if (up.type === 'gpc') {
      gpc += up.value;
      buyCounts[up.id] = (buyCounts[up.id] || 0) + 1;
    } else if (up.type === 'gpsMulti') {
      gpsMultiplier *= up.value;
      purchasedMults.add(up.id);
      button.disabled = true;
    }
    button.classList.add('purchased');
    setTimeout(() => button.classList.remove('purchased'), 400);
    updateDisplay();
  });
});

setInterval(() => { score += (gps * gpsMultiplier) / 60; }, 1000 / 60);
setInterval(updateDisplay, 100);
setInterval(saveGame, 5000);
