'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const recordForm = document.getElementById('record-form');
const playerNameInput = document.getElementById('player-name');
const overlayRecords = document.getElementById('overlay-records');
const overlayStats = document.getElementById('overlay-stats');
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const startStats = document.getElementById('start-stats');
const playBtn = document.getElementById('play-btn');
const resetRecordsBlock = document.getElementById('reset-records-block');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const resetConfirm = document.getElementById('reset-confirm');
const resetYesBtn = document.getElementById('reset-yes-btn');
const resetNoBtn = document.getElementById('reset-no-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gameStarted = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

/* ---- Records (UI) ---- */

const DEFAULT_PLAYER_NAME = 'ANÓNIMO';

let pendingRank = -1;

// El combo lo mantiene el juego (unidad de combos); se lee de forma defensiva.
function currentMaxCombo() {
  return typeof maxCombo === 'number' && isFinite(maxCombo) ? maxCombo : 0;
}

// Normaliza lo que devuelva la capa de almacenamiento: array de entradas o
// un objeto { entries, bestCombo, maxLines }.
function readRecords() {
  let data = null;
  if (typeof loadRecords === 'function') {
    try {
      data = loadRecords();
    } catch (e) {
      data = null;
    }
  }
  let entries = [];
  if (Array.isArray(data)) entries = data;
  else if (data && Array.isArray(data.entries)) entries = data.entries;

  entries = entries
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      name: String(entry.name || DEFAULT_PLAYER_NAME),
      score: Number(entry.score) || 0,
      lines: Number(entry.lines) || 0,
      level: Number(entry.level) || 1,
      combo: Number(entry.combo) || 0,
    }));

  const maxOf = key => entries.reduce((acc, entry) => Math.max(acc, entry[key]), 0);
  const raw = Array.isArray(data) ? {} : (data || {});
  const bestCombo = Number(raw.bestCombo);
  const maxLines = Number(raw.maxLines != null ? raw.maxLines : raw.bestLines);

  return {
    entries,
    bestCombo: isFinite(bestCombo) && bestCombo > 0 ? bestCombo : maxOf('combo'),
    maxLines: isFinite(maxLines) && maxLines > 0 ? maxLines : maxOf('lines'),
  };
}

function rankOf(value) {
  if (typeof recordRank !== 'function') return -1;
  try {
    const rank = recordRank(value);
    return typeof rank === 'number' && rank >= 0 ? rank : -1;
  } catch (e) {
    return -1;
  }
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function headerCell(text, className) {
  const th = document.createElement('th');
  th.textContent = text;
  if (className) th.className = className;
  return th;
}

function renderRecordsTable(container, entries, highlight) {
  container.textContent = '';

  const title = document.createElement('p');
  title.className = 'records-title';
  title.textContent = 'MEJORES PUNTUACIONES';
  container.appendChild(title);

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Todavía no hay records. ¡Sé el primero!';
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(headerCell('#', 'col-rank'));
  headRow.appendChild(headerCell('NOMBRE', 'col-name'));
  headRow.appendChild(headerCell('PUNTOS', 'col-score'));
  headRow.appendChild(headerCell('LÍNEAS', 'col-lines'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlight) tr.className = 'highlight';
    tr.appendChild(cell(String(i + 1), 'col-rank'));
    tr.appendChild(cell(entry.name, 'col-name'));
    tr.appendChild(cell(entry.score.toLocaleString(), 'col-score'));
    tr.appendChild(cell(String(entry.lines), 'col-lines'));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderRecordsUI(tableEl, statsEl, highlight) {
  const data = readRecords();
  renderRecordsTable(tableEl, data.entries, typeof highlight === 'number' ? highlight : -1);
  statsEl.textContent = `Mejor combo: ${data.bestCombo} · Líneas máximas: ${data.maxLines}`;
}

function setRecordsVisible(visible) {
  overlayRecords.classList.toggle('hidden', !visible);
  overlayStats.classList.toggle('hidden', !visible);
  if (!visible) recordForm.classList.add('hidden');
}

function submitRecord(e) {
  e.preventDefault();
  if (pendingRank < 0) return;
  const name = playerNameInput.value.trim().slice(0, 12) || DEFAULT_PLAYER_NAME;
  let saved = pendingRank;
  if (typeof saveRecord === 'function') {
    try {
      const result = saveRecord({
        name,
        score,
        lines,
        level,
        combo: currentMaxCombo(),
        date: new Date().toISOString(),
      });
      if (typeof result === 'number' && result >= 0) saved = result;
    } catch (err) {
      saved = -1;
    }
  }
  pendingRank = -1;
  recordForm.classList.add('hidden');
  renderRecordsUI(overlayRecords, overlayStats, saved);
}

function showStartScreen() {
  gameStarted = false;
  hideResetConfirm();
  renderRecordsUI(startRecords, startStats, -1);
  startScreen.classList.remove('hidden');
}

function hideResetConfirm() {
  resetConfirm.classList.add('hidden');
  resetRecordsBlock.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  pendingRank = rankOf(score);
  setRecordsVisible(true);
  if (pendingRank >= 0) {
    playerNameInput.value = '';
    recordForm.classList.remove('hidden');
  } else {
    recordForm.classList.add('hidden');
  }
  renderRecordsUI(overlayRecords, overlayStats, -1);

  overlay.classList.remove('hidden');
  if (pendingRank >= 0) playerNameInput.focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    setRecordsVisible(false);
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  pendingRank = -1;
  recordForm.classList.add('hidden');
  setRecordsVisible(false);
  overlay.classList.add('hidden');
  startScreen.classList.add('hidden');
  gameStarted = true;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);
recordForm.addEventListener('submit', submitRecord);

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBlock.classList.add('hidden');
  resetConfirm.classList.remove('hidden');
});

resetNoBtn.addEventListener('click', hideResetConfirm);

resetYesBtn.addEventListener('click', () => {
  if (typeof resetRecords === 'function') {
    try {
      resetRecords();
    } catch (e) {
      /* almacenamiento no disponible */
    }
  }
  hideResetConfirm();
  renderRecordsUI(startRecords, startStats, -1);
});

showStartScreen();
