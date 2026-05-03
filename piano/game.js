(() => {
  const TILE_HEIGHT = 110;
  
  // Levels with speed and thresholds
  const LEVELS = [
    { name: '⭐', speed: 150, threshold: 0 },      // 1 star
    { name: '⭐⭐', speed: 200, threshold: 15 },    // 2 stars
    { name: '⭐⭐⭐', speed: 250, threshold: 30 },   // 3 stars
    { name: '👑', speed: 350, threshold: 50 },     // 1 crown
    { name: '👑👑', speed: 450, threshold: 75 },   // 2 crowns
    { name: '👑👑👑', speed: 600, threshold: 100 } // 3 crowns
  ];
  
  const INITIAL_DELAY = 500; // ms before first beat after game start

  let gameStartTime = 0;
  let currentLevel = 0;
  let tilesHit = 0;
  function getMusicRate() {
    // Base speed is level 0 = 150px/s, map that to playbackRate 1.0
    return LEVELS[currentLevel].speed / 150;
  }
  
  function syncMusic() {
    music.playbackRate = getMusicRate();
  }
  function getCurrentLevel() {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (tilesHit >= LEVELS[i].threshold) {
        return i;
      }
    }
    return 0;
  }

  function updateLevelBar() {
    const levelItems = document.querySelectorAll('.level-item');
    const levelSeparators = document.querySelectorAll('.level-separator');
    
    levelItems.forEach((item, index) => {
      item.classList.remove('active', 'completed');
      if (index < currentLevel) {
        item.classList.add('completed');
      } else if (index === currentLevel) {
        item.classList.add('active');
      }
    });
    
    levelSeparators.forEach((sep, index) => {
      sep.classList.remove('completed');
      if (index < currentLevel) {
        sep.classList.add('completed');
      }
    });
  }

  function fallSpeed() {
    return LEVELS[currentLevel].speed;
  }

  // Gap between spawns based on current speed
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

    if (tilesHit >= 30 && Math.random() < 0.25) {
      spawnTileAt(pickCol([col]));
    }

    const delay = Math.random() < 0.5 ? gapTouch() : gapOne();
    beatTimer = setTimeout(onBeat, delay);
  }

  function updateScore() {
    if (!running) return;
    
    // Calculate score based on time elapsed (in deciseconds, like real Piano Tiles)
    const elapsed = (Date.now() - gameStartTime) / 100; // 100ms = 1 point
    score = Math.floor(elapsed);
    scoreEl.textContent = score;
    
    // Update level if threshold crossed
    const newLevel = getCurrentLevel();
    if (newLevel !== currentLevel) {
      currentLevel = newLevel;
      updateLevelBar();
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

    // Update score based on time
    updateScore();

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

  async function saveToSupabase(name, scoreVal) {
    if (typeof sb === 'undefined') {
      console.log('Supabase not initialized');
      return false;
    }
    
    try {
      const { data: { session }, error: sessionError } = await sb.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        return false;
      }
      
      if (!session) {
        console.log('No active session');
        return false;
      }

      // Check existing score
      const { data: existing, error: fetchError } = await sb
        .from('scores')
        .select('payload')
        .eq('player_id', session.user.id)
        .eq('game', 'piano')
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        return false;
      }

      // Don't save if existing score is better
      if (existing?.payload?.score >= scoreVal) {
        console.log('Existing score is better, skipping save');
        return true;
      }

      // Upsert new score WITH NAME
      const { error: upsertError } = await sb
        .from('scores')
        .upsert({
          player_id: session.user.id,
          game: 'piano',
          payload: { score: scoreVal, name: name }
        }, { onConflict: 'player_id,game' });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        return false;
      }

      console.log('Score saved to Supabase successfully');
      return true;

    } catch (err) {
      console.error('Unexpected error in saveToSupabase:', err);
      return false;
    }
  }

  async function saveScore(name, scoreVal) {
    // Save to Supabase first (if user is logged in)
    const supabaseSuccess = await saveToSupabase(name, scoreVal);
    
    if (!supabaseSuccess) {
      console.log('Supabase save failed or skipped, saving to localStorage only');
    }

    // Always save to localStorage as backup
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
        // Use the name from payload if it exists, otherwise fallback to display_name
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
    
    // Show loading state
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

  // Check auth status on load
  window.addEventListener('load', async () => {
    const loggedIn = await checkAuthStatus();
    if (!loggedIn) {
      console.log('Not logged in - scores will be saved locally only');
    } else {
      console.log('Logged in - scores will sync to leaderboard');
    }
  });

  show('menu');
})();


