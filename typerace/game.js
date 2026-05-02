(() => {
  const TEXTS = [
    'The quick brown fox jumps over the lazy dog near the river bank.',
    'Pack my box with five dozen liquor jugs before the party starts.',
    'Coding is the art of telling computers exactly what to do step by step.',
    'Every great developer you know got there by solving problems they once did not understand.',
    'Practice makes perfect, especially when it comes to typing fast and accurately.',
    'The best way to predict the future is to invent it yourself through hard work.',
    'Speed and accuracy go hand in hand when you train yourself to type every single day.',
    'Stay curious, keep learning, and never stop building things that matter to you.',
    'In the middle of every difficulty lies an opportunity to grow stronger and wiser.',
    'Success is not final and failure is not fatal, what counts is the courage to continue.',
    'The five boxing wizards jump quickly across the frozen lake at dawn.',
    'How vexingly quick daft zebras jump over the old stone wall by the farm.',
    'Life is what happens when you are busy making other plans for the future.',
    'If you want to go fast go alone, but if you want to go far then go together.',
    'The only way to do great work is to love what you do each and every day.',
  ];

  // State
  let phase = 'menu';
  let roomCode = null;
  let isHost = false;
  let channel = null;
  let myId = null;
  let myName = 'You';
  let opponentName = 'Opponent';
  let currentText = '';
  let raceStartTime = 0;
  let lastBroadcast = 0;
  let myDoneWpm = 0;
  let oppDoneWpm = 0;

  const $ = id => document.getElementById(id);

  const screens = {
    menu:      $('screenMenu'),
    lobby:     $('screenLobby'),
    countdown: $('screenCountdown'),
    race:      $('screenRace'),
    result:    $('screenResult'),
  };

  function show(name) {
    phase = name;
    Object.values(screens).forEach(s => { s.style.display = 'none'; });
    screens[name].style.display = 'flex';
  }

  function genCode() {
    const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += pool[Math.floor(Math.random() * pool.length)];
    return c;
  }

  function pickText() {
    return TEXTS[Math.floor(Math.random() * TEXTS.length)];
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function initUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return false;
    myId = session.user.id;
    myName = session.user.user_metadata?.display_name
      || session.user.email?.split('@')[0]
      || 'Player';
    return true;
  }

  function setupChannel(code) {
    if (channel) sb.removeChannel(channel);

    channel = sb.channel(`type-race:${code}`);

    channel.on('presence', { event: 'sync' }, () => {
      if (phase !== 'lobby') return;

      const state = channel.presenceState();
      const players = Object.values(state).flat();

      const opp = players.find(p => p.userId !== myId);
      if (opp) {
        opponentName = opp.displayName;
        $('oppLabel').textContent = opponentName;
      }

      $('playerList').innerHTML = players
        .map(p => `<div class="player-chip">${esc(p.displayName)}</div>`)
        .join('');
      $('lobbyStatus').textContent = players.length >= 2
        ? 'Starting soon…' : 'Waiting for opponent…';

      if (isHost && players.length >= 2) {
        const text = pickText();
        channel.send({ type: 'broadcast', event: 'start', payload: { text } });
        beginCountdown(text);
      }
    });

    channel.on('presence', { event: 'leave' }, () => {
      if (phase === 'race') {
        endRace('win', 'Opponent disconnected. You win!', myDoneWpm || 0);
      } else if (phase === 'lobby') {
        $('lobbyStatus').textContent = 'Opponent left. Waiting…';
        $('playerList').innerHTML = `<div class="player-chip">${esc(myName)}</div>`;
      }
    });

    channel.on('broadcast', { event: 'start' }, ({ payload }) => {
      if (!isHost && phase === 'lobby') {
        beginCountdown(payload.text);
      }
    });

    channel.on('broadcast', { event: 'progress' }, ({ payload }) => {
      if (phase !== 'race') return;
      if (payload.name) $('oppLabel').textContent = payload.name;
      $('oppBar').style.width = (payload.pct * 100) + '%';
      $('oppWpm').textContent = payload.wpm + ' WPM';
    });

    channel.on('broadcast', { event: 'done' }, ({ payload }) => {
      if (phase !== 'race') return;
      oppDoneWpm = payload.wpm;
      $('oppBar').style.width = '100%';
      $('oppWpm').textContent = payload.wpm + ' WPM';
      if (myDoneWpm === 0) {
        endRace('lose', (payload.name || opponentName) + ' finished first!', 0);
      }
    });

    channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: myId, displayName: myName });
      }
    });
  }

  function beginCountdown(text) {
    if (phase !== 'lobby') return;
    currentText = text;
    show('countdown');

    let n = 3;
    $('countdownNum').textContent = n;

    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        startRace();
      } else {
        $('countdownNum').textContent = n;
      }
    }, 1000);
  }

  function startRace() {
    myDoneWpm = 0;
    oppDoneWpm = 0;
    raceStartTime = Date.now();

    $('myLabel').textContent = myName;
    $('oppLabel').textContent = opponentName;
    $('myBar').style.width = '0%';
    $('oppBar').style.width = '0%';
    $('myWpm').textContent = '– WPM';
    $('oppWpm').textContent = '– WPM';
    $('typeInput').value = '';

    renderText('');
    show('race');
    setTimeout(() => $('typeInput').focus(), 50);
  }

  function renderText(typed) {
    const text = currentText;
    let correctEnd = 0;
    while (
      correctEnd < typed.length &&
      correctEnd < text.length &&
      typed[correctEnd] === text[correctEnd]
    ) correctEnd++;

    let html = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i] === ' ' ? '&nbsp;' : esc(text[i]);
      if (i < correctEnd) {
        html += `<span class="c-ok">${ch}</span>`;
      } else if (i < typed.length) {
        html += `<span class="c-err">${ch}</span>`;
      } else if (i === typed.length) {
        html += `<span class="c-cur">${ch}</span>`;
      } else {
        html += `<span>${ch}</span>`;
      }
    }
    $('textBox').innerHTML = html;
    return correctEnd;
  }

  function calcWpm(chars) {
    const mins = (Date.now() - raceStartTime) / 60000;
    return mins < 0.001 ? 0 : Math.round((chars / 5) / mins);
  }

  $('typeInput').addEventListener('input', () => {
    if (phase !== 'race') return;
    const typed = $('typeInput').value;
    const correct = renderText(typed);
    const pct = correct / currentText.length;
    const speed = calcWpm(correct);

    $('myBar').style.width = (pct * 100) + '%';
    $('myWpm').textContent = speed + ' WPM';

    const now = Date.now();
    if (now - lastBroadcast > 80) {
      lastBroadcast = now;
      channel.send({
        type: 'broadcast',
        event: 'progress',
        payload: { pct, wpm: speed, name: myName },
      });
    }

    if (correct === currentText.length) {
      myDoneWpm = speed;
      channel.send({
        type: 'broadcast',
        event: 'done',
        payload: { wpm: speed, name: myName },
      });
      if (oppDoneWpm > 0) {
        endRace('lose', opponentName + ' finished first!', speed);
      } else {
        endRace('win', 'You win! 🏆', speed);
      }
    }
  });

  $('typeInput').addEventListener('paste', e => e.preventDefault());

  function endRace(outcome, heading, speed) {
    $('resultEmoji').textContent = outcome === 'win' ? '🏆' : '😔';
    $('resultHeading').textContent = heading;
    $('resultDetail').textContent = speed > 0 ? `Your speed: ${speed} WPM` : '';
    show('result');
  }

  function leaveRoom() {
    if (channel) { sb.removeChannel(channel); channel = null; }
  }

  $('createBtn').addEventListener('click', async () => {
    if (!await initUser()) return;
    roomCode = genCode();
    isHost = true;
    $('lobbyTitle').textContent = 'Waiting for Opponent';
    $('codeBox').style.display = 'flex';
    $('codeDisplay').textContent = roomCode;
    show('lobby');
    setupChannel(roomCode);
  });

  $('joinBtn').addEventListener('click', async () => {
    const code = $('codeInput').value.trim().toUpperCase();
    if (code.length !== 4) { alert('Enter a 4-letter room code.'); return; }
    if (!await initUser()) return;
    roomCode = code;
    isHost = false;
    $('lobbyTitle').textContent = 'Joining Room ' + code;
    $('codeBox').style.display = 'none';
    show('lobby');
    setupChannel(roomCode);
  });

  $('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('joinBtn').click();
  });

  $('backFromLobbyBtn').addEventListener('click', () => {
    leaveRoom();
    show('menu');
  });

  $('playAgainBtn').addEventListener('click', () => {
    leaveRoom();
    show('menu');
  });

  show('menu');
})();
