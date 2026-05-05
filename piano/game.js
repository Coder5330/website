(() => {
  const TILE_HEIGHT = 110;
  const BEAT_MS = 441; // 136 BPM

  // Base speed: tile travels exactly TILE_HEIGHT px in one beat at level 3 (⭐⭐⭐)
  const BASE_SPEED = Math.round(TILE_HEIGHT / BEAT_MS * 1000); // ~249 px/s

  // Each level is a multiple of BASE_SPEED so tiles stay in sync with the beat
  const LEVELS = [
    { name: '⭐',       speed: Math.round(BASE_SPEED * 0.6), threshold: 0   }, // ~149
    { name: '⭐⭐',     speed: Math.round(BASE_SPEED * 0.8), threshold: 15  }, // ~199
    { name: '⭐⭐⭐',   speed: Math.round(BASE_SPEED * 1.0), threshold: 30  }, // ~249
    { name: '👑',       speed: Math.round(BASE_SPEED * 1.4), threshold: 50  }, // ~349
    { name: '👑👑',     speed: Math.round(BASE_SPEED * 1.8), threshold: 75  }, // ~448
    { name: '👑👑👑',   speed: Math.round(BASE_SPEED * 2.4), threshold: 100 }, // ~598
  ];

  const INITIAL_DELAY = 500; // ms before first beat after game start

  let gameStartTime = 0;
  let currentLevel = 0;
  let tilesHit = 0;

  function getCurrentLevel() {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (tilesHit >= LEVELS[i].threshold) return i;
    }
    return 0;
  }

  function updateLevelBar() {
    const levelItems = document.querySelectorAll('.level-item');
    const levelSeparators = document.querySelectorAll('.level-separator');

    levelItems.forEach((item, index) => {
      item.classList.remove('active', 'completed');
      if (index < currentLevel) item.classList.add('completed');
      else if (index === currentLevel) item.classList.add('active');
    });

    levelSeparators.forEach((sep, index) => {
      sep.classList.remove('completed');
      if (index < currentLevel) sep.classList.add('completed');
    });
  }

  function fallSpeed() {
    return LEVELS[currentLevel].speed;
  }

  // Sync music playback rate to tile speed (pitch will shift — acceptable trade-off)
  function syncMusic() {
    // Level 2 (⭐⭐⭐) is the "natural" speed where 1 beat = 1 tile
    music.playbackRate = LEVELS[currentLevel].speed / LEVELS[2].speed;
  }

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

    // Occasionally spawn a second tile at higher levels
    if (tilesHit >= 30 && Math.random() < 0.25) {
      spawnTileAt(pickCol([col]));
    }

    // Spawn exactly on the beat — adjust interval for current speed level
    // At faster levels we scale the beat interval so tiles stay musically locked
    const scaledBeat = Math.round(BEAT_MS * (LEVELS[2].speed / fallSpeed()));
    beatTimer = setTimeout(onBeat, scaledBeat);
  }

  function updateScore() {
    if (!running) return;

    const elapsed = (Date.now() - gameStartTime) / 100;
    score = Math.floor(elapsed);
    scoreEl.textContent = score;

    const newLevel = getCurrentLevel();
    if (newLevel !== currentLevel) {
      currentLevel = newLevel;
      updateLevelBar();
      syncMusic();
    }
  }

  function update(dt) {
    const boardHeight = board.clientHeight;

    for (const t of tiles) {
      t.y += fallSpeed() * dt;
      t.el.style.top = `${t.y}px`;
      if (!t.hit && t.y > boardHeight) {
        return gameOver();
      }
    }

    updateScore();

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

    let target = null;
    for (const t of tiles) {
      if (t.col !== col || t.hit) continue;
      const bottom = t.y + TILE_HEIGHT;
      if (bottom >= hitTop && t.y <= boardHeight) {
        if (!target || t.y > target.y) target = t;
      }
    }

    if (!target) return gameOver();

    target.hit = true;
    target.el.classList.add('hit');
    tilesHit++;

    const colEl = columns[col];
    colEl.classList.add('flash');
    setTimeout(() => colEl.classList.remove('flash'), 80);
  }

  function startGame() {
    tiles.forEach(t => t.el.remove());
    tiles = [];
    score = 0;
    tilesHit = 0;
    currentLevel = 0;
    scoreEl.textContent = '0';
    updateLevelBar();
    syncMusic();
    lastFrame = 0;
    lastColumn = -1;
    gameStartTime = Date.now();
    clearTimeout(beatTimer);
    running = true;
    show('game');

    music.currentTime = 0;
    music.playbackRate = 1.0;
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

  async function saveToSupabase(name, scoreVal) {
    if (typeof sb === 'undefined') {
      console.log('Supabase not initialized');
      return false;
    }

    try {
      const { data: { session }, error: sessionError } = await sb.auth.getSession();

      if (sessionError) { console.error('Session error:', sessionError); return false; }
      if (!session) { console.log('No active session'); return false; }

      const { data: existing, error: fetchError } = await sb
        .from('scores')
        .select('payload')
        .eq('player_id', session.user.id)
        .eq('game', 'piano')
        .maybeSingle();

      if (fetchError) { console.error('Fetch error:', fetchError); return false; }

      if (existing?.payload?.score >= scoreVal) {
        console.log('Existing score is better, skipping save');
        return true;
      }

      const { error: upsertError } = await sb
        .from('scores')
        .upsert({
          player_id: session.user.id,
          game: 'piano',
          payload: { score: scoreVal, name }
        }, { onConflict: 'player_id,game' });

      if (upsertError) { console.error('Upsert error:', upsertError); return false; }

      console.log('Score saved to Supabase successfully');
      return true;

    } catch (err) {
      console.error('Unexpected error in saveToSupabase:', err);
      return false;
    }
  }

  async function saveScore(name, scoreVal) {
    const supabaseSuccess = await saveToSupabase(name, scoreVal);
    if (!supabaseSuccess) console.log('Supabase save failed or skipped, saving to localStorage only');

    const scores = loadScores();
    scores.push({ name, score: scoreVal, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(LB_KEY, JSON.stringify(scores.slice(0, 10)));
  }

  async function renderLeaderboard() {
    const list = document.getElementById('scoreList');
    list.innerHTML = '<li class="empty">Loading…</li>';
    try {
      const { data, error } = await sb.rpc('get_leaderboard', { p_game: 'piano' });
      list.innerHTML = '';
      if (error || !data?.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No scores yet — be the first!';
        list.appendChild(li);
        return;
      }
      for (const s of data) {
        const li = document.createElement('li');
        const displayName = s.payload?.name || s.display_name || 'Anonymous';
        li.innerHTML = `<span class="name">${escapeHtml(displayName)}</span><span class="score">${s.payload.score}</span>`;
        list.appendChild(li);
      }
    } catch {
      list.innerHTML = '<li class="empty">Could not load leaderboard.</li>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function checkAuthStatus() {
    if (typeof sb === 'undefined') return false;
    try {
      const { data: { session } } = await sb.auth.getSession();
      return !!session;
    } catch {
      return false;
    }
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
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = document.getElementById('nameInput').value.trim() || 'Anon';

    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    await saveScore(name, score);

    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    document.getElementById('nameEntry').classList.add('hidden');
    document.getElementById('postSave').classList.remove('hidden');
  });

  columns.forEach((col, i) => {
    col.addEventListener('mousedown', e => { e.preventDefault(); hit(i); });
    col.addEventListener('touchstart', e => { e.preventDefault(); hit(i); }, { passive: false });
  });

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === '1') hit(0);
    else if (e.key === '2') hit(1);
    else if (e.key === '3') hit(2);
    else if (e.key === '4') hit(3);
  });

  window.addEventListener('load', async () => {
    const loggedIn = await checkAuthStatus();
    console.log(loggedIn ? 'Logged in - scores will sync to leaderboard' : 'Not logged in - scores will be saved locally only');
  });

  show('menu');
})();
