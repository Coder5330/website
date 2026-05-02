const CONFIG = {
  totalCups: 50,
  gameTime: 60,
  spillCleanupTime: 3,
  cupSizes: {
    // capacity = units to fill; fillRate = units/second (smaller = faster to serve)
    S:  { capacity: 80,  fillRate: 110, className: 'size-S' },
    M:  { capacity: 110, fillRate: 90,  className: 'size-M' },
    L:  { capacity: 150, fillRate: 75,  className: 'size-L' },
    XL: { capacity: 200, fillRate: 60,  className: 'size-XL' },
  },
  weightsEarly: [50, 30, 15, 5],
  weightsLate:  [10, 25, 35, 30],
  spawnIntervalEarly: 0.6, // ~1.5 cups per second early
  spawnIntervalLate:  0.22, // ~4-5 cups per second late
  overfillBuffer: 1.2,
};

const SIZE_KEYS = ['S', 'M', 'L', 'XL'];

const state = {
  running: false,
  timeLeft: CONFIG.gameTime,
  served: 0,
  spills: 0,
  cupsRemaining: CONFIG.totalCups,
  lastFrame: 0,
  spawnTimer: 0,
  globalCleanup: 0, // game-wide pause on spill
  slots: [], // each: { cup: {size, capacity, fill}|null, dispensing: bool }
};

const stationEls = [...document.querySelectorAll('.station')];
const cupEls = stationEls.map(s => s.querySelector('.cup'));
const fillEls = stationEls.map(s => s.querySelector('.fill'));

const hud = {
  time: document.getElementById('time'),
  served: document.getElementById('served'),
  spills: document.getElementById('spills'),
};
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const keysHeld = new Set();

function init() {
  state.running = false;
  state.timeLeft = CONFIG.gameTime;
  state.served = 0;
  state.spills = 0;
  state.cupsRemaining = CONFIG.totalCups;
  state.spawnTimer = 0;
  state.globalCleanup = 0;
  state.slots = stationEls.map(() => ({ cup: null, dispensing: false }));
  stationEls.forEach((el, i) => clearStation(i));
  updateHUD();
}

function start() {
  init();
  overlay.classList.remove('show');
  state.running = true;
  state.lastFrame = performance.now();
  requestAnimationFrame(loop);
}

async function saveToSupabase(served, spills, timeLeft) {
  if (typeof sb === 'undefined') return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('scores').select('payload')
    .eq('player_id', session.user.id).eq('game', 'slushie').maybeSingle();
  const ex = data?.payload;
  if (ex) {
    if (ex.served > served) return;
    if (ex.served === served && ex.timeLeft > timeLeft) return;
    if (ex.served === served && ex.timeLeft === timeLeft && ex.spills <= spills) return;
  }
  await sb.from('scores').upsert({
    player_id: session.user.id, game: 'slushie',
    payload: { served, spills, timeLeft: parseFloat(timeLeft.toFixed(1)) }
  }, { onConflict: 'player_id,game' });
}

function saveScore(served, spills, timeLeft) {
  saveToSupabase(served, spills, timeLeft);
  const scores = JSON.parse(localStorage.getItem('slushieScores') || '[]');
  scores.push({ served, spills, timeLeft: parseFloat(timeLeft.toFixed(1)), date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.served - a.served || b.timeLeft - a.timeLeft || a.spills - b.spills);
  scores.splice(10);
  localStorage.setItem('slushieScores', JSON.stringify(scores));
  return scores;
}

async function renderLeaderboard(myServed) {
  try {
    const { data, error } = await sb.rpc('get_leaderboard', { p_game: 'slushie' });
    if (error || !data?.length) return '<p style="opacity:0.6;margin-top:12px;">No scores yet.</p>';
    const rows = data.map((s, i) => {
      const hl = s.payload.served === myServed ? ' style="color:#ffe66d;font-weight:bold;"' : '';
      return `<tr${hl}><td>${i+1}</td><td>${s.display_name}</td><td>${s.payload.served}</td><td>${s.payload.spills}</td><td>${s.payload.timeLeft}s</td></tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;">
      <thead><tr style="opacity:0.6"><th>#</th><th>Player</th><th>Served</th><th>Spills</th><th>Left</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch { return ''; }
}

async function end(message) {
  state.running = false;
  keysHeld.clear();
  state.slots.forEach((s, i) => stopDispense(i));
  saveScore(state.served, state.spills, state.timeLeft);
  overlay.querySelector('.panel').innerHTML = `
    <h1>${message}</h1>
    <p>Cups served: <b>${state.served}</b> / ${CONFIG.totalCups}</p>
    <p>Spills: <b>${state.spills}</b> &nbsp;|&nbsp; Time left: <b>${state.timeLeft.toFixed(1)}s</b></p>
    <h2 style="margin-top:14px;font-size:18px;color:#ffe66d;">Leaderboard</h2>
    <p id="lb-loading" style="opacity:0.6">Loading…</p>
    <button id="startBtn" style="margin-top:18px;">Play Again</button>
  `;
  overlay.classList.add('show');
  document.getElementById('startBtn').addEventListener('click', start);
  const lb = await renderLeaderboard(state.served);
  const loading = document.getElementById('lb-loading');
  if (loading) loading.outerHTML = lb;
}

function pickSize() {
  const progress = 1 - (state.timeLeft / CONFIG.gameTime); // 0 -> 1
  const w = CONFIG.weightsEarly.map((e, i) =>
    e + (CONFIG.weightsLate[i] - e) * progress
  );
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return SIZE_KEYS[i];
  }
  return 'S';
}

function spawnCup(slotIndex) {
  const slot = state.slots[slotIndex];
  if (slot.cup) return;
  if (state.cupsRemaining <= 0) return;
  state.cupsRemaining--;
  const sizeKey = pickSize();
  const sizeDef = CONFIG.cupSizes[sizeKey];
  slot.cup = { size: sizeKey, capacity: sizeDef.capacity, fillRate: sizeDef.fillRate, fill: 0 };
  const cupEl = cupEls[slotIndex];
  cupEl.classList.remove('empty', 'served', 'size-S', 'size-M', 'size-L', 'size-XL');
  cupEl.classList.add(sizeDef.className);
  fillEls[slotIndex].style.height = '0%';
}

function spawnOneRandom() {
  if (state.cupsRemaining <= 0) return;
  const empty = [];
  state.slots.forEach((slot, i) => { if (!slot.cup) empty.push(i); });
  if (empty.length === 0) return;
  const idx = empty[Math.floor(Math.random() * empty.length)];
  spawnCup(idx);
}

function clearStation(i) {
  const cupEl = cupEls[i];
  cupEl.classList.add('empty');
  cupEl.classList.remove('served', 'size-S', 'size-M', 'size-L', 'size-XL');
  fillEls[i].style.height = '0%';
  stationEls[i].classList.remove('dispensing', 'cleanup');
  stationEls[i].removeAttribute('data-cleanup');
}

function serveCup(i) {
  const slot = state.slots[i];
  if (!slot.cup) return;
  state.served++;
  cupEls[i].classList.add('served');
  slot.cup = null;
  setTimeout(() => {
    if (!state.running) return;
    if (state.slots[i].cup) return; // new cup arrived during animation, leave it alone
    cupEls[i].classList.add('empty');
    cupEls[i].classList.remove('served');
    fillEls[i].style.height = '0%';
  }, 400);
  if (state.served >= CONFIG.totalCups) {
    end('You did it! 🎉');
  }
}

function spill(i) {
  state.spills++;
  // serve whatever is there (it was full, then overflowed)
  serveCup(i);
  state.globalCleanup = CONFIG.spillCleanupTime;
  keysHeld.clear();
  state.slots.forEach((slot, idx) => {
    slot.dispensing = false;
    stationEls[idx].classList.remove('dispensing');
  });
}

function startDispense(i) {
  const slot = state.slots[i];
  if (!slot.cup) return;
  slot.dispensing = true;
  stationEls[i].classList.add('dispensing');
}

function stopDispense(i) {
  const slot = state.slots[i];
  slot.dispensing = false;
  stationEls[i].classList.remove('dispensing');
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.1, (now - state.lastFrame) / 1000);
  state.lastFrame = now;

  // Timer always runs — even during spill cleanup
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateHUD();
    end('Time\'s up!');
    return;
  }

  // Spill cleanup — only blocks dispensing and spawning, not the timer
  if (state.globalCleanup > 0) {
    state.globalCleanup -= dt;
    if (state.globalCleanup <= 0) {
      state.globalCleanup = 0;
      stationEls.forEach(el => {
        el.classList.remove('cleanup');
        el.removeAttribute('data-cleanup');
      });
    } else {
      stationEls.forEach(el => {
        el.classList.add('cleanup');
        el.setAttribute('data-cleanup', state.globalCleanup.toFixed(1));
      });
    }
    updateHUD();
    requestAnimationFrame(loop);
    return;
  }

  // Dispensing — each cup fills at its own rate
  state.slots.forEach((slot, i) => {
    if (!slot.dispensing || !slot.cup) return;
    const cup = slot.cup;
    const spillThreshold = cup.capacity * CONFIG.overfillBuffer;
    cup.fill += cup.fillRate * dt;
    const fillPct = Math.min(100, (cup.fill / cup.capacity) * 100);
    fillEls[i].style.height = fillPct + '%';

    if (cup.fill >= spillThreshold) {
      spill(i);
    }
  });

  // Spawn one cup at a time into a random empty slot; rate ramps up late game
  const progress = 1 - (state.timeLeft / CONFIG.gameTime);
  const spawnInterval = CONFIG.spawnIntervalEarly +
    (CONFIG.spawnIntervalLate - CONFIG.spawnIntervalEarly) * progress;
  state.spawnTimer += dt;
  if (state.spawnTimer >= spawnInterval) {
    state.spawnTimer = 0;
    spawnOneRandom();
  }

  updateHUD();
  requestAnimationFrame(loop);
}

function updateHUD() {
  hud.time.textContent = state.timeLeft.toFixed(1);
  hud.served.textContent = state.served;
  hud.spills.textContent = state.spills;
}

document.addEventListener('keydown', (e) => {
  if (!state.running) return;
  if (e.repeat) return;
  const idx = ['1','2','3','4','5'].indexOf(e.key);
  if (idx === -1) return;
  keysHeld.add(idx);
  startDispense(idx);
});

document.addEventListener('keyup', (e) => {
  const idx = ['1','2','3','4','5'].indexOf(e.key);
  if (idx === -1) return;
  keysHeld.delete(idx);
  if (!state.running) return;
  const slot = state.slots[idx];
  stopDispense(idx);
  // If cup was filled (>= capacity) when released, serve it
  if (slot.cup && slot.cup.fill >= slot.cup.capacity) {
    serveCup(idx);
  }
});

startBtn.addEventListener('click', start);
init();
