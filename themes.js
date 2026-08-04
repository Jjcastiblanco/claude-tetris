'use strict';

/* ------------------------------------------------------------------
 * Motor de temas / skins.
 * Expone: THEMES, getTheme(), setTheme(id), themeColors(),
 *         drawThemedBlock(ctx, x, y, idx, size, alpha)
 * Persistencia: localStorage['tetris.theme']
 * ------------------------------------------------------------------ */

const THEME_STORAGE_KEY = 'tetris.theme';
const DEFAULT_THEME_ID = 'retro';

/* ---- utilidades de dibujo ---- */

// ctx.roundRect no está disponible en todos los navegadores.
function pathRoundedRect(context, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, radius);
    return;
  }
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.arcTo(x + w, y, x + w, y + radius, radius);
  context.lineTo(x + w, y + h - radius);
  context.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  context.lineTo(x + radius, y + h);
  context.arcTo(x, y + h, x, y + h - radius, radius);
  context.lineTo(x, y + radius);
  context.arcTo(x, y, x + radius, y, radius);
  context.closePath();
}

/* ---- funciones de dibujo por tema ---- */

// Retro: idéntico al render original (fillRect con 1px de margen + brillo superior).
function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

// Neón: resplandor con shadowBlur + núcleo claro.
function drawNeonBlock(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = Math.max(6, size * 0.45);
  context.fillStyle = color;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.fillStyle = 'rgba(10,10,16,0.55)';
  context.fillRect(px + 5, py + 5, size - 10, size - 10);
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 1;
  context.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
}

// Pastel: esquinas redondeadas y tonos suaves.
function drawPastelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  pathRoundedRect(context, px + 2, py + 2, size - 4, size - 4, size * 0.28);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.28)';
  pathRoundedRect(context, px + 5, py + 5, size - 10, (size - 10) / 2.4, size * 0.18);
  context.fill();
}

// Pixel art: bloque plano con textura de dither + bisel de 2px.
function drawPixelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px, py, size, size);

  // textura: puntos alternos oscuros
  const step = Math.max(3, Math.round(size / 7.5));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let oy = 0; oy < size; oy += step) {
    for (let ox = (oy / step) % 2 === 0 ? 0 : step; ox < size; ox += step * 2) {
      context.fillRect(px + ox, py + oy, step - 1, step - 1);
    }
  }

  // bisel
  const b = Math.max(2, Math.round(size / 12));
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(px, py, size, b);
  context.fillRect(px, py, b, size);
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.fillRect(px, py + size - b, size, b);
  context.fillRect(px + size - b, py, b, size);
}

/* ---- definición de temas ---- */

const THEMES = [
  {
    id: 'retro',
    name: 'Retro',
    background: '#1a1a25',
    grid: '#22222e',
    colors: [
      null,
      '#4dd0e1', // I
      '#ffd54f', // O
      '#ba68c8', // T
      '#81c784', // S
      '#e57373', // Z
      '#7986cb', // J
      '#ffb74d', // L
    ],
    draw: drawRetroBlock,
  },
  {
    id: 'neon',
    name: 'Neón',
    background: '#000000',
    grid: '#141428',
    colors: [
      null,
      '#00fff7', // I
      '#fff600', // O
      '#ff00e6', // T
      '#00ff5e', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
    ],
    draw: drawNeonBlock,
  },
  {
    id: 'pastel',
    name: 'Pastel',
    background: '#232332',
    grid: '#2e2e40',
    colors: [
      null,
      '#a8e6e2', // I
      '#ffe6a7', // O
      '#d9c2f0', // T
      '#bfe3c0', // S
      '#f5b8b8', // Z
      '#b8c6ec', // J
      '#f8cfa6', // L
    ],
    draw: drawPastelBlock,
  },
  {
    id: 'pixel',
    name: 'Pixel Art',
    background: '#12121c',
    grid: '#2b2b3d',
    colors: [
      null,
      '#31a2ac', // I
      '#e0b400', // O
      '#9b4dca', // T
      '#4caf50', // S
      '#d32f2f', // Z
      '#3f51b5', // J
      '#f57c00', // L
    ],
    draw: drawPixelBlock,
  },
];

/* ---- estado + persistencia ---- */

let activeThemeId = DEFAULT_THEME_ID;

function findTheme(id) {
  for (const theme of THEMES) {
    if (theme.id === id) return theme;
  }
  return null;
}

function readStoredThemeId() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function getTheme() {
  return findTheme(activeThemeId) || findTheme(DEFAULT_THEME_ID);
}

function setTheme(id) {
  const theme = findTheme(id);
  if (!theme) return getTheme();
  activeThemeId = theme.id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch (e) {
    // almacenamiento no disponible: el tema sigue activo en memoria
  }
  return theme;
}

function themeColors() {
  return getTheme().colors;
}

/* ---- API de dibujo ---- */

function drawThemedBlock(context, x, y, idx, size, alpha) {
  if (!idx) return;
  const theme = getTheme();
  const color = theme.colors[idx];
  if (!color) return;
  const px = x * size;
  const py = y * size;

  context.save();
  context.globalAlpha = alpha ?? 1;
  theme.draw(context, px, py, size, color);
  context.restore();
  // restore() ya devuelve el contexto a su estado previo, pero reseteamos de
  // forma explícita todo lo que tocan los temas para que ninguno filtre estado
  // al siguiente (por ejemplo al cambiar de tema en caliente).
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.lineWidth = 1;
  context.strokeStyle = '#000000';
}

// Inicialización: aplica el tema guardado (tolerante a valores inválidos).
(function initTheme() {
  const stored = readStoredThemeId();
  if (stored && findTheme(stored)) activeThemeId = stored;
})();
