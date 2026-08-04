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

const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;
const START_LEVEL_KEY = 'tetris.startLevel';

// Teclas que controlan la partida: nunca deben llegar al navegador ni al juego
// mientras el menú de pausa está abierto.
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space',
]);

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
const startLevelSelect = document.getElementById('start-level-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// Nivel inicial elegido por el jugador. Se aplica en el próximo init().
let startLevel = loadStartLevel();
// Nivel inicial con el que arrancó la partida en curso (congelado en init()).
let runStartLevel = startLevel;

// Teclas físicamente pulsadas y teclas que deben soltarse antes de volver a
// contar (evita que una tecla mantenida durante la pausa mueva la pieza al
// reanudar).
const heldKeys = new Set();
const blockedKeys = new Set();

function clampStartLevel(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return MIN_START_LEVEL;
  return Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, n));
}

function loadStartLevel() {
  try {
    const raw = localStorage.getItem(START_LEVEL_KEY);
    if (raw === null) return MIN_START_LEVEL;
    return clampStartLevel(raw);
  } catch (err) {
    return MIN_START_LEVEL;
  }
}

function saveStartLevel(value) {
  try {
    localStorage.setItem(START_LEVEL_KEY, String(value));
  } catch (err) {
    /* localStorage no disponible (modo privado / file://): se ignora */
  }
}

function setStartLevel(value) {
  startLevel = clampStartLevel(value);
  saveStartLevel(startLevel);
  if (startLevelSelect) startLevelSelect.value = String(startLevel);
  return startLevel;
}

function levelDropInterval(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

// El menú de pausa (Unidad 1) puede exponer su propio flag; si no existe,
// basta con el estado de pausa del juego.
function isMenuOpen() {
  if (typeof pauseMenuOpen !== 'undefined' && pauseMenuOpen) return true;
  return paused === true;
}

// Cualquier tecla de juego pulsada ahora mismo queda neutralizada hasta que se
// suelte. Se llama al reanudar y al iniciar una partida.
function blockHeldKeys() {
  heldKeys.forEach(code => blockedKeys.add(code));
}

// Devuelve el foco al documento: si queda en un botón o en el selector, sus
// teclas dejarían de llegar al juego.
function releaseFocus() {
  const el = document.activeElement;
  if (isFormControl(el) && typeof el.blur === 'function') el.blur();
}

function isFormControl(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' ||
    tag === 'BUTTON' || tag === 'OPTION' || el.isContentEditable === true;
}

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
    level = runStartLevel + Math.floor(lines / 10);
    dropInterval = levelDropInterval(level);
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    // Neutraliza cualquier tecla que siguiera pulsada durante la pausa.
    blockHeldKeys();
    releaseFocus();
    overlay.classList.add('hidden');
    lastTime = performance.now();
    dropAccum = 0;
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
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
  runStartLevel = clampStartLevel(startLevel);
  level = runStartLevel;
  paused = false;
  gameOver = false;
  dropInterval = levelDropInterval(level);
  dropAccum = 0;
  blockHeldKeys();
  releaseFocus();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Los controles de formulario (selector de nivel, botones del menú) manejan
  // sus propias teclas.
  if (isFormControl(e.target)) return;

  const isGameKey = GAME_KEYS.has(e.code);
  if (isGameKey) {
    // Siempre: evita el scroll de la página con Space/flechas, tanto en juego
    // como con el menú abierto.
    e.preventDefault();
    heldKeys.add(e.code);
  }

  if (e.code === 'KeyP') {
    heldKeys.add(e.code);
    togglePause();
    return;
  }

  // Menú abierto: ningún input llega al juego. Las flechas sólo navegan el
  // menú (manejado por su propio listener).
  if (isMenuOpen() || gameOver) return;

  // Tecla pulsada desde antes de reanudar: hay que soltarla primero.
  if (blockedKeys.has(e.code)) return;

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
      hardDrop();
      break;
  }
  updateHUD();
});

document.addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  blockedKeys.delete(e.code);
});

// Si la ventana pierde el foco no llegan los keyup: se olvida todo lo pulsado.
window.addEventListener('blur', () => {
  heldKeys.clear();
  blockedKeys.clear();
});

/* ---- Selector de nivel inicial (bloque autónomo) ---- */
if (startLevelSelect) {
  for (let lv = MIN_START_LEVEL; lv <= MAX_START_LEVEL; lv++) {
    const opt = document.createElement('option');
    opt.value = String(lv);
    opt.textContent = String(lv);
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = String(startLevel);
  startLevelSelect.addEventListener('change', () => {
    setStartLevel(startLevelSelect.value);
  });
}

restartBtn.addEventListener('click', init);

init();
