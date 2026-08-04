'use strict';

/*
 * PLACEHOLDER — Unidad 6 entrega la implementación real de este archivo.
 * Sólo se define aquí el contrato mínimo (THEMES / getTheme / setTheme /
 * themeColors / drawThemedBlock) para que la unidad 7 (selector de skin)
 * funcione de forma autónoma en su rama.
 */

const THEME_STORAGE_KEY = 'tetris.theme';

const THEMES = [
  { id: 'retro',  name: 'Retro'     },
  { id: 'neon',   name: 'Neón'      },
  { id: 'pastel', name: 'Pastel'    },
  { id: 'pixel',  name: 'Pixel art' },
];

const DEFAULT_THEME = 'retro';

const THEME_PALETTES = {
  retro:  { grid: '#22222e', blocks: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'] },
  neon:   { grid: '#1b1b3a', blocks: ['#00e5ff', '#ffe957', '#e040fb', '#00e676', '#ff1744', '#536dfe', '#ff9100'] },
  pastel: { grid: '#e6e0ef', blocks: ['#a8dadc', '#ffe5a8', '#d8b4e2', '#bfe3c0', '#f4b8b8', '#b9c0e8', '#f7d0a8'] },
  pixel:  { grid: '#2b2b1f', blocks: ['#3ec9d6', '#e8c547', '#a55fc4', '#6bbf59', '#d64550', '#5566c4', '#e0873a'] },
};

let currentThemeId = DEFAULT_THEME;

try {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && THEMES.some(t => t.id === stored)) currentThemeId = stored;
} catch (err) {
  /* localStorage no disponible (file:// restringido) */
}

function getTheme() {
  return THEMES.find(t => t.id === currentThemeId) || THEMES[0];
}

function setTheme(id) {
  if (!THEMES.some(t => t.id === id)) return getTheme();
  currentThemeId = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch (err) {
    /* ignorado */
  }
  document.documentElement.setAttribute('data-theme', id);
  return getTheme();
}

function themeColors() {
  const palette = THEME_PALETTES[currentThemeId] || THEME_PALETTES[DEFAULT_THEME];
  return { grid: palette.grid, blocks: [null, ...palette.blocks] };
}

function drawThemedBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = themeColors().blocks[colorIndex];
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.restore();
  context.globalAlpha = 1;
}
