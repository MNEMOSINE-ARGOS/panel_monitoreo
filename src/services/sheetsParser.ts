/**
 * Google Sheets CSV & GVIZ Parser
 * Handles CSV parsing, quotes, delimiters, and column normalization
 */

import { Calificacion, MediaRecord, UserRecord } from '../types';

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function mapRowsToMediaRecords(rows: string[][]): MediaRecord[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const findIndex = (aliases: string[]) => {
    return headers.findIndex(h => aliases.some(a => h.includes(a)));
  };

  const fechaIdx = findIndex(['fecha', 'date', 'dia']);
  const medioIdx = findIndex(['medio', 'periodico', 'outlet', 'portal', 'diario']);
  const actorIdx = findIndex(['actor', 'personaje', 'empresa', 'marca', 'entidad', 'sujeto']);
  const califIdx = findIndex(['calificacion', 'sentimiento', 'tono', 'rating', 'score']);
  const resumenIdx = findIndex(['resumen', 'titular', 'nota', 'descripcion', 'noticia']);
  const linkIdx = findIndex(['link', 'enlace', 'url', 'fuente', 'sitio']);
  const reporteroIdx = findIndex(['reportero', 'periodista', 'autor', 'columnista', 'redaccion']);

  const records: MediaRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || !row.some(cell => cell.trim().length > 0)) continue;

    const rawCalif = (califIdx !== -1 && row[califIdx]) ? row[califIdx].trim().toLowerCase() : 'neutral';
    let calificacion: Calificacion = 'Neutral';
    if (rawCalif.includes('pos') || rawCalif === '1' || rawCalif === '+1' || rawCalif.includes('buen')) {
      calificacion = 'Positiva';
    } else if (rawCalif.includes('neg') || rawCalif === '-1' || rawCalif.includes('mal')) {
      calificacion = 'Negativa';
    }

    const medio = (medioIdx !== -1 && row[medioIdx]) ? row[medioIdx].trim() : 'Medio General';
    const actor = (actorIdx !== -1 && row[actorIdx]) ? row[actorIdx].trim() : 'Actor Monitoreado';
    const fecha = (fechaIdx !== -1 && row[fechaIdx]) ? row[fechaIdx].trim() : new Date().toISOString().split('T')[0];
    const resumen = (resumenIdx !== -1 && row[resumenIdx]) ? row[resumenIdx].trim() : 'Sin resumen disponible';
    const link = (linkIdx !== -1 && row[linkIdx]) ? row[linkIdx].trim() : '#';
    const reportero = (reporteroIdx !== -1 && row[reporteroIdx]) ? row[reporteroIdx].trim() : 'Redacción';

    records.push({
      id: `record-sheet-${i}`,
      fecha,
      medio,
      actor,
      calificacion,
      resumen,
      link,
      reportero
    });
  }

  return records;
}

export function mapRowsToUsers(rows: string[][]): UserRecord[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const findIndex = (aliases: string[]) => {
    return headers.findIndex(h => aliases.some(a => h.includes(a)));
  };

  const idIdx = findIndex(['id', 'codigo', 'num']);
  const userIdx = findIndex(['usuario', 'user', 'email', 'correo', 'username']);
  const passIdx = findIndex(['password', 'contrasena', 'pass', 'clave', 'pwd']);
  const rolIdx = findIndex(['rol', 'role', 'tipo', 'permiso', 'cargo']);
  const nombreIdx = findIndex(['nombre', 'name', 'colaborador', 'usuario_nombre']);

  const users: UserRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const usuario = (userIdx !== -1 && row[userIdx]) ? row[userIdx].trim() : '';
    const password = (passIdx !== -1 && row[passIdx]) ? row[passIdx].trim() : '';
    if (!usuario) continue;

    const rawRol = (rolIdx !== -1 && row[rolIdx]) ? row[rolIdx].trim().toLowerCase() : 'analista';
    let rol: 'admin' | 'analista' | 'lector' = 'analista';
    if (rawRol.includes('admin') || rawRol.includes('dir')) rol = 'admin';
    else if (rawRol.includes('lec') || rawRol.includes('vis')) rol = 'lector';

    const nombre = (nombreIdx !== -1 && row[nombreIdx]) ? row[nombreIdx].trim() : usuario.split('@')[0];
    const id = (idIdx !== -1 && row[idIdx]) ? row[idIdx].trim() : `usr-sheet-${i}`;

    users.push({
      id,
      usuario,
      password,
      rol,
      nombre
    });
  }

  return users;
}
