(() => {
  const TILE_HEIGHT = 110;
  const SPEED_MIN = 100;
  const SPEED_MAX = 700;
  const INITIAL_DELAY = 500; // ms before first beat after game start

  let gameStartTime = 0;

  // Speed ramps from 100 to 700 over 90 seconds
  function fallSpeed() {
    const elapsed = (Date.now() - gameStartTime) / 1000;
    const t = Math.min(elapsed / 90, 1);
    return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * t;
  }

  // Gap between spawns recalculated each beat based on current speed
  function gapTouch() { return Math.round(TILE_HEIGHT / fallSpeed() * 1000); }
  function gapOne()   { return Math.round(TILE_HEIGHT / fallSpeed() * 1000 * 2); }

  const screens = {
    menu: document.getElementById('menu'),
    game: document.getElementById('game'),
    gameover: document.getElementById('gameover'),
    leaderboard: document.getElementById('leaderboard'),
  };

  const board = document.getElementById('board');
  const columns = [...document.querySelectorAll('.column')];
  const scoreEl = document.getElementById('score');
  const finalScoreEl = document.getElementById('finalScore');
  const music = document.getElementById('music');

  let tiles = [];
  let score = 0;
  let lastFrame = 0;
  let running = false;
  let rafId = null;
  let lastColumn = -1;
  let beatTimer = null;

  function show(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  function pickCol(exclude = []) {
    const opts = [0, 1, 2, 3].filter(c => !exclude.includes(c));
    return opts[Math.floor(Math.random() * opts.length)];
  }

  function spawnTileAt(col) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.style.top = `-${TILE_HEIGHT}px`;
    columns[col].appendChild(el);
    tiles.push({ el, col, y: -TILE_HEIGHT, hit: false });
  }


  function onBeat() {
    if (!running) return;

    const col = pickCol([lastColumn]);
    spawnTileAt(col);
    lastColumn = col;

    if (score >= 30 && Math.random() < 0.25) {
      spawnTileAt(pickCol([col]));
    }

    const delay = Math.random() < 0.5 ? gapTouch() : gapOne();
    beatTimer = setTimeout(onBeat, delay);
  }

  function update(dt) {
    const boardHeight = board.clientHeight;
    const hitTop = boardHeight - TILE_HEIGHT;

    for (const t of tiles) {
      t.y += fallSpeed() * dt;
      t.el.style.top = `${t.y}px`;
      if (!t.hit && t.y > boardHeight) {
        return gameOver();
      }
    }

    // remove hit tiles that scrolled off-screen
    tiles = tiles.filter(t => {
      if (t.hit && t.y > boardHeight) {
        t.el.remove();
        return false;
      }
      return true;
    });
  }

  function loop(now) {
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    update(dt);
    rafId = requestAnimationFrame(loop);
  }

  function hit(col) {
    if (!running) return;
    const boardHeight = board.clientHeight;
    const hitTop = boardHeight - TILE_HEIGHT;

    // find the lowest unhit tile in this column that is within the hit zone
    let target = null;
    for (const t of tiles) {
      if (t.col !== col || t.hit) continue;
      const bottom = t.y + TILE_HEIGHT;
      if (bottom >= hitTop && t.y <= boardHeight) {
        if (!target || t.y > target.y) target = t;
      }
    }

    if (!target) {
      return gameOver();
    }

    target.hit = true;
    target.el.classList.add('hit');
    score++;
    scoreEl.textContent = score;

    const colEl = columns[col];
    colEl.classList.add('flash');
    setTimeout(() => colEl.classList.remove('flash'), 80);
  }

  function startGame() {
    tiles.forEach(t => t.el.remove());
    tiles = [];
    score = 0;
    scoreEl.textContent = '0';
    lastFrame = 0;
    lastColumn = -1;
    gameStartTime = Date.now();
    clearTimeout(beatTimer);
    running = true;
    show('game');

    music.currentTime = 0;
    music.play().catch(() => {});

    beatTimer = setTimeout(onBeat, INITIAL_DELAY);

    rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearTimeout(beatTimer);
    music.pause();

    finalScoreEl.textContent = score;
    document.getElementById('nameEntry').classList.remove('hidden');
    document.getElementById('postSave').classList.add('hidden');
    document.getElementById('nameInput').value = '';
    show('gameover');
  }

  // Leaderboard
  const LB_KEY = 'pianoTilesLeaderboard';

  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(LB_KEY)) || [];
    } catch {
      return [];
    }
  }

  async function saveToSupabase(scoreVal) {
    if (typeof sb === 'undefined') return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data } = await sb.from('scores').select('payload')
      .eq('player_id', session.user.id).eq('game', 'piano').maybeSingle();
    if (data?.payload?.score >= scoreVal) return;
    await sb.from('scores').upsert({
      player_id: session.user.id, game: 'piano',
      payload: { score: scoreVal }
    }, { onConflict: 'player_id,game' });
  }

  function saveScore(name, scoreVal) {
    saveToSupabase(scoreVal);
    const scores = loadScores();
    scores.push({ name, score: scoreVal, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
  }

  function renderLeaderboard() {
    const list = document.getElementById('scoreList');
    list.innerHTML = '';
    const scores = loadScores();
    if (scores.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No scores yet — be the first!';
      list.appendChild(li);
      return;
    }
    for (const s of scores) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="name">${escapeHtml(s.name)}</span><span class="score">${s.score}</span>`;
      list.appendChild(li);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Event wiring
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('leaderboardBtn').addEventListener('click', () => {
    renderLeaderboard();
    show('leaderboard');
  });
  document.getElementById('backBtn').addEventListener('click', () => show('menu'));
  document.getElementById('playAgainBtn').addEventListener('click', startGame);
  document.getElementById('viewBoardBtn').addEventListener('click', () => {
    renderLeaderboard();
    show('leaderboard');
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim() || 'Anon';
    saveScore(name, score);
    document.getElementById('nameEntry').classList.add('hidden');
    document.getElementById('postSave').classList.remove('hidden');
  });

  // Click columns as alternative input
  columns.forEach((col, i) => {
    col.addEventListener('mousedown', e => {
      e.preventDefault();
      hit(i);
    });
    col.addEventListener('touchstart', e => {
      e.preventDefault();
      hit(i);
    }, { passive: false });
  });

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === '1') hit(0);
    else if (e.key === '2') hit(1);
    else if (e.key === '3') hit(2);
    else if (e.key === '4') hit(3);
  });

  show('menu');
})();
