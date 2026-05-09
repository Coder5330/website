const time = document.getElementById("timer");
const cps = document.getElementById("cps");
const clicks = document.getElementById("clicks");
const canvas = document.getElementById("canvas");

let timer = null;
let startTime = null;
let clickCount = 0;
let DURATION = 10;
let cheaterBlocked = false;
let clickTimestamps = [];  // raw timestamps for cheat analysis

// ── Cheat detection ────────────────────────────────────────────────────────
function analyzeClickPattern(timestamps) {
  const n = timestamps.length;
  if (n < 8) return null;

  // intervals in ms
  const iv = [];
  for (let i = 1; i < n; i++) iv.push(timestamps[i] - timestamps[i - 1]);

  const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
  if (mean <= 0) return 'invalid';
  const variance = iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length;
  const stdev = Math.sqrt(variance);
  const cv = stdev / mean;

  // 1. Physically impossible sustained CPS (world record ~14 CPS for 10s)
  const elapsed = (timestamps[n - 1] - timestamps[0]) / 1000;
  const actualCps = (n - 1) / elapsed;
  if (actualCps > 14.5) return 'impossible_cps';

  // 2. Fixed interval: nearly zero variance
  if (cv < 0.08) return 'fixed_interval';

  // 3. Jittered autoclick: intervals are independent (i.i.d. uniform jitter)
  //    Humans click in rhythm → positive lag-1 serial correlation
  //    Bots with random offset have ~0 autocorrelation
  if (iv.length >= 20) {
    let cov = 0, varSum = 0;
    for (let i = 1; i < iv.length; i++) cov += (iv[i - 1] - mean) * (iv[i] - mean);
    for (const v of iv) varSum += (v - mean) ** 2;
    const autocorr = varSum > 0 ? cov / varSum : 0;

    if (autocorr < 0.05 && cv < 0.22) return 'jittered_autoclick';
  }

  return null; // legit
}

// ── CPS Graph ──────────────────────────────────────────────────────────────
const graphCanvas = document.getElementById('cps-graph');
const gctx = graphCanvas.getContext('2d');
const cpsHistory = [];
let lastGraphSec = -1;

function drawCpsGraph() {
  const cssW = graphCanvas.clientWidth || 400;
  const cssH = graphCanvas.clientHeight || 130;
  if (graphCanvas.width !== cssW)  graphCanvas.width  = cssW;
  if (graphCanvas.height !== cssH) graphCanvas.height = cssH;

  const W = graphCanvas.width, H = graphCanvas.height;
  const PAD = { top: 14, right: 14, bottom: 30, left: 36 };
  gctx.clearRect(0, 0, W, H);

  const pts = cpsHistory;
  if (!pts.length) return;

  const maxT = Math.max(DURATION, pts[pts.length - 1].t);
  const maxC = Math.max(...pts.map(p => p.cps), 4);
  const yMax = Math.ceil(maxC / 2) * 2 + 2;

  const toX = t => PAD.left + (t / maxT) * (W - PAD.left - PAD.right);
  const toY = c => PAD.top  + (1 - c / yMax) * (H - PAD.top  - PAD.bottom);

  // Grid + Y labels
  gctx.lineWidth = 1;
  gctx.font = '10px monospace';
  gctx.textAlign = 'right';
  for (let y = 0; y <= yMax; y += 2) {
    const py = toY(y);
    gctx.strokeStyle = 'rgba(255,255,255,0.06)';
    gctx.beginPath(); gctx.moveTo(PAD.left, py); gctx.lineTo(W - PAD.right, py); gctx.stroke();
    gctx.fillStyle = 'rgba(255,255,255,0.3)';
    gctx.fillText(y, PAD.left - 4, py + 3);
  }

  // Axes
  gctx.strokeStyle = 'rgba(255,255,255,0.18)';
  gctx.beginPath();
  gctx.moveTo(PAD.left, PAD.top);
  gctx.lineTo(PAD.left, H - PAD.bottom);
  gctx.lineTo(W - PAD.right, H - PAD.bottom);
  gctx.stroke();

  // X labels
  gctx.fillStyle = 'rgba(255,255,255,0.3)';
  gctx.textAlign = 'center';
  const step = DURATION <= 5 ? 1 : DURATION <= 10 ? 2 : DURATION <= 30 ? 5 : DURATION <= 60 ? 10 : 20;
  for (let t = 0; t <= maxT; t += step) {
    gctx.fillText(t + 's', toX(t), H - PAD.bottom + 14);
  }

  if (pts.length < 2) {
    gctx.fillStyle = '#22c55e';
    gctx.beginPath(); gctx.arc(toX(pts[0].t), toY(pts[0].cps), 3, 0, Math.PI * 2); gctx.fill();
    return;
  }

  // Filled area
  gctx.beginPath();
  gctx.moveTo(toX(pts[0].t), toY(pts[0].cps));
  for (let i = 1; i < pts.length; i++) gctx.lineTo(toX(pts[i].t), toY(pts[i].cps));
  gctx.lineTo(toX(pts[pts.length - 1].t), H - PAD.bottom);
  gctx.lineTo(toX(pts[0].t), H - PAD.bottom);
  gctx.closePath();
  gctx.fillStyle = 'rgba(34,197,94,0.10)';
  gctx.fill();

  // Line
  gctx.beginPath();
  gctx.moveTo(toX(pts[0].t), toY(pts[0].cps));
  for (let i = 1; i < pts.length; i++) gctx.lineTo(toX(pts[i].t), toY(pts[i].cps));
  gctx.strokeStyle = '#22c55e';
  gctx.lineWidth = 2.5;
  gctx.lineJoin = 'round';
  gctx.lineCap = 'round';
  gctx.stroke();

  // Dots
  gctx.fillStyle = '#22c55e';
  for (const p of pts) {
    gctx.beginPath();
    gctx.arc(toX(p.t), toY(p.cps), 3.5, 0, Math.PI * 2);
    gctx.fill();
  }

  // Latest label
  const last = pts[pts.length - 1];
  const lx = toX(last.t), ly = toY(last.cps);
  gctx.font = 'bold 11px monospace';
  gctx.fillStyle = '#4ade80';
  gctx.textAlign = lx > W - 60 ? 'right' : 'left';
  gctx.fillText(last.cps.toFixed(1) + ' CPS', lx + (lx > W - 60 ? -8 : 8), ly - 7);
}

// ── Personal Best ──────────────────────────────────────────────────────────
async function loadPB() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('scores')
    .select('payload')
    .eq('player_id', session.user.id)
    .eq('game', 'cps')
    .maybeSingle();
  renderPB(data?.payload);
}

function renderPB(payload) {
  const el = document.getElementById('pb-display');
  if (!el) return;
  if (!payload) { el.innerHTML = ''; return; }
  const entries = Object.entries(payload)
    .filter(([, v]) => v > 0)
    .sort((a, b) => parseInt(a[0].slice(1)) - parseInt(b[0].slice(1)));
  if (!entries.length) { el.innerHTML = ''; return; }
  const items = entries.map(([key, val]) => {
    const dur = key.slice(1);
    const active = parseInt(dur) === DURATION;
    return `<span class="pb-item${active ? ' pb-active' : ''}" data-dur="${dur}">${dur}s: <b>${val}</b></span>`;
  }).join('');
  el.innerHTML = `<div class="pb-row"><span class="pb-label">PB</span>${items}</div>`;
}

function updatePbHighlight() {
  document.querySelectorAll('.pb-item').forEach(el => {
    el.classList.toggle('pb-active', parseInt(el.dataset.dur) === DURATION);
  });
}

loadPB();

// ── Anti-cheat ─────────────────────────────────────────────────────────────
async function banSelf() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  await sb.from('blacklist').insert({ email: session.user.email }).maybeSingle();
  await sb.auth.signOut();
  window.location.href = '/auth/index.html?banned=1';
}

// ── Duration buttons ───────────────────────────────────────────────────────
const buttons = [1, 2, 5, 10, 30, 60, 100].map(n => document.getElementById("s" + n));

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("chosen"));
        btn.classList.add("chosen");
        DURATION = parseInt(btn.id.replace("s", ""));

        // Reset game
        clearInterval(timer);
        timer = null;
        startTime = null;
        clickCount = 0;
        clicks.textContent = "Clicks: 0";
        cps.textContent = "CPS: 0";
        time.textContent = "Timer: " + DURATION;
        canvas.querySelector("p").textContent = "Start clicking to start test...";

        // Reset graph + timestamps
        cpsHistory.length = 0;
        clickTimestamps.length = 0;
        lastGraphSec = -1;
        graphCanvas.classList.remove('active');
        gctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

        // Update PB highlight for new duration
        updatePbHighlight();
    });
});

// ── Save score ─────────────────────────────────────────────────────────────
async function saveCpsScore(cpsValue, duration) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const status = document.getElementById('save-status');

  // ── Client-side cheat analysis ──────────────────────────────────────────
  const cheatReason = analyzeClickPattern(clickTimestamps);
  if (cheatReason) {
    console.warn('Cheat detected (client):', cheatReason);
    cheaterBlocked = true;
    status.textContent = '⛔ cheater'; status.className = '';
    banSelf();
    return;
  }

  // Compute intervals to send to server for server-side validation
  const intervals = [];
  for (let i = 1; i < clickTimestamps.length; i++) {
    intervals.push(parseFloat((clickTimestamps[i] - clickTimestamps[i - 1]).toFixed(2)));
  }

  status.textContent = '⬤ saving...';
  status.className = 'saving';
  const { data: saved, error } = await sb.rpc('save_cps_score', {
    p_duration: duration,
    p_cps: parseFloat(cpsValue.toFixed(2)),
    p_intervals: intervals
  });
  if (error) { console.error('save error:', error); status.textContent = '⬤ error'; status.className = ''; return; }
  if (saved === false) { cheaterBlocked = true; alert('STTTOPPP CHEATTTING'); status.textContent = '⛔ cheater'; status.className = ''; banSelf(); return; }
  status.textContent = '⬤ saved';
  status.className = 'saved';
  loadPB(); // Refresh PB after save
}

// ── Click handler ──────────────────────────────────────────────────────────
canvas.addEventListener("click", (e) => {
    // Two expanding rings
    ['', 'ring2'].forEach(cls => {
      const ring = document.createElement('div');
      ring.className = 'click-ring' + (cls ? ' ' + cls : '');
      ring.style.left = e.clientX + 'px';
      ring.style.top  = e.clientY + 'px';
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 720);
    });

    // Spark particles
    const SPARKS = 7;
    for (let i = 0; i < SPARKS; i++) {
      const p = document.createElement('div');
      p.className = 'click-particle';
      document.body.appendChild(p);
      const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.5 + Math.random() * 2;
      let x = e.clientX, y = e.clientY, opacity = 1;
      const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
      const tick = setInterval(() => {
        x += vx; y += vy; opacity -= 0.06;
        p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.opacity = opacity;
        if (opacity <= 0) { clearInterval(tick); p.remove(); }
      }, 16);
    }

    // +1 float
    const plus = document.createElement('div');
    plus.className = 'click-plus';
    plus.textContent = '+1';
    plus.style.left = (e.clientX + (Math.random() * 16 - 8)) + 'px';
    plus.style.top  = e.clientY + 'px';
    document.body.appendChild(plus);
    setTimeout(() => plus.remove(), 700);

    if (cheaterBlocked) return;
    if (timer === null) {
        startTime = Date.now();
        clickTimestamps.push(startTime); // record first click
        canvas.querySelector("p").textContent = "";
        graphCanvas.classList.add('active');

        timer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, DURATION - elapsed).toFixed(1);
            time.textContent = "Timer: " + remaining;
            const liveCps = clickCount / elapsed;
            cps.textContent = "CPS: " + liveCps.toFixed(2);

            // Record graph data point every second
            const sec = Math.floor(elapsed);
            if (sec > lastGraphSec && elapsed > 0.3) {
              lastGraphSec = sec;
              cpsHistory.push({ t: sec, cps: parseFloat(liveCps.toFixed(2)) });
              drawCpsGraph();
            }

            if (elapsed >= DURATION) {
                clearInterval(timer);
                const finalCps = clickCount / DURATION;
                // Final graph point
                cpsHistory.push({ t: DURATION, cps: parseFloat(finalCps.toFixed(2)) });
                drawCpsGraph();
                canvas.querySelector("p").textContent = "Done! " + finalCps.toFixed(2) + " CPS";
                saveCpsScore(finalCps, DURATION);
            }
        }, 10);
    }

    if (timer && (Date.now() - startTime) / 1000 < DURATION) {
        clickCount++;
        clicks.textContent = "Clicks: " + clickCount;
        clickTimestamps.push(Date.now());
    }
});
