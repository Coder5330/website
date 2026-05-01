// Clicker script with Supabase save/load

function updateDisplay() {
  scoreDisplay.textContent = formatNumber(Math.floor(score));
  gpcDisplay.textContent = formatNumber(Math.floor(gpc));
  gpsDisplay.textContent = formatNumber(Math.floor(gps));
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
    button.style.background = score < up.cost ? "grey" : "blue";
  });
}

async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token;
}

async function saveGame() {
  const token = await getToken();
  if (!token) return;
  await fetch('/api/scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      game: 'clicker',
      payload: { score: Math.floor(score), gpc: Math.floor(gpc), gps: Math.floor(gps) }
    })
  });
}

async function loadGame() {
  const token = await getToken();
  if (!token) return;
  const res = await fetch('/api/scores?game=clicker', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const { data } = await res.json();
  if (data?.payload) {
    score = data.payload.score || 0;
    gpc   = data.payload.gpc   || 1;
    gps   = data.payload.gps   || 0;
  }
  updateDisplay();
}

let score = 0;
let gps = 0;
let gpc = 1;

const scoreDisplay = document.getElementById('score');
const gpcDisplay   = document.getElementById('gpc');
const gpsDisplay   = document.getElementById('gps');
const cookie       = document.getElementById('cookie');

const upgrades = [
  { id: 'up1',  type: 'gps', value: 0.25,      cost: 25 },
  { id: 'up2',  type: 'gpc', value: 1,          cost: 100 },
  { id: 'up3',  type: 'gpc', value: 10,         cost: 500 },
  { id: 'up4',  type: 'gps', value: 4,          cost: 1500 },
  { id: 'up5',  type: 'gpc', value: 50,         cost: 2000 },
  { id: 'up6',  type: 'gps', value: 15,         cost: 10000 },
  { id: 'up7',  type: 'gpc', value: 450,        cost: 15000 },
  { id: 'up8',  type: 'gps', value: 50,         cost: 100000 },
  { id: 'up9',  type: 'gps', value: 200,        cost: 200000 },
  { id: 'up10', type: 'gpc', value: 3000,       cost: 1000000 },
  { id: 'up11', type: 'gpc', value: 20000,      cost: 6000000 },
  { id: 'up12', type: 'gps', value: 1000,       cost: 18000000 },
  { id: 'up13', type: 'gpc', value: 100000,     cost: 80000000 },
  { id: 'up14', type: 'gps', value: 10000,      cost: 160000000 },
  { id: 'up15', type: 'gpc', value: 10000000,   cost: 1000000000 },
  { id: 'up16', type: 'gps', value: 500000,     cost: 10000000000 },
];

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
  document.getElementById(up.id).addEventListener("click", () => {
    if (score >= up.cost) {
      score -= up.cost;
      if (up.type === "gps") gps += up.value;
      else gpc += up.value;
      updateDisplay();
    }
  });
});

setInterval(() => { score += gps / 60; }, 1000 / 60);
setInterval(updateDisplay, 100);
setInterval(saveGame, 5000); // save every 5 secondsfunction checksum(score, gpc, gps) {
    const raw = `${Math.floor(score)}:${Math.floor(gpc)}:${Math.floor(gps)}:${SAVE_SECRET}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
}

function saveGame() {
    const s = Math.floor(score);
    const c = Math.floor(gpc);
    const g = Math.floor(gps);
    localStorage.setItem('score', s);
    localStorage.setItem('gpc', c);
    localStorage.setItem('gps', g);
    localStorage.setItem('chk', checksum(s, c, g));
}

function loadGame() {
    const s = parseFloat(localStorage.getItem('score')) || 0;
    const c = parseFloat(localStorage.getItem('gpc')) || 1;
    const g = parseFloat(localStorage.getItem('gps')) || 0;
    const savedChk = localStorage.getItem('chk');

    if (savedChk === null || savedChk !== checksum(s, c, g)) {
        // Tampered — reset to zero
        console.warn("Save data tampered. Resetting.");
        localStorage.clear();
        score = 0; gpc = 1; gps = 0;
    } else {
        score = s; gpc = c; gps = g;
    }
    updateDisplay();
}

// --- Game state ---
let score = 0;
let gps = 0;
let gpc = 1;
const scoreDisplay = document.getElementById('score');
const gpcDisplay = document.getElementById('gpc');
const gpsDisplay = document.getElementById('gps');
const cookie = document.getElementById('cookie');

const upgrades = [
    { id: 'up1',  type: 'gps', value: 0.25,    cost: 25 },
    { id: 'up2',  type: 'gpc', value: 1,        cost: 100 },
    { id: 'up3',  type: 'gpc', value: 10,       cost: 500 },
    { id: 'up4',  type: 'gps', value: 4,        cost: 1500 },
    { id: 'up5',  type: 'gpc', value: 50,       cost: 2000 },
    { id: 'up6',  type: 'gps', value: 15,       cost: 10000 },
    { id: 'up7',  type: 'gpc', value: 450,      cost: 15000 },
    { id: 'up8',  type: 'gps', value: 50,       cost: 100000 },
    { id: 'up9',  type: 'gps', value: 200,      cost: 200000 },
    { id: 'up10', type: 'gpc', value: 3000,     cost: 1000000 },
    { id: 'up11', type: 'gpc', value: 20000,    cost: 6000000 },
    { id: 'up12', type: 'gps', value: 1000,     cost: 18000000 },
    { id: 'up13', type: 'gpc', value: 100000,   cost: 80000000 },
    { id: 'up14', type: 'gps', value: 10000,    cost: 160000000 },
    { id: 'up15', type: 'gpc', value: 10000000, cost: 1000000000 },
    { id: 'up16', type: 'gps', value: 500000,   cost: 10000000000 },
];


setInterval(saveGame, 1000);
