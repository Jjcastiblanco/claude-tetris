'use strict';

// Capa de persistencia de records (tabla local de puntuaciones).
// Solo datos: no toca el DOM ni la lógica del juego.
//
// API pública (global, disponible para game.js y la UI):
//   loadRecords()      -> array top 5 ordenado por score descendente
//   saveRecord(entry)  -> inserta y persiste; devuelve la lista guardada
//   resetRecords()     -> borra la tabla
//   recordRank(score)  -> índice 0-4 que ocuparía, o -1 si no clasifica
//   bestCombo()        -> mejor combo histórico
//   maxLines()         -> máximo de líneas en una partida
//   recordStats()      -> agregados en una sola llamada
//
// Los ayudantes internos viven dentro de un IIFE para no colisionar con las
// declaraciones de nivel superior de los demás scripts clásicos.
(function () {
  const RECORDS_KEY = 'tetris.records';
  const MAX_RECORDS = 5;
  const MAX_NAME_LENGTH = 12;
  const DEFAULT_NAME = 'ANÓNIMO';

  // Copia en memoria usada cuando localStorage no está disponible
  // (modo privado, restricciones de file:// en algunos navegadores).
  let memoryRecords = [];
  let storageAvailable = true;

  function readRaw() {
    if (!storageAvailable) return null;
    try {
      return window.localStorage.getItem(RECORDS_KEY);
    } catch (err) {
      storageAvailable = false;
      return null;
    }
  }

  function writeRaw(value) {
    if (!storageAvailable) return false;
    try {
      window.localStorage.setItem(RECORDS_KEY, value);
      return true;
    } catch (err) {
      storageAvailable = false;
      return false;
    }
  }

  function removeRaw() {
    if (!storageAvailable) return false;
    try {
      window.localStorage.removeItem(RECORDS_KEY);
      return true;
    } catch (err) {
      storageAvailable = false;
      return false;
    }
  }

  function toInt(value, min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.floor(n));
  }

  function sanitizeName(name) {
    const text = typeof name === 'string' ? name : (name == null ? '' : String(name));
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
    return clean || DEFAULT_NAME;
  }

  function sanitizeDate(date) {
    if (typeof date === 'string' && date) return date;
    if (typeof date === 'number' && Number.isFinite(date)) {
      return new Date(date).toISOString();
    }
    return new Date().toISOString();
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
      name: sanitizeName(entry.name),
      score: toInt(entry.score, 0),
      lines: toInt(entry.lines, 0),
      level: toInt(entry.level, 1),
      combo: toInt(entry.combo, 0),
      date: sanitizeDate(entry.date),
    };
  }

  // Puntuación descendente; a igualdad, primero el que tenga más líneas
  // y luego el registro más antiguo (mantiene estable la tabla).
  function sortRecords(list) {
    return list.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lines !== a.lines) return b.lines - a.lines;
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function persist(list) {
    memoryRecords = list;
    writeRaw(JSON.stringify(list));
    return list;
  }

  function readList() {
    const raw = readRaw();
    if (raw === null) return memoryRecords.slice();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parsed = null;
    }
    // JSON corrupto o con una forma inesperada: no se descarta lo que ya
    // tenemos en memoria, se usa como respaldo.
    if (!Array.isArray(parsed)) return memoryRecords.slice();
    const list = sortRecords(parsed.map(normalizeEntry).filter(Boolean)).slice(0, MAX_RECORDS);
    memoryRecords = list;
    return list.slice();
  }

  function maxOf(list, key) {
    return list.reduce((max, r) => (r[key] > max ? r[key] : max), 0);
  }

  window.loadRecords = function loadRecords() {
    return readList();
  };

  window.saveRecord = function saveRecord(entry) {
    const normalized = normalizeEntry(entry);
    if (!normalized) return readList();
    const list = sortRecords(readList().concat([normalized])).slice(0, MAX_RECORDS);
    return persist(list).slice();
  };

  window.resetRecords = function resetRecords() {
    removeRaw();
    memoryRecords = [];
    return [];
  };

  window.recordRank = function recordRank(score) {
    const value = toInt(score, 0);
    const list = readList();
    for (let i = 0; i < list.length; i++) {
      if (value > list[i].score) return i;
    }
    return list.length < MAX_RECORDS ? list.length : -1;
  };

  window.bestCombo = function bestCombo() {
    return maxOf(readList(), 'combo');
  };

  window.maxLines = function maxLines() {
    return maxOf(readList(), 'lines');
  };

  window.recordStats = function recordStats() {
    const list = readList();
    return {
      bestScore: list.length ? list[0].score : 0,
      bestCombo: maxOf(list, 'combo'),
      maxLines: maxOf(list, 'lines'),
      total: list.length,
    };
  };
})();
