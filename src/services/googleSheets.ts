/**
 * Media Monitoring & Reputation BI - Google Sheets Integration Service
 * Arquitectura desacoplada: Fase 1 (Google Sheets API) -> Fase 2 (PostgreSQL)
 */

import { User, MediaRecord, UserRole, UserStatus, Calificacion } from '../types/index.js';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '18GrnU-Q1Ci44zuiMj2fxjW169mHnKlrIRlfB-8PcPI0';
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// In-memory cache para mitigar límites de cuota (Rate Limiting de Google)
let cachedUsers: { data: User[]; timestamp: number } | null = null;
let cachedRecords: { data: MediaRecord[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de caché en memoria

/**
 * Genera un Access Token OAuth2 para Google APIs mediante Service Account JWT (Node.js runtime)
 */
async function getGoogleAuthToken(): Promise<string | null> {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    return null;
  }

  try {
    const { createSign } = await import('node:crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const base64Url = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const unsignedToken = `${base64Url(header)}.${base64Url(claim)}`;
    const sign = createSign('RSA-SHA256');
    sign.update(unsignedToken);
    sign.end();
    const signature = sign.sign(PRIVATE_KEY, 'base64url');
    const jwt = `${unsignedToken}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!resp.ok) {
      console.warn('OAuth2 Service Account token error, using resilient fallback:', await resp.text());
      return null;
    }

    const data = await resp.json();
    return data.access_token || null;
  } catch (err) {
    console.warn('Failed to sign service account JWT, falling back to public GVIZ endpoint:', err);
    return null;
  }
}

/**
 * Parser de líneas CSV compatible con comillas dobles y comas internas
 */
function parseCsvRow(rowStr: string): string[] {
  const result: string[] = [];
  let insideQuotes = false;
  let current = '';

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (insideQuotes && rowStr[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normaliza la calificación reputacional
 */
function parseCalificacion(raw: string | undefined): Calificacion {
  if (!raw) return 'Neutral';
  const val = raw.toUpperCase().trim();
  if (val.includes('POS') || val === '1' || val === '+1' || val.includes('BUEN')) return 'Positiva';
  if (val.includes('NEG') || val === '-1' || val.includes('MAL')) return 'Negativa';
  return 'Neutral';
}

/**
 * 1. Extrae y transforma las filas de la pestaña 'USERS'
 * Mapeo estricto de columnas:
 * Col A: id_
 * Col B: usuario
 * Col C: Password
 * Col D: Nombre
 * Col E: Rol
 * Col F: Status
 * Col G: email_alterno
 * Col H: Departamento
 * Col I: fecha_creacion
 * Col J: ultimo_acceso
 * Col K: [IGNORADA - Vacía]
 * Col L: Id (Identificador único global del usuario)
 */
export async function getUsersFromSheets(forceRefresh = false): Promise<User[]> {
  const now = Date.now();
  if (!forceRefresh && cachedUsers && now - cachedUsers.timestamp < CACHE_TTL_MS) {
    return cachedUsers.data;
  }

  const token = await getGoogleAuthToken();

  // Intento 1: Google Sheets REST API v4 oficial con Service Account
  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/USERS!A2:L`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const rows: string[][] = json.values || [];
        const users = rows
          .map((row) => {
            const rawStatus = (row[5] || 'activo').toLowerCase().trim();
            const status: UserStatus =
              rawStatus === 'inactivo' || rawStatus === 'bloqueado' ? rawStatus : 'activo';

            return {
              id: (row[11] || row[0] || '').trim(), // Columna L: 'Id' global
              id_: (row[0] || '').trim(),           // Columna A: 'id_'
              usuario: (row[1] || '').trim(),       // Columna B: 'usuario'
              password: (row[2] || '').trim(),      // Columna C: 'Password'
              nombre: (row[3] || row[1] || 'Usuario').trim(), // Columna D: 'Nombre'
              rol: ((row[4] || 'analista').toLowerCase().trim() as UserRole), // Columna E: 'Rol'
              status,                               // Columna F: 'Status'
              email_alterno: row[6]?.trim() || undefined,
              departamento: row[7]?.trim() || undefined,
              fecha_creacion: row[8]?.trim() || undefined,
              ultimo_acceso: row[9]?.trim() || undefined,
            };
          })
          .filter((u) => u.usuario && u.id);

        cachedUsers = { data: users, timestamp: now };
        return users;
      }
    } catch (apiErr) {
      console.warn('Google Sheets API v4 fetch failed for USERS, using resilient fallback:', apiErr);
    }
  }

  // Intento 2: Export CSV con soporte de cuotas (GVIZ API)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=USERS`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets responded with HTTP status ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const users: User[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      if (!cols[1]) continue;

      const rawStatus = (cols[5] || 'activo').toLowerCase().trim();
      const status: UserStatus =
        rawStatus === 'inactivo' || rawStatus === 'bloqueado' ? rawStatus : 'activo';

      // Columna L (índice 11) almacena el Id global
      const globalId = (cols[11] || cols[0] || `usr-${i}`).trim();

      users.push({
        id: globalId,
        id_: (cols[0] || `usr-${i}`).trim(),
        usuario: cols[1].trim(),
        password: cols[2]?.trim() || '',
        nombre: (cols[3] || cols[1]).trim(),
        rol: ((cols[4] || 'analista').toLowerCase().trim() as UserRole),
        status,
        email_alterno: cols[6]?.trim() || undefined,
        departamento: cols[7]?.trim() || undefined,
        fecha_creacion: cols[8]?.trim() || undefined,
        ultimo_acceso: cols[9]?.trim() || undefined,
      });
    }

    cachedUsers = { data: users, timestamp: now };
    return users;
  } catch (error) {
    console.error('Error fetching users from Google Sheets:', error);
    if (cachedUsers?.data) return cachedUsers.data;
    throw error;
  }
}

/**
 * 2. Valida credenciales contra la pestaña 'USERS'
 * Reglas de negocio:
 * - Búsqueda insensible a mayúsculas para el nombre de usuario
 * - Comparación de contraseña
 * - Restricción estricta de cuenta: Status debe ser exactamente 'activo'
 * - Retorna el objeto User completo con su 'Id' de la Columna L, o null si falla
 */
export async function validateUserCredentials(
  usuario: string,
  password: string
): Promise<User | null> {
  if (!usuario || !password) {
    return null;
  }

  const normalizedUser = usuario.trim().toLowerCase();
  const cleanPassword = password.trim();

  try {
    const users = await getUsersFromSheets();

    const targetUser = users.find(
      (u) => u.usuario.trim().toLowerCase() === normalizedUser
    );

    if (!targetUser) {
      return null;
    }

    // Validación de contraseña
    if (targetUser.password !== cleanPassword) {
      return null;
    }

    // Regla de Exclusividad: Solo usuarios con Status 'activo' pueden iniciar sesión
    if (targetUser.status !== 'activo') {
      console.warn(`Intento de acceso denegado para usuario '${usuario}': Cuenta con estatus '${targetUser.status}'.`);
      return null;
    }

    // Éxito: Retorna el usuario completo (incluyendo Columna L 'id')
    return targetUser;
  } catch (err) {
    console.error('Error en validación de credenciales:', err);
    return null;
  }
}

/**
 * 3. Extrae las filas de la pestaña 'DATA'
 * RANGO ABIERTO: 'DATA!A2:U' sin numeración final ni límites cortos.
 * Mapeo completo de columnas desde Col A (id_) hasta Col U (updatedAt)
 * Col C: 'Usuario' corresponde al Id único del usuario que capturó la nota (FK hacia Col L de USERS)
 */
export async function getMediaRecordsFromSheets(forceRefresh = false): Promise<MediaRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedRecords && now - cachedRecords.timestamp < CACHE_TTL_MS) {
    return cachedRecords.data;
  }

  const token = await getGoogleAuthToken();

  // Intento 1: Google Sheets REST API v4 oficial con Rango Abierto 'DATA!A2:U'
  if (token) {
    try {
      // Rango abierto sin numeración final para consultar desde la fila 2 hasta la última fila de la hoja
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/DATA!A2:U`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const rows: string[][] = json.values || [];

        // Mapeo dinámico completo sin .slice() restrictivo
        const records: MediaRecord[] = rows
          .map((row, idx) => {
            const id_ = (row[0] || `rec-${idx + 1}`).trim();
            const calificacion = parseCalificacion(row[6]);

            return {
              id: id_,
              id_: id_,
              fecha: (row[1] || '').trim() || new Date().toISOString().split('T')[0],
              usuarioId: (row[2] || '').trim(), // Columna C: Usuario (FK a Col L de USERS)
              titulo: (row[3] || 'Sin título').trim(),
              dependencia: row[4]?.trim() || undefined,
              region: row[5]?.trim() || undefined,
              calificacion,
              medio: (row[7] || 'Medio General').trim(),
              reportero: (row[8] || 'Redacción').trim(),
              fuente: row[9]?.trim() || undefined,
              actor: (row[10] || 'Entidad no especificada').trim(),
              tema: row[11]?.trim() || undefined,
              tipo: row[12]?.trim() || undefined,
              link: (row[13] || '#').trim(),
              resumen: (row[14] || row[3] || 'Sin resumen').trim(),
              contexto: row[15]?.trim() || undefined,
              fragmento: row[16]?.trim() || undefined,
              personajes: row[17]?.trim() || undefined,
              instituciones: row[18]?.trim() || undefined,
              municipio: row[19]?.trim() || undefined,
              estado: row[20]?.trim() || undefined,
            };
          })
          .filter((r) => r.actor || r.resumen || r.titulo);

        cachedRecords = { data: records, timestamp: now };
        return records;
      }
    } catch (apiErr) {
      console.warn('Google Sheets API v4 fetch failed for DATA, using resilient open-range fallback:', apiErr);
    }
  }

  // Intento 2: Export CSV con soporte de cuotas sin límite de registros (Rango Abierto)
  try {
    // Se remueve cualquier parámetro de límite (&tq=limit) para traer la totalidad de las filas
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=DATA`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets DATA responded with HTTP status ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const records: MediaRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvRow(lines[i]);
      if (!row || row.length === 0 || !row.some((cell) => cell.length > 0)) continue;

      const id_ = (row[0] || `rec-${i}`).trim();
      const calificacion = parseCalificacion(row[6]);

      records.push({
        id: id_,
        id_: id_,
        fecha: (row[1] || '').trim() || new Date().toISOString().split('T')[0],
        usuarioId: (row[2] || '').trim(), // Columna C: Usuario (Id de USERS Col L)
        titulo: (row[3] || 'Sin título').trim(),
        dependencia: row[4]?.trim() || undefined,
        region: row[5]?.trim() || undefined,
        calificacion,
        medio: (row[7] || 'Medio General').trim(),
        reportero: (row[8] || 'Redacción').trim(),
        fuente: row[9]?.trim() || undefined,
        actor: (row[10] || 'Entidad no especificada').trim(),
        tema: row[11]?.trim() || undefined,
        tipo: row[12]?.trim() || undefined,
        link: (row[13] || '#').trim(),
        resumen: (row[14] || row[3] || 'Sin resumen').trim(),
        contexto: row[15]?.trim() || undefined,
        fragmento: row[16]?.trim() || undefined,
        personajes: row[17]?.trim() || undefined,
        instituciones: row[18]?.trim() || undefined,
        municipio: row[19]?.trim() || undefined,
        estado: row[20]?.trim() || undefined,
      });
    }

    cachedRecords = { data: records, timestamp: now };
    return records;
  } catch (error) {
    console.error('Error fetching DATA records from Google Sheets:', error);
    if (cachedRecords?.data) return cachedRecords.data;
    throw error;
  }
}

/**
 * 4. Interfaz desacoplada (Repository Pattern)
 * Para migrar a PostgreSQL en Fase 2 sin alterar ninguna vista o controlador
 */
export interface IAuthService {
  getUsers(): Promise<User[]>;
  validateCredentials(usuario: string, password: string): Promise<User | null>;
}

export interface IMediaService {
  getRecords(): Promise<MediaRecord[]>;
}

export const googleSheetsAuthService: IAuthService = {
  getUsers: getUsersFromSheets,
  validateCredentials: validateUserCredentials,
};

export const googleSheetsMediaService: IMediaService = {
  getRecords: getMediaRecordsFromSheets,
};
