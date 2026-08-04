'use strict';

// PLACEHOLDER — implementación mínima de la capa de records (Unidad 4).
// Expone la API acordada: loadRecords / saveRecord / resetRecords / recordRank.

const RECORDS_KEY = 'tetris.records';
const MAX_RECORDS = 5;

function readRecordsRaw() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadRecords() {
  return readRecordsRaw()
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      name: String(entry.name || 'ANÓNIMO'),
      score: Number(entry.score) || 0,
      lines: Number(entry.lines) || 0,
      level: Number(entry.level) || 1,
      combo: Number(entry.combo) || 0,
      date: entry.date || '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function recordRank(score) {
  const value = Number(score) || 0;
  if (value <= 0) return -1;
  const records = loadRecords();
  for (let i = 0; i < records.length; i++) {
    if (value > records[i].score) return i;
  }
  return records.length < MAX_RECORDS ? records.length : -1;
}

function saveRecord(entry) {
  const rank = recordRank(entry && entry.score);
  if (rank < 0) return -1;
  const records = loadRecords();
  records.splice(rank, 0, {
    name: String((entry && entry.name) || 'ANÓNIMO'),
    score: Number(entry && entry.score) || 0,
    lines: Number(entry && entry.lines) || 0,
    level: Number(entry && entry.level) || 1,
    combo: Number(entry && entry.combo) || 0,
    date: (entry && entry.date) || new Date().toISOString(),
  });
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch (e) {
    return -1; // no se pudo persistir: no reportar un puesto que no existe
  }
  return rank;
}

function resetRecords() {
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch (e) {
    /* almacenamiento no disponible */
  }
}
