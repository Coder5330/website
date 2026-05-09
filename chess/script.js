// ============================================================
//  CHESS — engine + Stockfish AI + online play
//  Board: flat Int8Array[64], index = row*8+col
//  row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)
//  Pieces: 0=empty, positive=white, negative=black
//  PAWN=1 KNIGHT=2 BISHOP=3 ROOK=4 QUEEN=5 KING=6
// ============================================================

'use strict';

// ── Piece constants ──────────────────────────────────────────
const EMPTY  = 0;
const PAWN   = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK   = 4;
const QUEEN  = 5;
const KING   = 6;

const WHITE =  1;
const BLACK = -1;

const PIECE_VALUE = { [PAWN]:1, [KNIGHT]:3, [BISHOP]:3, [ROOK]:5, [QUEEN]:9, [KING]:0 };
const PIECE_ORDER = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING]; // sort order for display

// Piece images from assets/
const PIECE_IMG = {
  [WHITE]: { [PAWN]:'wpawn', [KNIGHT]:'wknight', [BISHOP]:'wbishop', [ROOK]:'wrook', [QUEEN]:'wqueen', [KING]:'wking' },
  [BLACK]: { [PAWN]:'bpawn', [KNIGHT]:'bknight', [BISHOP]:'bbishop', [ROOK]:'brook', [QUEEN]:'bqueen', [KING]:'bking' },
};
function pieceImg(p, size = '80%') {
  const name = PIECE_IMG[pieceColor(p)][absPiece(p)];
  return `<img src="assets/${name}.png" style="width:${size};height:${size};pointer-events:none" draggable="false" alt="${name}">`;
}

// ── Game State ───────────────────────────────────────────────
function createState() {
  return {
    board: new Int8Array(64),
    turn: WHITE,
    enPassant: -1,
    castling: {
      whiteKingside:  true,
      whiteQueenside: true,
      blackKingside:  true,
      blackQueenside: true,
    },
    halfmoveClock: 0,
    fullmoveNumber: 1,
    capturedByWhite: [],  // black pieces white captured
    capturedByBlack: [],  // white pieces black captured
    lastMove: null,
    gameOver: false,
    gameOverMsg: '',
  };
}

function setupBoard(state) {
  const b = state.board;
  b.fill(0);
  b[0]=-ROOK; b[1]=-KNIGHT; b[2]=-BISHOP; b[3]=-QUEEN;
  b[4]=-KING; b[5]=-BISHOP; b[6]=-KNIGHT; b[7]=-ROOK;
  for (let c = 0; c < 8; c++) b[8+c] = -PAWN;
  b[56]=ROOK; b[57]=KNIGHT; b[58]=BISHOP; b[59]=QUEEN;
  b[60]=KING; b[61]=BISHOP; b[62]=KNIGHT; b[63]=ROOK;
  for (let c = 0; c < 8; c++) b[48+c] = PAWN;
}

// ── Helpers ──────────────────────────────────────────────────
const row        = sq => (sq / 8) | 0;
const col        = sq => sq % 8;
const sq         = (r, c) => r * 8 + c;
const inBounds   = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const pieceColor = p => p > 0 ? WHITE : (p < 0 ? BLACK : 0);
const absPiece   = p => Math.abs(p);

function cloneState(s) {
  const n = createState();
  n.board.set(s.board);
  n.turn          = s.turn;
  n.enPassant     = s.enPassant;
  n.castling      = { ...s.castling };
  n.halfmoveClock = s.halfmoveClock;
  n.fullmoveNumber= s.fullmoveNumber;
  n.lastMove      = s.lastMove;
  n.gameOver      = s.gameOver;
  // skip capturedBy* — not needed by AI
  return n;
}

// ── Move Generation ──────────────────────────────────────────
function pseudoMoves(state, color) {
  const moves = [];
  const b = state.board;
  const ep = state.enPassant;

  for (let from = 0; from < 64; from++) {
    const p = b[from];
    if (!p || pieceColor(p) !== color) continue;
    const kind = absPiece(p);
    const r = row(from), c = col(from);

    if (kind === PAWN) {
      const dir = (color === WHITE) ? -1 : 1;
      const startRow = (color === WHITE) ? 6 : 1;
      const promRow  = (color === WHITE) ? 0 : 7;

      const r1 = r + dir;
      if (inBounds(r1, c) && b[sq(r1,c)] === 0) {
        if (r1 === promRow) {
          for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT])
            moves.push({ from, to: sq(r1,c), promotion: promo });
        } else {
          moves.push({ from, to: sq(r1,c) });
          const r2 = r + 2*dir;
          if (r === startRow && b[sq(r2,c)] === 0)
            moves.push({ from, to: sq(r2,c) });
        }
      }

      for (const dc of [-1, 1]) {
        const nc = c + dc;
        const nr = r + dir;
        if (!inBounds(nr, nc)) continue;
        const target = b[sq(nr,nc)];
        const toSq = sq(nr,nc);
        if (target !== 0 && pieceColor(target) === -color) {
          if (nr === promRow) {
            for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT])
              moves.push({ from, to: toSq, promotion: promo });
          } else {
            moves.push({ from, to: toSq });
          }
        }
        if (ep === toSq) moves.push({ from, to: toSq, enPassant: true });
      }
    }

    else if (kind === KNIGHT) {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (!inBounds(nr,nc)) continue;
        const t = b[sq(nr,nc)];
        if (t === 0 || pieceColor(t) === -color)
          moves.push({ from, to: sq(nr,nc) });
      }
    }

    else if (kind === BISHOP || kind === QUEEN) {
      for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        let nr=r+dr, nc=c+dc;
        while (inBounds(nr,nc)) {
          const t = b[sq(nr,nc)];
          if (t === 0) { moves.push({ from, to: sq(nr,nc) }); }
          else { if (pieceColor(t) === -color) moves.push({ from, to: sq(nr,nc) }); break; }
          nr+=dr; nc+=dc;
        }
      }
      if (kind === BISHOP) continue;
    }

    if (kind === ROOK || kind === QUEEN) {
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        let nr=r+dr, nc=c+dc;
        while (inBounds(nr,nc)) {
          const t = b[sq(nr,nc)];
          if (t === 0) { moves.push({ from, to: sq(nr,nc) }); }
          else { if (pieceColor(t) === -color) moves.push({ from, to: sq(nr,nc) }); break; }
          nr+=dr; nc+=dc;
        }
      }
    }

    else if (kind === KING) {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr=r+dr, nc=c+dc;
        if (!inBounds(nr,nc)) continue;
        const t = b[sq(nr,nc)];
        if (t === 0 || pieceColor(t) === -color)
          moves.push({ from, to: sq(nr,nc) });
      }
      if (color === WHITE && from === 60) {
        if (state.castling.whiteKingside  && b[61]===0 && b[62]===0 && b[63]===ROOK)
          moves.push({ from, to: 62, castle: 'KS' });
        if (state.castling.whiteQueenside && b[59]===0 && b[58]===0 && b[57]===0 && b[56]===ROOK)
          moves.push({ from, to: 58, castle: 'QS' });
      }
      if (color === BLACK && from === 4) {
        if (state.castling.blackKingside  && b[5]===0 && b[6]===0 && b[7]===-ROOK)
          moves.push({ from, to: 6, castle: 'KS' });
        if (state.castling.blackQueenside && b[3]===0 && b[2]===0 && b[1]===0 && b[0]===-ROOK)
          moves.push({ from, to: 2, castle: 'QS' });
      }
    }
  }
  return moves;
}

function isInCheck(state, color) {
  const b = state.board;
  const kingPiece = color * KING;
  let kingPos = -1;
  for (let i = 0; i < 64; i++) {
    if (b[i] === kingPiece) { kingPos = i; break; }
  }
  if (kingPos < 0) return true;
  const enemyMoves = pseudoMoves(state, -color);
  return enemyMoves.some(m => m.to === kingPos);
}

function applyMove(state, move) {
  const b = state.board;
  const { from, to } = move;
  const piece = b[from];
  const color = pieceColor(piece);
  const kind  = absPiece(piece);
  let captured = b[to];

  if (move.enPassant) {
    const epPawnRow = (color === WHITE) ? row(to)+1 : row(to)-1;
    const epPawnSq  = sq(epPawnRow, col(to));
    captured = b[epPawnSq];
    b[epPawnSq] = 0;
  }

  b[to] = piece;
  b[from] = 0;

  if (move.promotion) b[to] = color * move.promotion;

  if (move.castle) {
    if (color === WHITE) {
      if (move.castle === 'KS') { b[63]=0; b[61]=ROOK; }
      else                       { b[56]=0; b[59]=ROOK; }
    } else {
      if (move.castle === 'KS') { b[7]=0; b[5]=-ROOK; }
      else                       { b[0]=0; b[3]=-ROOK; }
    }
  }

  state.enPassant = -1;
  if (kind === PAWN && Math.abs(row(to) - row(from)) === 2)
    state.enPassant = sq((row(from)+row(to))/2, col(from));

  if (kind === KING) {
    if (color === WHITE) { state.castling.whiteKingside=false; state.castling.whiteQueenside=false; }
    else                 { state.castling.blackKingside=false; state.castling.blackQueenside=false; }
  }
  if (kind === ROOK) {
    if (from===56) state.castling.whiteQueenside=false;
    if (from===63) state.castling.whiteKingside=false;
    if (from===0)  state.castling.blackQueenside=false;
    if (from===7)  state.castling.blackKingside=false;
  }
  if (to===56) state.castling.whiteQueenside=false;
  if (to===63) state.castling.whiteKingside=false;
  if (to===0)  state.castling.blackQueenside=false;
  if (to===7)  state.castling.blackKingside=false;

  if (kind === PAWN || captured !== 0) state.halfmoveClock = 0;
  else state.halfmoveClock++;

  if (color === BLACK) state.fullmoveNumber++;
  state.turn = -color;
  state.lastMove = { from, to };

  return captured;
}

function legalMoves(state, color) {
  const pseudo = pseudoMoves(state, color);
  const legal  = [];
  for (const move of pseudo) {
    if (move.castle) {
      const passThrough = (color === WHITE)
        ? (move.castle === 'KS' ? 61 : 59)
        : (move.castle === 'KS' ? 5  : 3);
      const kingStart = (color === WHITE) ? 60 : 4;
      if (isInCheck(state, color)) continue;
      const tmp1 = cloneState(state);
      tmp1.board[passThrough] = tmp1.board[kingStart];
      tmp1.board[kingStart]   = 0;
      if (isInCheck(tmp1, color)) continue;
    }
    const tmp = cloneState(state);
    applyMove(tmp, move);
    if (!isInCheck(tmp, color)) legal.push(move);
  }
  return legal;
}

// ── Position key for 3-fold repetition ───────────────────────
function positionKey(state) {
  // FEN fields 1-4 (board + turn + castling + ep) — ignore clocks
  return stateToFEN(state).split(' ').slice(0, 4).join(' ');
}

// ── Check game-over conditions ────────────────────────────────
function checkGameOver(state) {
  const moves = legalMoves(state, state.turn);
  if (moves.length === 0) {
    state.gameOver = true;
    if (isInCheck(state, state.turn)) {
      const winner = state.turn === WHITE ? 'Black' : 'White';
      state.gameOverMsg = `Checkmate! ${winner} wins!`;
    } else {
      state.gameOverMsg = 'Draw — Stalemate!';
    }
    return;
  }
  if (state.halfmoveClock >= 100) {
    state.gameOver = true;
    state.gameOverMsg = 'Draw — 50-move rule!';
    return;
  }
  // Threefold repetition
  const key = positionKey(state);
  let reps = 0;
  for (const k of positionHistory) { if (k === key) reps++; }
  if (reps >= 3) {
    state.gameOver = true;
    state.gameOverMsg = 'Draw — Threefold repetition!';
  }
}

// ── AI: Stockfish ─────────────────────────────────────────────
let _sf = null;
let _sfReady = false;
let _sfResolve = null;

async function getStockfish() {
  if (_sf && _sfReady) return _sf;
  if (!_sf) {
    const res  = await fetch('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
    const blob = await res.blob();
    _sf = new Worker(URL.createObjectURL(blob));
    _sf.onmessage = _sfMsg;
    _sf.postMessage('uci');
  }
  return new Promise(resolve => { _sfResolve = resolve; });
}

function _sfMsg(e) {
  const line = e.data;
  if (line === 'uciok') { _sf.postMessage('isready'); return; }
  if (line === 'readyok') { _sfReady = true; if (_sfResolve) { _sfResolve(_sf); _sfResolve = null; } return; }
  if (line.startsWith('bestmove') && _sfMoveResolve) {
    const parts = line.split(' ');
    _sfMoveResolve(parts[1] === '(none)' ? null : parts[1]);
    _sfMoveResolve = null;
  }
}
let _sfMoveResolve = null;

async function sfBestMove(fen, skillLevel, elo, moveTime) {
  const sf = await getStockfish();
  sf.postMessage('ucinewgame');
  sf.postMessage(`setoption name Skill Level value ${skillLevel}`);
  if (elo !== null) {
    sf.postMessage('setoption name UCI_LimitStrength value true');
    sf.postMessage(`setoption name UCI_Elo value ${elo}`);
  } else {
    sf.postMessage('setoption name UCI_LimitStrength value false');
  }
  sf.postMessage(`position fen ${fen}`);
  sf.postMessage(`go movetime ${moveTime}`);
  return new Promise(resolve => { _sfMoveResolve = resolve; });
}

// ── FEN generator ─────────────────────────────────────────────
function stateToFEN(state) {
  const CH = {1:'P',2:'N',3:'B',4:'R',5:'Q',6:'K'};
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let emp = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r*8+c];
      if (!p) { emp++; }
      else {
        if (emp) { fen += emp; emp = 0; }
        const ch = CH[Math.abs(p)];
        fen += p > 0 ? ch : ch.toLowerCase();
      }
    }
    if (emp) fen += emp;
    if (r < 7) fen += '/';
  }
  fen += ' ' + (state.turn === WHITE ? 'w' : 'b');
  let cas = '';
  if (state.castling.whiteKingside)  cas += 'K';
  if (state.castling.whiteQueenside) cas += 'Q';
  if (state.castling.blackKingside)  cas += 'k';
  if (state.castling.blackQueenside) cas += 'q';
  fen += ' ' + (cas || '-');
  if (state.enPassant >= 0) {
    fen += ' ' + String.fromCharCode(97 + col(state.enPassant)) + (8 - row(state.enPassant));
  } else fen += ' -';
  fen += ` ${state.halfmoveClock} ${state.fullmoveNumber}`;
  return fen;
}

// ── UCI → internal move ───────────────────────────────────────
const PIECE_CHARS = {1:'P',2:'N',3:'B',4:'R',5:'Q',6:'K'};

function uciToMove(uci, state) {
  if (!uci || uci === '(none)') return null;
  const fromFile = uci.charCodeAt(0) - 97;
  const fromRank = 8 - parseInt(uci[1]);
  const toFile   = uci.charCodeAt(2) - 97;
  const toRank   = 8 - parseInt(uci[3]);
  const from = fromRank * 8 + fromFile;
  const to   = toRank   * 8 + toFile;
  const promo = uci[4];
  const moves = legalMoves(state, state.turn);
  return moves.find(m => m.from === from && m.to === to &&
    (!promo || PIECE_CHARS[Math.abs(m.promotion || 0)]?.toLowerCase() === promo)
  ) || moves.find(m => m.from === from && m.to === to) || null;
}

// ── Difficulty levels ─────────────────────────────────────────
const SF_LEVELS = [
  { label:'Level 1 · Beginner',     skill:0,  elo:800,  time:100  },
  { label:'Level 2 · Novice',       skill:3,  elo:1000, time:200  },
  { label:'Level 3 · Casual',       skill:5,  elo:1200, time:300  },
  { label:'Level 4 · Club',         skill:8,  elo:1400, time:500  },
  { label:'Level 5 · Intermediate', skill:11, elo:1600, time:700  },
  { label:'Level 6 · Advanced',     skill:14, elo:1800, time:1000 },
  { label:'Level 7 · Expert',       skill:17, elo:2000, time:1500 },
  { label:'Level 8 · Stockfish Max',skill:20, elo:null, time:2000 },
];

// ── Game Modes ────────────────────────────────────────────────
const MODE_PVP_LOCAL  = 'pvp-local';
const MODE_PVP_ONLINE = 'pvp-online';
const MODE_PVC_LOCAL  = 'pvc-local';
const MODE_CVC_LOCAL  = 'cvc-local';

// ── App State ─────────────────────────────────────────────────
let gameState       = createState();
let currentMode     = MODE_PVP_LOCAL;
let currentLevel    = 3;
let cvcLevelWhite   = 3;
let cvcLevelBlack   = 3;
let selected        = -1;
let legalMovesCache = [];
let cvcRunning      = false;
let aiThinking      = false;

let positionHistory = []; // position keys for 3-fold detection
let stateHistory    = []; // full snapshots for takeback

let dragSq          = -1; // source square during drag
let drawOfferSent   = false;
let takebackSent    = false;

// Online state
let onlineColor        = null;
let onlineChannel      = null;
let onlineRoomCode     = null;
let onlineOpponentName = '';
let onlineReady        = false;

// Time-control state
let currentTC      = null;
let clockWhite     = 0;
let clockBlack     = 0;
let clockInterval  = null;
let clockLastTick  = 0;

// Move list
let moveHistory = [];

// ── DOM refs ──────────────────────────────────────────────────
const boardEl          = document.getElementById('chess-board');
const statusTurnEl     = document.getElementById('status-turn');
const statusMsgEl      = document.getElementById('status-msg');
const statusOnlineEl   = document.getElementById('status-online');
const capturedWhiteEl  = document.getElementById('captured-white-pieces');
const capturedBlackEl  = document.getElementById('captured-black-pieces');
const advTopEl         = document.getElementById('adv-top');
const advBottomEl      = document.getElementById('adv-bottom');
const clockOpponentEl  = document.getElementById('clock-opponent');
const clockPlayerEl    = document.getElementById('clock-player');
const opponentNameEl   = document.getElementById('opponent-name');
const playerNameEl     = document.getElementById('player-name');
const moveListEl       = document.getElementById('move-list');
const lobbyEl          = document.getElementById('chess-lobby');
const gameEl           = document.getElementById('chess-game');
const modalOverlay     = document.getElementById('modal-overlay');
const modalBox         = document.getElementById('modal-box');
const btnBack          = document.getElementById('btn-back');
const btnResign        = document.getElementById('btn-resign');
const btnDraw          = document.getElementById('btn-draw');
const btnTakeback      = document.getElementById('btn-takeback');
const btnCvcOpen       = document.getElementById('btn-cvc-open');

// ── Toast system ──────────────────────────────────────────────
const _toastEl = (() => {
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
  return el;
})();
const _activeToasts = [];

function addToast(msg, type = 'info', actionHtml = '') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  if (actionHtml) {
    t.innerHTML = `<span>${msg}</span>${actionHtml}`;
    t.classList.add('toast-action');
  } else {
    t.textContent = msg;
  }
  _toastEl.appendChild(t);
  _activeToasts.push(t);
  while (_activeToasts.length > 5) _activeToasts.shift().remove();
  requestAnimationFrame(() => t.classList.add('toast-in'));
  const timer = setTimeout(() => {
    t.classList.add('toast-out');
    setTimeout(() => { t.remove(); const i = _activeToasts.indexOf(t); if (i >= 0) _activeToasts.splice(i, 1); }, 500);
  }, actionHtml ? 12000 : 3500);
  t._dismissTimer = timer;
  return t;
}

function dismissToast(t) {
  if (!t) return;
  clearTimeout(t._dismissTimer);
  t.classList.add('toast-out');
  setTimeout(() => { t.remove(); const i = _activeToasts.indexOf(t); if (i >= 0) _activeToasts.splice(i, 1); }, 500);
}

// ── Time-control definitions ──────────────────────────────────
const TIME_CONTROLS = [
  { label:'1+0',   base:60,    inc:0,  cat:'bullet'    },
  { label:'2+1',   base:120,   inc:1,  cat:'bullet'    },
  { label:'3+0',   base:180,   inc:0,  cat:'blitz'     },
  { label:'3+2',   base:180,   inc:2,  cat:'blitz'     },
  { label:'5+0',   base:300,   inc:0,  cat:'blitz'     },
  { label:'5+3',   base:300,   inc:3,  cat:'blitz'     },
  { label:'10+0',  base:600,   inc:0,  cat:'rapid'     },
  { label:'10+5',  base:600,   inc:5,  cat:'rapid'     },
  { label:'15+10', base:900,   inc:10, cat:'rapid'     },
  { label:'30+0',  base:1800,  inc:0,  cat:'classical' },
  { label:'30+20', base:1800,  inc:20, cat:'classical' },
  { label:'∞',     base:0,     inc:0,  cat:'unlimited' },
];

const CAT_LABELS = {
  bullet:'Bullet', blitz:'Blitz', rapid:'Rapid', classical:'Classical', unlimited:'Unlimited',
};

// ── Build lobby grid ──────────────────────────────────────────
function buildLobby() {
  const grid = document.getElementById('tc-grid');
  grid.innerHTML = '';
  for (const tc of TIME_CONTROLS) {
    const btn = document.createElement('button');
    btn.className = 'tc-btn';
    btn.innerHTML = `<span class="tc-time">${tc.label}</span>
      <span class="tc-cat ${tc.cat}">${CAT_LABELS[tc.cat]}</span>`;
    btn.addEventListener('click', () => openSetupModal(tc));
    grid.appendChild(btn);
  }
}

// ── Modal helpers ─────────────────────────────────────────────
function showModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.style.display = 'flex';
}
function hideModal() {
  modalOverlay.style.display = 'none';
  modalBox.innerHTML = '';
}
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) hideModal(); });

// ── Setup modal ───────────────────────────────────────────────
function openSetupModal(tc) {
  currentTC = tc;
  showModal(`
    <div class="modal-title">
      Choose how to play
      <button class="modal-close" id="m-close">&times;</button>
    </div>
    <hr class="modal-hr">
    <button class="modal-opt-btn" id="m-friend">&#128101; Play with a friend</button>
    <button class="modal-opt-btn" id="m-computer">&#129302; Play vs Computer</button>
    <button class="modal-opt-btn" id="m-local">&#127968; Local (2 players)</button>
  `);
  document.getElementById('m-close').addEventListener('click', hideModal);
  document.getElementById('m-friend').addEventListener('click', openOnlineModal);
  document.getElementById('m-computer').addEventListener('click', openComputerModal);
  document.getElementById('m-local').addEventListener('click', () => { hideModal(); startGame(MODE_PVP_LOCAL); });
}

// ── Online modal ──────────────────────────────────────────────
function openOnlineModal() {
  showModal(`
    <div class="modal-title">
      Play with a friend
      <button class="modal-close" id="m-close">&times;</button>
    </div>
    <hr class="modal-hr">
    <button class="modal-opt-btn" id="m-create">Create Game — get a code</button>
    <button class="modal-opt-btn" id="m-join-show">Join Game — enter a code</button>
    <div id="m-online-sub" style="display:none"></div>
  `);
  document.getElementById('m-close').addEventListener('click', hideModal);
  document.getElementById('m-create').addEventListener('click', () => { startGame(MODE_PVP_ONLINE, { role: 'creator' }); hideModal(); });
  document.getElementById('m-join-show').addEventListener('click', () => {
    const sub = document.getElementById('m-online-sub');
    sub.style.display = 'block';
    sub.innerHTML = `
      <div class="modal-sub">
        <div class="modal-sub-title">Enter room code</div>
        <div class="modal-join-row">
          <input type="text" id="m-code-input" placeholder="XXXXXX" maxlength="6">
          <button class="modal-opt-btn" style="width:auto;flex-shrink:0;margin:0" id="m-join-btn">Join</button>
        </div>
        <div class="modal-info-text" id="m-join-info"></div>
      </div>`;
    document.getElementById('m-join-btn').addEventListener('click', () => {
      const code = document.getElementById('m-code-input').value.trim().toUpperCase();
      if (code.length !== 6) { document.getElementById('m-join-info').textContent = 'Enter a valid 6-character code.'; return; }
      startGame(MODE_PVP_ONLINE, { role: 'joiner', code });
      hideModal();
    });
    document.getElementById('m-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('m-join-btn').click(); });
  });
}

// ── Computer modal ────────────────────────────────────────────
function openComputerModal() {
  showModal(`
    <div class="modal-title">
      Play vs Computer
      <button class="modal-close" id="m-close">&times;</button>
    </div>
    <hr class="modal-hr">
    <div class="modal-label">Difficulty</div>
    <div class="level-grid" id="m-level-grid"></div>
    <button class="modal-primary-btn" id="m-play-computer">Play</button>
  `);
  document.getElementById('m-close').addEventListener('click', hideModal);
  renderLevelPicker('m-level-grid', currentLevel, idx => { currentLevel = idx; });
  document.getElementById('m-play-computer').addEventListener('click', () => { hideModal(); startGame(MODE_PVC_LOCAL); });
}

// ── CvC modal ─────────────────────────────────────────────────
function openCvcModal() {
  showModal(`
    <div class="modal-title">
      CPU vs CPU
      <button class="modal-close" id="m-close">&times;</button>
    </div>
    <hr class="modal-hr">
    <div class="modal-label">White — Difficulty</div>
    <div class="level-grid" id="m-cvc-white"></div>
    <div class="modal-label">Black — Difficulty</div>
    <div class="level-grid" id="m-cvc-black"></div>
    <button class="modal-primary-btn" id="m-start-cvc">Start</button>
  `);
  document.getElementById('m-close').addEventListener('click', hideModal);
  renderLevelPicker('m-cvc-white', cvcLevelWhite, idx => { cvcLevelWhite = idx; });
  renderLevelPicker('m-cvc-black', cvcLevelBlack, idx => { cvcLevelBlack = idx; });
  document.getElementById('m-start-cvc').addEventListener('click', () => { hideModal(); currentTC = null; startGame(MODE_CVC_LOCAL); });
}

// ── Level picker ──────────────────────────────────────────────
function renderLevelPicker(containerId, activeIdx, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  SF_LEVELS.forEach((lv, idx) => {
    const btn = document.createElement('button');
    btn.className = 'level-pick-btn' + (idx === activeIdx ? ' active' : '');
    btn.textContent = `L${idx+1}`;
    btn.title = lv.label;
    btn.addEventListener('click', () => {
      onChange(idx);
      container.querySelectorAll('.level-pick-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
    });
    container.appendChild(btn);
  });
}

// ── Clock helpers ─────────────────────────────────────────────
function formatClock(secs) {
  if (secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ds = Math.floor((secs * 10) % 10);
  if (m >= 10) return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}.${ds}`;
}

function startClock() {
  stopClock();
  if (!currentTC || currentTC.base === 0) return;
  clockLastTick = performance.now();
  clockInterval = setInterval(tickClock, 100);
  renderClocks();
}
function stopClock() {
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
}

function tickClock() {
  if (gameState.gameOver) { stopClock(); return; }
  const now = performance.now();
  const delta = (now - clockLastTick) / 1000;
  clockLastTick = now;

  if (gameState.turn === WHITE) {
    clockWhite -= delta;
    if (clockWhite <= 0) { clockWhite = 0; stopClock(); endByTime(WHITE); return; }
  } else {
    clockBlack -= delta;
    if (clockBlack <= 0) { clockBlack = 0; stopClock(); endByTime(BLACK); return; }
  }
  renderClocks();
}

function addIncrement(color) {
  if (!currentTC || currentTC.inc === 0) return;
  if (color === WHITE) clockWhite += currentTC.inc;
  else                 clockBlack += currentTC.inc;
}

function endByTime(loserColor) {
  const name = loserColor === WHITE ? 'White' : 'Black';
  gameState.gameOver    = true;
  gameState.gameOverMsg = `${name} ran out of time!`;
  stopClock();
  renderClocks();
  updateStatus();
  updateBoard();
  addToast(gameState.gameOverMsg, 'gameover');
  setTimeout(() => showGameOverModal(gameState.gameOverMsg, '⏱ Out of time'), 600);
  saveGameResult();
}

function renderClocks() {
  const unlimited = !currentTC || currentTC.base === 0;
  let playerColor   = WHITE;
  let opponentColor = BLACK;
  if (currentMode === MODE_PVP_ONLINE && onlineColor !== null) {
    playerColor   = onlineColor;
    opponentColor = -onlineColor;
  }
  const playerSecs   = playerColor   === WHITE ? clockWhite : clockBlack;
  const opponentSecs = opponentColor === WHITE ? clockWhite : clockBlack;

  if (unlimited) {
    clockPlayerEl.classList.add('empty');
    clockOpponentEl.classList.add('empty');
    return;
  }
  clockPlayerEl.classList.remove('empty');
  clockOpponentEl.classList.remove('empty');
  clockPlayerEl.textContent   = formatClock(playerSecs);
  clockOpponentEl.textContent = formatClock(opponentSecs);
  clockPlayerEl.classList.toggle('active',   gameState.turn === playerColor   && !gameState.gameOver);
  clockOpponentEl.classList.toggle('active', gameState.turn === opponentColor && !gameState.gameOver);
}

// ── Show/hide lobby vs game ────────────────────────────────────
function showLobby() {
  stopClock();
  stopCvC();
  leaveOnlineRoom();
  lobbyEl.style.display = 'flex';
  gameEl.style.display  = 'none';
}
function showGame() {
  lobbyEl.style.display = 'none';
  gameEl.style.display  = 'block';
}

// ── Start game ────────────────────────────────────────────────
async function startGame(mode, opts = {}) {
  stopCvC();
  leaveOnlineRoom();
  aiThinking    = false;
  drawOfferSent = false;
  takebackSent  = false;

  currentMode     = mode;
  selected        = -1;
  legalMovesCache = [];
  moveHistory     = [];
  positionHistory = [];
  stateHistory    = [];

  gameState = createState();
  setupBoard(gameState);

  if (currentTC && currentTC.base > 0) {
    clockWhite = currentTC.base;
    clockBlack = currentTC.base;
  } else {
    clockWhite = clockBlack = 0;
  }

  let myName = 'You', oppName = '';
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: user } = await sb.from('users').select('display_name').eq('id', session.user.id).maybeSingle();
      if (user?.display_name) myName = user.display_name;
    }
  } catch {}

  if (mode === MODE_PVC_LOCAL) {
    oppName = SF_LEVELS[currentLevel].label;
  } else if (mode === MODE_CVC_LOCAL) {
    oppName = SF_LEVELS[cvcLevelBlack].label;
    myName  = SF_LEVELS[cvcLevelWhite].label;
  } else if (mode === MODE_PVP_ONLINE) {
    oppName = 'Waiting…';
  } else {
    oppName = 'Player 2';
  }

  playerNameEl.textContent   = myName;
  opponentNameEl.textContent = oppName;

  const isHuman = (mode === MODE_PVP_LOCAL || mode === MODE_PVC_LOCAL || mode === MODE_PVP_ONLINE);
  btnResign.style.display   = isHuman ? '' : 'none';
  btnDraw.style.display     = (mode === MODE_PVP_LOCAL || mode === MODE_PVP_ONLINE) ? '' : 'none';
  btnTakeback.style.display = isHuman ? '' : 'none';

  showGame();
  initBoard();
  updateBoard();
  updateStatus();
  renderMoveList();
  renderClocks();

  if (mode === MODE_PVP_ONLINE) {
    if (opts.role === 'creator') {
      await createOnlineGame();
    } else if (opts.role === 'joiner' && opts.code) {
      onlineRoomCode = opts.code;
      onlineColor    = BLACK;
      statusOnlineEl.textContent = 'Joining…';
      statusOnlineEl.style.display = 'block';
      await joinChannel(opts.code, 'joiner', myName);
    }
    return;
  }

  startClock();

  if (mode === MODE_CVC_LOCAL) {
    setTimeout(startCvC, 600);
  } else if (mode === MODE_PVC_LOCAL && gameState.turn === BLACK) {
    scheduleAI(300);
  }
}

// ── Board rendering (stable DOM) ──────────────────────────────

function initBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.dataset.sq = i;
    boardEl.appendChild(cell);
  }
}

function updateBoard() {
  const cells = boardEl.children;
  if (cells.length !== 64) initBoard();

  const legalSet   = new Set(legalMovesCache.map(m => m.to));
  const captureSet = new Set(legalMovesCache.filter(m => gameState.board[m.to] !== 0 || m.enPassant).map(m => m.to));
  const lastFrom   = gameState.lastMove ? gameState.lastMove.from : -1;
  const lastTo     = gameState.lastMove ? gameState.lastMove.to   : -1;

  // Find king in check
  let checkSq = -1;
  if (!gameState.gameOver && isInCheck(gameState, gameState.turn)) {
    const kp = gameState.turn * KING;
    for (let i = 0; i < 64; i++) { if (gameState.board[i] === kp) { checkSq = i; break; } }
  }

  for (let i = 0; i < 64; i++) {
    const cell = cells[i];
    const r = (i / 8) | 0, c = i % 8;
    let cn = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

    if (i === selected)                       cn += ' selected';
    if (i === lastFrom || i === lastTo)       cn += ' last-move';
    if (i === checkSq)                        cn += ' in-check';
    if (selected >= 0 && legalSet.has(i))
      cn += captureSet.has(i) ? ' legal-capture' : ' legal-move';

    const p = gameState.board[i];
    if (p !== 0) cn += ' has-piece';
    if (cell.className !== cn) cell.className = cn;

    const newHtml = p !== 0
      ? `<span class="piece">${pieceImg(p)}</span>`
      : '';
    if (cell.innerHTML !== newHtml) cell.innerHTML = newHtml;
  }

  renderCaptured();
}

// ── Captured pieces & material advantage ─────────────────────
function sortCaptured(pieces) {
  return [...pieces].sort((a, b) => {
    const oa = PIECE_ORDER.indexOf(absPiece(a));
    const ob = PIECE_ORDER.indexOf(absPiece(b));
    return oa - ob;
  });
}

function renderCaptured() {
  // capturedByWhite = black pieces white took → shown at bottom (player side)
  // capturedByBlack = white pieces black took → shown at top (opponent side)
  const byWhite = sortCaptured(gameState.capturedByWhite);
  const byBlack = sortCaptured(gameState.capturedByBlack);

  capturedWhiteEl.innerHTML = byWhite.map(p => pieceImg(p,   '16px')).join('');
  capturedBlackEl.innerHTML = byBlack.map(p => pieceImg(-p,  '16px')).join('');

  const whiteMat = byWhite.reduce((s, p) => s + PIECE_VALUE[absPiece(p)], 0);
  const blackMat = byBlack.reduce((s, p) => s + PIECE_VALUE[absPiece(p)], 0);
  const diff = whiteMat - blackMat;

  // Advantage shown on the side that's AHEAD, near their captures
  advBottomEl.textContent = diff > 0 ? `+${diff}` : '';
  advTopEl.textContent    = diff < 0 ? `+${-diff}` : '';
}

// ── Status panel ──────────────────────────────────────────────
function updateStatus() {
  if (gameState.gameOver) {
    statusTurnEl.textContent = gameState.gameOverMsg;
    statusMsgEl.textContent  = '';
    stopClock();
    return;
  }
  const turnName = gameState.turn === WHITE ? 'White' : 'Black';
  statusTurnEl.textContent = `${turnName}'s turn`;
  const inCheck = isInCheck(gameState, gameState.turn);
  statusMsgEl.textContent = inCheck ? `${turnName} is in check!` : '';
}

// ── Move notation ─────────────────────────────────────────────
const FILE_CHARS = ['a','b','c','d','e','f','g','h'];
const PIECE_SYM  = {[PAWN]:'', [KNIGHT]:'N', [BISHOP]:'B', [ROOK]:'R', [QUEEN]:'Q', [KING]:'K'};

function moveToSAN(state, move) {
  if (move.castle === 'KS') return 'O-O';
  if (move.castle === 'QS') return 'O-O-O';
  const piece   = state.board[move.from];
  const kind    = absPiece(piece);
  const capture = state.board[move.to] !== 0 || move.enPassant;
  let san = PIECE_SYM[kind];
  if (kind === PAWN && capture) san += FILE_CHARS[col(move.from)];
  if (capture) san += 'x';
  san += FILE_CHARS[col(move.to)] + (8 - row(move.to));
  if (move.promotion) san += '=' + PIECE_SYM[move.promotion];
  return san;
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  for (let i = 0; i < moveHistory.length; i++) {
    if (i % 2 === 0) {
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = `${(i/2|0)+1}.`;
      moveListEl.appendChild(num);
    }
    const tok = document.createElement('span');
    tok.className = 'move-token' + (i === moveHistory.length - 1 ? ' latest' : '');
    tok.textContent = moveHistory[i];
    moveListEl.appendChild(tok);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

// ── Promotion dialog ──────────────────────────────────────────
function showPromotionDialog(color, moves, callback) {
  const pieces = [QUEEN, ROOK, BISHOP, KNIGHT];
  showModal(`
    <div class="modal-title">Promote pawn</div>
    <div class="promo-grid">
      ${pieces.map(p => `
        <button class="promo-btn" data-piece="${p}">
          ${pieceImg(color * p, '48px')}
        </button>`).join('')}
    </div>
  `);
  modalBox.querySelectorAll('.promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.piece);
      const move = moves.find(m => m.promotion === p);
      hideModal();
      if (move) callback(move);
    });
  });
}

// ── Game-over overlay ─────────────────────────────────────────
function showGameOverModal(title, sub = '') {
  showModal(`
    <div class="gameover-header">${title}</div>
    ${sub ? `<div class="gameover-sub">${sub}</div>` : ''}
    <div class="gameover-btns">
      <button class="modal-primary-btn" id="go-rematch">Rematch</button>
      <button class="modal-opt-btn" id="go-lobby">Lobby</button>
    </div>
  `);
  document.getElementById('go-rematch').addEventListener('click', () => { hideModal(); startGame(currentMode); });
  document.getElementById('go-lobby').addEventListener('click',   () => { hideModal(); showLobby(); });
}

// ── Cell click handler ────────────────────────────────────────
function onCellClick(e) {
  const cell = e.currentTarget;
  const clickedSq = parseInt(cell.dataset.sq);
  if (gameState.gameOver) return;
  if (!isHumanTurn()) return;
  if (currentMode === MODE_PVP_ONLINE) {
    if (!onlineReady) return;
    if (gameState.turn !== onlineColor) return;
  }

  const pieceOnSquare = gameState.board[clickedSq];
  const ownColor      = gameState.turn;

  // Click same piece → deselect
  if (selected === clickedSq) {
    selected = -1;
    legalMovesCache = [];
    updateBoard();
    return;
  }

  if (selected >= 0) {
    const moveCandidates = legalMovesCache.filter(m => m.to === clickedSq);
    if (moveCandidates.length > 0) {
      // Promotion?
      if (moveCandidates[0].promotion !== undefined) {
        showPromotionDialog(ownColor, moveCandidates, move => {
          executeMove(move);
          selected = -1;
          legalMovesCache = [];
        });
      } else {
        executeMove(moveCandidates[0]);
        selected = -1;
        legalMovesCache = [];
      }
      return;
    }
    // Re-select own piece
    if (pieceOnSquare !== 0 && pieceColor(pieceOnSquare) === ownColor) {
      selected = clickedSq;
      legalMovesCache = legalMoves(gameState, ownColor).filter(m => m.from === clickedSq);
      updateBoard();
      return;
    }
    // Click empty/enemy with no legal move → deselect
    selected = -1;
    legalMovesCache = [];
    updateBoard();
    return;
  }

  // No piece selected yet
  if (pieceOnSquare !== 0 && pieceColor(pieceOnSquare) === ownColor) {
    selected = clickedSq;
    legalMovesCache = legalMoves(gameState, ownColor).filter(m => m.from === clickedSq);
    updateBoard();
  }
}

// ── Drag and drop ─────────────────────────────────────────────
boardEl.addEventListener('dragstart', e => {
  if (gameState.gameOver || !isHumanTurn()) return;
  if (currentMode === MODE_PVP_ONLINE && (!onlineReady || gameState.turn !== onlineColor)) return;
  const cell = e.target.closest('[data-sq]');
  if (!cell) return;
  const s = parseInt(cell.dataset.sq);
  const p = gameState.board[s];
  if (!p || pieceColor(p) !== gameState.turn) return;
  dragSq = s;
  selected = s;
  legalMovesCache = legalMoves(gameState, gameState.turn).filter(m => m.from === s);
  updateBoard();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(s));
});

boardEl.addEventListener('dragover', e => {
  e.preventDefault();
  const cell = e.target.closest('[data-sq]');
  if (cell) e.dataTransfer.dropEffect = 'move';
});

boardEl.addEventListener('dragenter', e => {
  const cell = e.target.closest('[data-sq]');
  if (!cell) return;
  boardEl.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
  if (dragSq >= 0) cell.classList.add('drag-over');
});

boardEl.addEventListener('dragleave', e => {
  const cell = e.target.closest('[data-sq]');
  if (cell) cell.classList.remove('drag-over');
});

boardEl.addEventListener('drop', e => {
  e.preventDefault();
  boardEl.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
  if (dragSq < 0) return;
  const cell = e.target.closest('[data-sq]');
  if (!cell) { dragSq = -1; return; }
  const toSq = parseInt(cell.dataset.sq);
  const moveCandidates = legalMovesCache.filter(m => m.to === toSq);
  dragSq = -1;

  if (moveCandidates.length === 0) {
    selected = -1;
    legalMovesCache = [];
    updateBoard();
    return;
  }
  if (moveCandidates[0].promotion !== undefined) {
    showPromotionDialog(gameState.turn, moveCandidates, move => {
      executeMove(move);
      selected = -1;
      legalMovesCache = [];
    });
  } else {
    executeMove(moveCandidates[0]);
    selected = -1;
    legalMovesCache = [];
  }
});

boardEl.addEventListener('dragend', () => {
  dragSq = -1;
  boardEl.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
});

// Wire click listeners to each cell (delegated through boardEl)
boardEl.addEventListener('click', e => {
  const cell = e.target.closest('[data-sq]');
  if (cell) onCellClick({ currentTarget: cell });
});

function isHumanTurn() {
  if (currentMode === MODE_CVC_LOCAL) return false;
  if (currentMode === MODE_PVC_LOCAL && gameState.turn === BLACK) return false;
  return true;
}

// ── Execute move ──────────────────────────────────────────────
function executeMove(move, broadcast = true) {
  const movedColor = gameState.turn;
  const san = moveToSAN(gameState, move);

  // Track captures for toast + capturedBy arrays
  let capturedPiece = gameState.board[move.to];
  if (move.enPassant) {
    const epRow = (movedColor === WHITE) ? row(move.to)+1 : row(move.to)-1;
    capturedPiece = gameState.board[sq(epRow, col(move.to))];
  }
  if (capturedPiece !== 0) {
    if (movedColor === WHITE) gameState.capturedByWhite.push(capturedPiece);
    else                      gameState.capturedByBlack.push(capturedPiece);

    const captor = movedColor === WHITE ? 'White' : 'Black';
    const pName = ['','Pawn','Knight','Bishop','Rook','Queen','King'][absPiece(capturedPiece)];
    addToast(`${captor} captured ${pName}`, 'capture');
  } else if (move.enPassant) {
    addToast(`${movedColor === WHITE ? 'White' : 'Black'} captured en passant`, 'capture');
  }

  // Save snapshot for takeback (deep enough for board + lists)
  stateHistory.push({
    board:           new Int8Array(gameState.board),
    turn:            gameState.turn,
    enPassant:       gameState.enPassant,
    castling:        { ...gameState.castling },
    halfmoveClock:   gameState.halfmoveClock,
    fullmoveNumber:  gameState.fullmoveNumber,
    capturedByWhite: [...gameState.capturedByWhite],
    capturedByBlack: [...gameState.capturedByBlack],
    lastMove:        gameState.lastMove ? { ...gameState.lastMove } : null,
    moveHistorySnap: [...moveHistory],
    posHistorySnap:  [...positionHistory],
    clockWhite, clockBlack,
  });

  applyMove(gameState, move);
  addIncrement(movedColor);

  // Record position AFTER move for 3-fold
  positionHistory.push(positionKey(gameState));

  checkGameOver(gameState);
  moveHistory.push(san);

  // Broadcast online
  if (broadcast && currentMode === MODE_PVP_ONLINE && onlineChannel) {
    onlineChannel.send({
      type: 'broadcast', event: 'move',
      payload: { from: move.from, to: move.to, promotion: move.promotion || null },
    });
  }

  selected = -1;
  legalMovesCache = [];
  updateBoard();
  updateStatus();
  renderMoveList();
  renderClocks();

  // Post-move toasts
  if (!gameState.gameOver) {
    if (isInCheck(gameState, gameState.turn)) {
      const cn = gameState.turn === WHITE ? 'White' : 'Black';
      addToast(`${cn} is in check!`, 'check');
    }
    if (gameState.halfmoveClock === 90) addToast('Warning: 5 moves left on 50-move rule', 'warn');
    if (gameState.halfmoveClock === 80) addToast('Warning: 10 moves left on 50-move rule', 'warn');
    if (currentMode === MODE_PVC_LOCAL && gameState.turn === BLACK) scheduleAI(300);
  } else {
    addToast(gameState.gameOverMsg, 'gameover');
    saveGameResult();
    setTimeout(() => showGameOverModal(gameState.gameOverMsg), 700);
  }
}

// ── Takeback ──────────────────────────────────────────────────
function applyTakeback() {
  if (stateHistory.length === 0) return;
  const snap = stateHistory.pop();
  gameState.board.set(snap.board);
  gameState.turn           = snap.turn;
  gameState.enPassant      = snap.enPassant;
  gameState.castling       = { ...snap.castling };
  gameState.halfmoveClock  = snap.halfmoveClock;
  gameState.fullmoveNumber = snap.fullmoveNumber;
  gameState.capturedByWhite = [...snap.capturedByWhite];
  gameState.capturedByBlack = [...snap.capturedByBlack];
  gameState.lastMove       = snap.lastMove;
  gameState.gameOver       = false;
  gameState.gameOverMsg    = '';
  moveHistory     = [...snap.moveHistorySnap];
  positionHistory = [...snap.posHistorySnap];
  clockWhite = snap.clockWhite;
  clockBlack = snap.clockBlack;

  selected = -1;
  legalMovesCache = [];
  updateBoard();
  updateStatus();
  renderMoveList();
  renderClocks();
}

// ── AI scheduling ─────────────────────────────────────────────
function scheduleAI(delay) {
  if (aiThinking) return;
  aiThinking = true;
  setTimeout(async () => {
    if (gameState.gameOver || (currentMode === MODE_PVC_LOCAL && gameState.turn !== BLACK)) {
      aiThinking = false; return;
    }
    try {
      const lv  = SF_LEVELS[currentLevel];
      const fen = stateToFEN(gameState);
      const uci = await sfBestMove(fen, lv.skill, lv.elo, lv.time);
      const mv  = uciToMove(uci, gameState);
      if (mv) executeMove(mv, false);
    } catch (err) { console.error('Stockfish error:', err); }
    aiThinking = false;
  }, delay);
}

async function startCvC() {
  cvcRunning = true;
  const step = async () => {
    if (!cvcRunning || gameState.gameOver || currentMode !== MODE_CVC_LOCAL) { cvcRunning = false; return; }
    try {
      const idx = gameState.turn === WHITE ? cvcLevelWhite : cvcLevelBlack;
      const lv  = SF_LEVELS[idx];
      const uci = await sfBestMove(stateToFEN(gameState), lv.skill, lv.elo, lv.time);
      if (!cvcRunning) return;
      const mv = uciToMove(uci, gameState);
      if (!mv) { cvcRunning = false; return; }
      executeMove(mv, false);
      if (cvcRunning && !gameState.gameOver) setTimeout(step, 400);
      else cvcRunning = false;
    } catch (err) { console.error('CvC error:', err); cvcRunning = false; }
  };
  setTimeout(step, 600);
}
function stopCvC() { cvcRunning = false; }

// ── Online play ───────────────────────────────────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createOnlineGame() {
  let myName = 'Player';
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: user } = await sb.from('users').select('display_name').eq('id', session.user.id).maybeSingle();
      if (user?.display_name) myName = user.display_name;
    }
  } catch {}

  const code      = generateRoomCode();
  onlineRoomCode  = code;
  onlineColor     = WHITE;
  opponentNameEl.textContent = 'Waiting for opponent…';
  statusOnlineEl.innerHTML   = `Room code: <strong style="color:#c4b5fd;letter-spacing:3px">${code}</strong>`;
  statusOnlineEl.style.display = 'block';
  await joinChannel(code, 'creator', myName);
}

async function joinChannel(code, role, myName) {
  if (onlineChannel) { await sb.removeChannel(onlineChannel); onlineChannel = null; }

  const channel = sb.channel(`chess:${code}`, { config: { broadcast: { self: false } } });

  channel
    .on('broadcast', { event: 'join' }, ({ payload }) => {
      onlineOpponentName = payload.name || 'Opponent';
      onlineReady = true;
      opponentNameEl.textContent = onlineOpponentName;
      statusOnlineEl.textContent = `You play ${onlineColor === WHITE ? 'White' : 'Black'} vs ${onlineOpponentName}`;
      gameState = createState();
      setupBoard(gameState);
      moveHistory = [];
      positionHistory = [];
      stateHistory = [];
      if (currentTC && currentTC.base > 0) { clockWhite = currentTC.base; clockBlack = currentTC.base; }
      updateBoard();
      updateStatus();
      renderMoveList();
      startClock();
    })
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!onlineReady || gameState.turn === onlineColor) return;
      const mv = {
        from: payload.from,
        to:   payload.to,
        promotion: payload.promotion || undefined,
      };
      const p = gameState.board[mv.from];
      if (p && absPiece(p) === PAWN && payload.to === gameState.enPassant) mv.enPassant = true;
      if (p && absPiece(p) === KING && Math.abs(col(mv.from) - col(mv.to)) === 2)
        mv.castle = col(mv.to) > col(mv.from) ? 'KS' : 'QS';
      executeMove(mv, false);
    })
    .on('broadcast', { event: 'draw_offer' }, () => {
      if (drawOfferSent) return; // avoid loop
      const t = addToast(`${onlineOpponentName} offers a draw`, 'warn',
        `<button class="toast-action-btn toast-accept" id="draw-accept">✓ Accept</button>
         <button class="toast-action-btn toast-decline" id="draw-decline">✗ Decline</button>`);
      t.querySelector('#draw-accept')?.addEventListener('click', () => {
        dismissToast(t);
        onlineChannel?.send({ type: 'broadcast', event: 'draw_accept', payload: {} });
        gameState.gameOver    = true;
        gameState.gameOverMsg = 'Draw by agreement.';
        stopClock(); updateStatus(); updateBoard();
        addToast('Draw agreed!', 'gameover');
        setTimeout(() => showGameOverModal('Draw by agreement', '🤝 Agreed'), 600);
        saveGameResult();
      });
      t.querySelector('#draw-decline')?.addEventListener('click', () => {
        dismissToast(t);
        onlineChannel?.send({ type: 'broadcast', event: 'draw_decline', payload: {} });
      });
    })
    .on('broadcast', { event: 'draw_accept' }, () => {
      drawOfferSent = false;
      gameState.gameOver    = true;
      gameState.gameOverMsg = 'Draw by agreement.';
      stopClock(); updateStatus(); updateBoard();
      addToast('Draw agreed!', 'gameover');
      setTimeout(() => showGameOverModal('Draw by agreement', '🤝 Agreed'), 600);
      saveGameResult();
    })
    .on('broadcast', { event: 'draw_decline' }, () => {
      drawOfferSent = false;
      addToast(`${onlineOpponentName} declined the draw offer`, 'warn');
    })
    .on('broadcast', { event: 'takeback_request' }, () => {
      if (stateHistory.length === 0) return;
      const t = addToast(`${onlineOpponentName} requests a takeback`, 'warn',
        `<button class="toast-action-btn toast-accept" id="tb-accept">✓ Accept</button>
         <button class="toast-action-btn toast-decline" id="tb-decline">✗ Decline</button>`);
      t.querySelector('#tb-accept')?.addEventListener('click', () => {
        dismissToast(t);
        onlineChannel?.send({ type: 'broadcast', event: 'takeback_accept', payload: {} });
        applyTakeback();
        addToast('Takeback applied', 'info');
      });
      t.querySelector('#tb-decline')?.addEventListener('click', () => {
        dismissToast(t);
        onlineChannel?.send({ type: 'broadcast', event: 'takeback_decline', payload: {} });
      });
    })
    .on('broadcast', { event: 'takeback_accept' }, () => {
      takebackSent = false;
      applyTakeback();
      addToast('Takeback accepted', 'info');
    })
    .on('broadcast', { event: 'takeback_decline' }, () => {
      takebackSent = false;
      addToast(`${onlineOpponentName} declined the takeback`, 'warn');
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'join', payload: { name: myName, role } });
        if (role === 'joiner') {
          onlineReady = true;
          statusOnlineEl.textContent = `Joined room ${code}`;
          startClock();
        }
      }
    });

  onlineChannel = channel;
}

function leaveOnlineRoom() {
  if (onlineChannel) { sb.removeChannel(onlineChannel).catch(() => {}); onlineChannel = null; }
  onlineReady = false; onlineColor = null; onlineRoomCode = null; onlineOpponentName = '';
  statusOnlineEl.style.display = 'none';
  statusOnlineEl.textContent   = '';
}

// ── Button handlers ───────────────────────────────────────────
btnResign.addEventListener('click', () => {
  if (gameState.gameOver) return;
  const loserName = currentMode === MODE_PVP_ONLINE
    ? (onlineColor === WHITE ? 'White' : 'Black')
    : (gameState.turn === WHITE ? 'White' : 'Black');
  gameState.gameOver    = true;
  gameState.gameOverMsg = `${loserName} resigned.`;
  stopClock();
  updateStatus();
  updateBoard();
  addToast(gameState.gameOverMsg, 'gameover');
  saveGameResult();
  setTimeout(() => showGameOverModal(gameState.gameOverMsg, '🏳 Resignation'), 600);
});

btnDraw.addEventListener('click', () => {
  if (gameState.gameOver) return;
  if (currentMode === MODE_PVP_ONLINE) {
    if (drawOfferSent) { addToast('Draw offer already sent', 'info'); return; }
    drawOfferSent = true;
    onlineChannel?.send({ type: 'broadcast', event: 'draw_offer', payload: {} });
    addToast('Draw offer sent — waiting for response…', 'info');
  } else {
    // Local: instant agreement
    gameState.gameOver    = true;
    gameState.gameOverMsg = 'Draw by agreement.';
    stopClock();
    updateStatus();
    updateBoard();
    addToast('Draw by agreement', 'gameover');
    saveGameResult();
    setTimeout(() => showGameOverModal('Draw by agreement', '🤝 Agreed'), 600);
  }
});

btnTakeback.addEventListener('click', () => {
  if (gameState.gameOver) return;
  if (currentMode === MODE_PVP_ONLINE) {
    if (takebackSent) { addToast('Takeback request already sent', 'info'); return; }
    if (stateHistory.length === 0) { addToast('No moves to take back', 'info'); return; }
    takebackSent = true;
    onlineChannel?.send({ type: 'broadcast', event: 'takeback_request', payload: {} });
    addToast('Takeback request sent…', 'info');
  } else if (currentMode === MODE_PVC_LOCAL) {
    // Take back 2 half-moves (undo AI's last move + player's last move)
    if (stateHistory.length >= 2) { applyTakeback(); applyTakeback(); addToast('Takeback applied', 'info'); }
    else if (stateHistory.length === 1) { applyTakeback(); addToast('Takeback applied', 'info'); }
    else addToast('No moves to take back', 'info');
  } else {
    // Local: take back 1 half-move
    if (stateHistory.length === 0) { addToast('No moves to take back', 'info'); return; }
    applyTakeback();
    addToast('Takeback applied', 'info');
  }
});

btnBack.addEventListener('click', () => {
  const inProgress = !gameState.gameOver && moveHistory.length > 0;
  if (inProgress && !confirm('Return to lobby? The current game will be abandoned.')) return;
  showLobby();
});

btnCvcOpen.addEventListener('click', openCvcModal);

// ── Save game to Supabase ────────────────────────────────────
async function saveGameResult() {
  // Only save meaningful human games
  if (currentMode === MODE_CVC_LOCAL) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    // Determine outcome from the player's perspective
    let result = 'draw';
    const msg = gameState.gameOverMsg.toLowerCase();
    if (msg.includes('white wins') || msg.includes('white') && msg.includes('mate')) {
      result = currentMode === MODE_PVP_ONLINE
        ? (onlineColor === WHITE ? 'win' : 'loss')
        : 'white_wins';
    } else if (msg.includes('black wins') || msg.includes('black') && msg.includes('mate')) {
      result = currentMode === MODE_PVP_ONLINE
        ? (onlineColor === BLACK ? 'win' : 'loss')
        : 'black_wins';
    } else if (msg.includes('resign')) {
      if (currentMode === MODE_PVP_ONLINE) result = onlineColor === WHITE
        ? (msg.includes('white') ? 'loss' : 'win')
        : (msg.includes('black') ? 'loss' : 'win');
    } else if (msg.includes('time')) {
      if (currentMode === MODE_PVP_ONLINE) result = 'loss'; // we ran out
    }

    const opponent = opponentNameEl.textContent || 'Unknown';

    await sb.from('chess_games').insert({
      user_id:      userId,
      mode:         currentMode,
      result,
      result_reason: gameState.gameOverMsg,
      my_color:     onlineColor === WHITE ? 'white' : (onlineColor === BLACK ? 'black' : 'white'),
      opponent,
      moves:        moveHistory,
      time_control: currentTC ? currentTC.label : 'Unlimited',
    });
  } catch (err) {
    console.warn('Failed to save game:', err);
  }
}

// ── Init ──────────────────────────────────────────────────────
buildLobby();
showLobby();
getStockfish().catch(() => {}); // preload
