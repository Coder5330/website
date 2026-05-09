// ============================================================
//  CHESS — complete engine, Stockfish AI, and online play
//  Board: flat array[64], index = row*8+col
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

// Unicode glyphs: index by piece value (1-6), white vs black
const GLYPHS = {
  [WHITE]: { [PAWN]:'♙', [KNIGHT]:'♘', [BISHOP]:'♗', [ROOK]:'♖', [QUEEN]:'♕', [KING]:'♔' },
  [BLACK]: { [PAWN]:'♟', [KNIGHT]:'♞', [BISHOP]:'♝', [ROOK]:'♜', [QUEEN]:'♛', [KING]:'♚' },
};


// ── Game State ───────────────────────────────────────────────

/**
 * Creates a fresh game state object.
 * @returns {object} state
 */
function createState() {
  return {
    board: new Int8Array(64),      // piece values
    turn: WHITE,                   // whose turn
    enPassant: -1,                 // target square (-1 = none)
    castling: {                    // castling rights
      whiteKingside:  true,
      whiteQueenside: true,
      blackKingside:  true,
      blackQueenside: true,
    },
    halfmoveClock: 0,              // for 50-move rule
    fullmoveNumber: 1,
    capturedByWhite: [],           // pieces white captured
    capturedByBlack: [],           // pieces black captured
    lastMove: null,                // {from, to} for highlight
    gameOver: false,
    gameOverMsg: '',
  };
}

/** Set up the starting position. */
function setupBoard(state) {
  const b = state.board;
  b.fill(0);

  // Black pieces (row 0 = rank 8)
  b[0]=-ROOK; b[1]=-KNIGHT; b[2]=-BISHOP; b[3]=-QUEEN;
  b[4]=-KING; b[5]=-BISHOP; b[6]=-KNIGHT; b[7]=-ROOK;
  for (let c=0;c<8;c++) b[8+c] = -PAWN;

  // White pieces (row 7 = rank 1)
  b[56]=ROOK; b[57]=KNIGHT; b[58]=BISHOP; b[59]=QUEEN;
  b[60]=KING; b[61]=BISHOP; b[62]=KNIGHT; b[63]=ROOK;
  for (let c=0;c<8;c++) b[48+c] = PAWN;
}

// ── Helpers ──────────────────────────────────────────────────

const row = sq => (sq / 8) | 0;
const col = sq => sq % 8;
const sq  = (r, c) => r * 8 + c;
const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const pieceColor = p => p > 0 ? WHITE : (p < 0 ? BLACK : 0);
const absPiece   = p => Math.abs(p);

/** Clone a state deeply enough for the AI (no captured lists needed). */
function cloneState(s) {
  const n = createState();
  n.board.set(s.board);
  n.turn = s.turn;
  n.enPassant = s.enPassant;
  n.castling = { ...s.castling };
  n.halfmoveClock = s.halfmoveClock;
  n.fullmoveNumber = s.fullmoveNumber;
  n.lastMove = s.lastMove;
  n.gameOver = s.gameOver;
  // skip capturedBy* — not needed by AI
  return n;
}

// ── Move Generation ──────────────────────────────────────────

/**
 * Generate all pseudo-legal moves for the given color.
 * Returns array of {from, to, promotion?} objects.
 * Does NOT filter moves that leave the king in check.
 */
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
      const dir = (color === WHITE) ? -1 : 1;  // white moves up (decreasing row)
      const startRow = (color === WHITE) ? 6 : 1;
      const promRow  = (color === WHITE) ? 0 : 7;

      // Forward 1
      const r1 = r + dir;
      if (inBounds(r1, c) && b[sq(r1,c)] === 0) {
        if (r1 === promRow) {
          for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT])
            moves.push({ from, to: sq(r1,c), promotion: promo });
        } else {
          moves.push({ from, to: sq(r1,c) });
          // Forward 2 from start
          const r2 = r + 2*dir;
          if (r === startRow && b[sq(r2,c)] === 0)
            moves.push({ from, to: sq(r2,c) });
        }
      }

      // Diagonal captures
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
        // En passant
        if (ep === toSq) {
          moves.push({ from, to: toSq, enPassant: true });
        }
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
          else {
            if (pieceColor(t) === -color) moves.push({ from, to: sq(nr,nc) });
            break;
          }
          nr+=dr; nc+=dc;
        }
      }
      if (kind === BISHOP) continue; // only diagonals
    }

    if (kind === ROOK || kind === QUEEN) {
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        let nr=r+dr, nc=c+dc;
        while (inBounds(nr,nc)) {
          const t = b[sq(nr,nc)];
          if (t === 0) { moves.push({ from, to: sq(nr,nc) }); }
          else {
            if (pieceColor(t) === -color) moves.push({ from, to: sq(nr,nc) });
            break;
          }
          nr+=dr; nc+=dc;
        }
      }
    }

    else if (kind === KING) {
      // Normal moves
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr=r+dr, nc=c+dc;
        if (!inBounds(nr,nc)) continue;
        const t = b[sq(nr,nc)];
        if (t === 0 || pieceColor(t) === -color)
          moves.push({ from, to: sq(nr,nc) });
      }

      // Castling
      if (color === WHITE && from === 60) {
        // Kingside: e1-f1-g1 must be clear, rook at h1
        if (state.castling.whiteKingside &&
            b[61]===0 && b[62]===0 && b[63]===ROOK)
          moves.push({ from, to: 62, castle: 'KS' });
        // Queenside: e1-d1-c1-b1 must be clear, rook at a1
        if (state.castling.whiteQueenside &&
            b[59]===0 && b[58]===0 && b[57]===0 && b[56]===ROOK)
          moves.push({ from, to: 58, castle: 'QS' });
      }
      if (color === BLACK && from === 4) {
        if (state.castling.blackKingside &&
            b[5]===0 && b[6]===0 && b[7]===-ROOK)
          moves.push({ from, to: 6, castle: 'KS' });
        if (state.castling.blackQueenside &&
            b[3]===0 && b[2]===0 && b[1]===0 && b[0]===-ROOK)
          moves.push({ from, to: 2, castle: 'QS' });
      }
    }
  }

  return moves;
}

/**
 * Is the given color's king in check in this state?
 */
function isInCheck(state, color) {
  const b = state.board;
  const kingPiece = color * KING;
  let kingPos = -1;
  for (let i = 0; i < 64; i++) {
    if (b[i] === kingPiece) { kingPos = i; break; }
  }
  if (kingPos < 0) return true; // shouldn't happen but be safe

  // Check if any enemy pseudo-move can capture the king
  const enemyMoves = pseudoMoves(state, -color);
  return enemyMoves.some(m => m.to === kingPos);
}

/**
 * Apply a move to a state (mutates). Returns the captured piece (or 0).
 */
function applyMove(state, move) {
  const b = state.board;
  const { from, to } = move;
  const piece = b[from];
  const color = pieceColor(piece);
  const kind  = absPiece(piece);
  let captured = b[to];

  // En passant capture
  if (move.enPassant) {
    const epPawnRow = (color === WHITE) ? row(to)+1 : row(to)-1;
    const epPawnSq  = sq(epPawnRow, col(to));
    captured = b[epPawnSq];
    b[epPawnSq] = 0;
  }

  // Move piece
  b[to] = piece;
  b[from] = 0;

  // Promotion
  if (move.promotion) {
    b[to] = color * move.promotion;
  }

  // Castling — move rook
  if (move.castle) {
    if (color === WHITE) {
      if (move.castle === 'KS') { b[63]=0; b[61]=ROOK; }
      else                       { b[56]=0; b[59]=ROOK; }
    } else {
      if (move.castle === 'KS') { b[7]=0; b[5]=-ROOK; }
      else                       { b[0]=0; b[3]=-ROOK; }
    }
  }

  // Update en passant target
  state.enPassant = -1;
  if (kind === PAWN && Math.abs(row(to) - row(from)) === 2) {
    // Double push — set en passant target square
    state.enPassant = sq((row(from)+row(to))/2, col(from));
  }

  // Update castling rights
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
  // If rook square was captured
  if (to===56) state.castling.whiteQueenside=false;
  if (to===63) state.castling.whiteKingside=false;
  if (to===0)  state.castling.blackQueenside=false;
  if (to===7)  state.castling.blackKingside=false;

  // Halfmove clock
  if (kind === PAWN || captured !== 0) state.halfmoveClock = 0;
  else state.halfmoveClock++;

  if (color === BLACK) state.fullmoveNumber++;

  state.turn = -color;
  state.lastMove = { from, to };

  return captured;
}

/**
 * Filter pseudo-legal moves to only include truly legal moves
 * (i.e., don't leave own king in check).
 * Also validates castling doesn't pass through check.
 */
function legalMoves(state, color) {
  const pseudo = pseudoMoves(state, color);
  const legal  = [];

  for (const move of pseudo) {
    // Castling extra validation: king must not pass through attacked square
    if (move.castle) {
      const passThrough = (color === WHITE)
        ? (move.castle === 'KS' ? 61 : 59)
        : (move.castle === 'KS' ? 5  : 3);
      const kingStart = (color === WHITE) ? 60 : 4;

      // King must not be in check currently
      if (isInCheck(state, color)) continue;

      // King must not pass through attacked square
      const tmp1 = cloneState(state);
      tmp1.board[passThrough] = tmp1.board[kingStart];
      tmp1.board[kingStart]   = 0;
      if (isInCheck(tmp1, color)) continue;
    }

    // Apply move, check if our king is in check
    const tmp = cloneState(state);
    applyMove(tmp, move);
    if (!isInCheck(tmp, color)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Check game-ending conditions for the side that just moved TO (so now it's
 * the OTHER side's turn, i.e., state.turn).
 */
function checkGameOver(state) {
  const moves = legalMoves(state, state.turn);
  if (moves.length === 0) {
    if (isInCheck(state, state.turn)) {
      const winner = state.turn === WHITE ? 'Black' : 'White';
      state.gameOver = true;
      state.gameOverMsg = `Checkmate! ${winner} wins!`;
    } else {
      state.gameOver = true;
      state.gameOverMsg = 'Draw — Stalemate!';
    }
  }
  // 50-move rule
  if (state.halfmoveClock >= 100) {
    state.gameOver = true;
    state.gameOverMsg = 'Draw — 50-move rule!';
  }
}

// ── AI: Stockfish ────────────────────────────────────────────

// Load Stockfish via blob URL to avoid CORS worker restrictions
let _sf = null;
let _sfReady = false;
let _sfResolve = null;

async function getStockfish() {
  if (_sf && _sfReady) return _sf;
  if (!_sf) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
    const blob = await res.blob();
    _sf = new Worker(URL.createObjectURL(blob));
    _sf.onmessage = _sfMsg;
    _sf.postMessage('uci');
  }
  // Wait for readyok
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

// ── FEN generator ────────────────────────────────────────────

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
    const r = Math.floor(state.enPassant / 8), c = state.enPassant % 8;
    fen += ' ' + String.fromCharCode(97+c) + (8-r);
  } else fen += ' -';
  fen += ' 0 1';
  return fen;
}

// ── UCI move → internal move conversion ──────────────────────

// Helper — map piece int to char for promotion matching
const PIECE_CHARS = {1:'P',2:'N',3:'B',4:'R',5:'Q',6:'K'};

function uciToMove(uci, state) {
  if (!uci || uci === '(none)') return null;
  const fromFile = uci.charCodeAt(0) - 97; // 'a'=0
  const fromRank = 8 - parseInt(uci[1]);    // rank 1 → row 7
  const toFile   = uci.charCodeAt(2) - 97;
  const toRank   = 8 - parseInt(uci[3]);
  const from = fromRank * 8 + fromFile;
  const to   = toRank   * 8 + toFile;
  const promo = uci[4]; // 'q','r','b','n' or undefined
  // Find matching legal move
  const color = state.turn;
  const moves = legalMoves(state, color);
  return moves.find(m => m.from === from && m.to === to &&
    (!promo || PIECE_CHARS[Math.abs(m.promotion || 0)]?.toLowerCase() === promo)
  ) || moves.find(m => m.from === from && m.to === to) || null;
}

// ── Difficulty levels ────────────────────────────────────────

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
let currentLevel = 3; // default level index (0-based), starts at Level 4

// ── Game Modes ───────────────────────────────────────────────
const MODE_PVP_LOCAL  = 'pvp-local';
const MODE_PVP_ONLINE = 'pvp-online';
const MODE_PVC_LOCAL  = 'pvc-local';
const MODE_CVC_LOCAL  = 'cvc-local';

// ── App State ────────────────────────────────────────────────
let gameState   = createState();
let currentMode = MODE_PVP_LOCAL;
let selected    = -1;          // currently selected square
let legalMovesCache = [];      // legal moves for selected piece
let cvcInterval = null;        // interval for CvC auto-play
let aiThinking  = false;       // lock while AI computes

// Online state
let onlineColor   = null;      // WHITE or BLACK for online mode
let onlineChannel = null;      // Supabase realtime channel
let onlineRoomCode= null;
let onlineOpponentName = '';
let onlineReady   = false;     // both players connected

// ── DOM refs ────────────────────────────────────────────────
const boardEl          = document.getElementById('chess-board');
const statusTurnEl     = document.getElementById('status-turn');
const statusMsgEl      = document.getElementById('status-msg');
const statusOnlineEl   = document.getElementById('status-online');
const onlineControlsEl = document.getElementById('online-controls');
const btnCreateGame    = document.getElementById('btn-create-game');
const btnJoinGame      = document.getElementById('btn-join-game');
const joinCodeInput    = document.getElementById('join-code-input');
const roomInfoEl       = document.getElementById('room-info');
const btnNewGame       = document.getElementById('btn-new-game');
const btnStopCvc       = document.getElementById('btn-stop-cvc');
const capturedWhiteEl  = document.getElementById('captured-white-pieces');
const capturedBlackEl  = document.getElementById('captured-black-pieces');

// ── Render ───────────────────────────────────────────────────

function renderBoard() {
  boardEl.innerHTML = '';
  const legalSet    = new Set(legalMovesCache.map(m => m.to));
  const captureSet  = new Set(
    legalMovesCache.filter(m => gameState.board[m.to] !== 0 || m.enPassant).map(m => m.to)
  );
  const lastFrom = gameState.lastMove ? gameState.lastMove.from : -1;
  const lastTo   = gameState.lastMove ? gameState.lastMove.to   : -1;

  for (let i = 0; i < 64; i++) {
    const r = row(i), c = col(i);
    const cell = document.createElement('div');
    cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

    // Highlights
    if (i === selected)           cell.classList.add('selected');
    if (i === lastFrom || i === lastTo) cell.classList.add('last-move');

    if (selected >= 0 && legalSet.has(i)) {
      if (captureSet.has(i)) cell.classList.add('legal-capture');
      else                    cell.classList.add('legal-move');
    }

    const p = gameState.board[i];
    if (p !== 0) {
      const span = document.createElement('span');
      span.className = 'piece';
      span.textContent = GLYPHS[pieceColor(p)][absPiece(p)];
      cell.appendChild(span);
      cell.classList.add('has-piece');
    }

    cell.dataset.sq = i;
    cell.addEventListener('click', onCellClick);
    boardEl.appendChild(cell);
  }

  // Captured pieces
  capturedWhiteEl.textContent = gameState.capturedByWhite.map(p => GLYPHS[WHITE][absPiece(p)]).join('');
  capturedBlackEl.textContent = gameState.capturedByBlack.map(p => GLYPHS[BLACK][absPiece(p)]).join('');
}

function updateStatus() {
  if (gameState.gameOver) {
    statusTurnEl.textContent = gameState.gameOverMsg;
    statusMsgEl.textContent  = '';
    return;
  }

  const turnName = gameState.turn === WHITE ? 'White' : 'Black';
  statusTurnEl.textContent = `${turnName}'s turn`;

  if (isInCheck(gameState, gameState.turn)) {
    statusMsgEl.textContent = `${turnName} is in check!`;
  } else {
    statusMsgEl.textContent = '';
  }
}

// ── Cell Click Handler ───────────────────────────────────────

function onCellClick(e) {
  const clickedSq = parseInt(e.currentTarget.dataset.sq);

  // Block interaction if game over
  if (gameState.gameOver) return;

  // Block if it's not a human's turn
  if (!isHumanTurn()) return;

  // Online mode: block if not your color's turn
  if (currentMode === MODE_PVP_ONLINE) {
    if (!onlineReady) return;
    if (gameState.turn !== onlineColor) return;
  }

  const pieceOnSquare = gameState.board[clickedSq];
  const ownColor      = gameState.turn;

  if (selected >= 0) {
    // Check if clicked square is a legal move destination
    const move = legalMovesCache.find(m => m.to === clickedSq);
    if (move) {
      executeMove(move);
      selected = -1;
      legalMovesCache = [];
      return;
    }
    // Clicked own piece: re-select
    if (pieceOnSquare !== 0 && pieceColor(pieceOnSquare) === ownColor) {
      selected = clickedSq;
      legalMovesCache = legalMoves(gameState, ownColor).filter(m => m.from === clickedSq);
      renderBoard();
      return;
    }
    // Deselect
    selected = -1;
    legalMovesCache = [];
    renderBoard();
    return;
  }

  // Nothing selected — try to select a piece
  if (pieceOnSquare !== 0 && pieceColor(pieceOnSquare) === ownColor) {
    selected = clickedSq;
    legalMovesCache = legalMoves(gameState, ownColor).filter(m => m.from === clickedSq);
    renderBoard();
  }
}

/** Is it currently a human player's turn? */
function isHumanTurn() {
  if (currentMode === MODE_CVC_LOCAL) return false;
  if (currentMode === MODE_PVC_LOCAL && gameState.turn === BLACK) return false;
  return true;
}

// ── Execute Move ─────────────────────────────────────────────

/**
 * Execute a move on the current game state and trigger post-move logic.
 * @param {object} move
 * @param {boolean} broadcast - send to online opponent
 */
function executeMove(move, broadcast = true) {
  // Track captures for display
  const capturedPiece = gameState.board[move.to];
  if (move.enPassant) {
    const epPawnRow = (gameState.turn === WHITE) ? row(move.to)+1 : row(move.to)-1;
    const epSq = sq(epPawnRow, col(move.to));
    const epPiece = gameState.board[epSq];
    if (gameState.turn === WHITE) gameState.capturedByWhite.push(epPiece);
    else                          gameState.capturedByBlack.push(epPiece);
  } else if (capturedPiece !== 0) {
    if (gameState.turn === WHITE) gameState.capturedByWhite.push(capturedPiece);
    else                          gameState.capturedByBlack.push(capturedPiece);
  }

  applyMove(gameState, move);
  checkGameOver(gameState);

  // Broadcast online
  if (broadcast && currentMode === MODE_PVP_ONLINE && onlineChannel) {
    onlineChannel.send({
      type: 'broadcast',
      event: 'move',
      payload: { from: move.from, to: move.to, promotion: move.promotion || null },
    });
  }

  selected = -1;
  legalMovesCache = [];
  renderBoard();
  updateStatus();

  // Trigger AI if needed
  if (!gameState.gameOver) {
    if (currentMode === MODE_PVC_LOCAL && gameState.turn === BLACK) {
      scheduleAI(300);
    }
  }
}

// ── AI scheduling ────────────────────────────────────────────

function scheduleAI(delay) {
  if (aiThinking) return;
  aiThinking = true;
  setTimeout(async () => {
    if (gameState.gameOver || (currentMode === MODE_PVC_LOCAL && gameState.turn !== BLACK)) {
      aiThinking = false; return;
    }
    try {
      const lv = SF_LEVELS[currentLevel];
      const fen = stateToFEN(gameState);
      const uci = await sfBestMove(fen, lv.skill, lv.elo, lv.time);
      const move = uciToMove(uci, gameState);
      if (move) executeMove(move, false);
    } catch (err) {
      console.error('Stockfish error:', err);
    }
    aiThinking = false;
  }, delay);
}

async function startCvC() {
  stopCvC();
  btnStopCvc.style.display = 'block';
  let running = true;
  cvcInterval = { stop: () => { running = false; } };

  const step = async () => {
    if (!running || gameState.gameOver || currentMode !== MODE_CVC_LOCAL) {
      stopCvC(); return;
    }
    try {
      const lv = SF_LEVELS[currentLevel];
      const fen = stateToFEN(gameState);
      const uci = await sfBestMove(fen, lv.skill, lv.elo, lv.time);
      if (!running) return;
      const move = uciToMove(uci, gameState);
      if (!move) { stopCvC(); return; }
      executeMove(move, false);
      if (running && !gameState.gameOver) setTimeout(step, 400);
      else stopCvC();
    } catch (err) {
      console.error('Stockfish CvC error:', err);
      stopCvC();
    }
  };
  setTimeout(step, 600);
}

function stopCvC() {
  if (cvcInterval) { cvcInterval.stop?.(); cvcInterval = null; }
  btnStopCvc.style.display = 'none';
}

// ── New Game ─────────────────────────────────────────────────

function newGame() {
  stopCvC();
  aiThinking = false;
  selected = -1;
  legalMovesCache = [];

  gameState = createState();
  setupBoard(gameState);

  renderBoard();
  updateStatus();

  if (currentMode === MODE_CVC_LOCAL) {
    setTimeout(startCvC, 800);
  }
}

// ── Level selector UI ────────────────────────────────────────

const levelSelectorEl = document.getElementById('level-selector');
const levelButtonsEl  = document.getElementById('level-buttons');

function renderLevelUI() {
  const computerMode = (currentMode === MODE_PVC_LOCAL || currentMode === MODE_CVC_LOCAL);
  levelSelectorEl.style.display = computerMode ? 'block' : 'none';

  if (!computerMode) return;

  levelButtonsEl.innerHTML = '';
  SF_LEVELS.forEach((lv, idx) => {
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (idx === currentLevel ? ' active' : '');
    btn.textContent = lv.label;
    btn.addEventListener('click', () => {
      currentLevel = idx;
      renderLevelUI();
    });
    levelButtonsEl.appendChild(btn);
  });
}

// ── Mode switching ───────────────────────────────────────────

function setMode(mode) {
  stopCvC();
  leaveOnlineRoom();

  currentMode = mode;

  // Update active button
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // Show/hide online controls
  onlineControlsEl.style.display = (mode === MODE_PVP_ONLINE) ? 'flex' : 'none';
  statusOnlineEl.style.display   = (mode === MODE_PVP_ONLINE) ? 'block' : 'none';

  // Reset online state
  onlineColor       = null;
  onlineRoomCode    = null;
  onlineReady       = false;
  onlineOpponentName= '';
  roomInfoEl.textContent = '';
  joinCodeInput.value    = '';
  statusOnlineEl.textContent = '';

  renderLevelUI();
  newGame();
}

// ── Online Play ───────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createOnlineGame() {
  const code = generateRoomCode();
  onlineRoomCode = code;
  onlineColor    = WHITE;

  roomInfoEl.innerHTML = `Your room code:<span class="room-code">${code}</span>
    <span class="spinner"></span> Waiting for opponent…`;
  statusOnlineEl.textContent = 'You play White';

  await joinChannel(code, 'creator');
}

async function joinOnlineGame() {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    roomInfoEl.textContent = 'Enter a valid 6-character code.';
    return;
  }
  onlineRoomCode = code;
  onlineColor    = BLACK;
  statusOnlineEl.textContent = 'You play Black';
  roomInfoEl.innerHTML = `Joining room ${code}… <span class="spinner"></span>`;
  await joinChannel(code, 'joiner');
}

async function joinChannel(code, role) {
  if (onlineChannel) {
    await sb.removeChannel(onlineChannel);
    onlineChannel = null;
  }

  // Try to get the user's display name
  let myName = 'Player';
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: user } = await sb.from('users').select('display_name').eq('id', session.user.id).maybeSingle();
      if (user && user.display_name) myName = user.display_name;
    }
  } catch {}

  const channel = sb.channel(`chess:${code}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'join' }, ({ payload }) => {
      onlineOpponentName = payload.name || 'Opponent';
      onlineReady = true;
      roomInfoEl.textContent = `Playing vs ${onlineOpponentName}`;
      statusOnlineEl.textContent = `You play ${onlineColor === WHITE ? 'White' : 'Black'} vs ${onlineOpponentName}`;
      // Both joined: fresh board
      newGame();
    })
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      if (!onlineReady) return;
      // It's the opponent's move — apply it
      if (gameState.turn === onlineColor) return; // shouldn't happen, but guard
      const move = {
        from: payload.from,
        to:   payload.to,
        promotion: payload.promotion || undefined,
      };
      // Reconstruct flags
      const p = gameState.board[move.from];
      if (p && absPiece(p) === PAWN && payload.to === gameState.enPassant) {
        move.enPassant = true;
      }
      // Detect castling
      if (p && absPiece(p) === KING && Math.abs(col(move.from) - col(move.to)) === 2) {
        move.castle = col(move.to) > col(move.from) ? 'KS' : 'QS';
      }
      executeMove(move, false);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence
        channel.send({
          type: 'broadcast',
          event: 'join',
          payload: { name: myName, role },
        });
        if (role === 'joiner') {
          onlineReady = true;
          roomInfoEl.textContent = `Joined room ${code}`;
        }
      }
    });

  onlineChannel = channel;
}

function leaveOnlineRoom() {
  if (onlineChannel) {
    sb.removeChannel(onlineChannel).catch(() => {});
    onlineChannel = null;
  }
  onlineReady = false;
}

// ── Event Wiring ─────────────────────────────────────────────

btnNewGame.addEventListener('click', () => newGame());

btnStopCvc.addEventListener('click', () => {
  stopCvC();
  gameState.gameOver = true;
  gameState.gameOverMsg = 'Stopped.';
  updateStatus();
  renderBoard();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

btnCreateGame.addEventListener('click', createOnlineGame);
btnJoinGame.addEventListener('click', joinOnlineGame);
joinCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinOnlineGame();
});

// ── Initialise ───────────────────────────────────────────────

setupBoard(gameState);
renderBoard();
updateStatus();
renderLevelUI();

// Preload Stockfish in the background so first AI move isn't slow
getStockfish().catch(() => {});
