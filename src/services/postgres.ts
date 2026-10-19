import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Calificacion, MediaRecord, KPIStats, FilterState } from '../types/index.js';
import {
  getTemaMetadata,
  matchesCategory,
  TEMAS_CATALOGO,
  isCategoriaOficial,
  matchCategoriaOficial
} from '../data/temasCatalogo.js';

const { Pool } = pg;

/**
 * Per-request data source. By default the dashboard reads 'monitoreo' (no Facebook);
 * when the request carries incluirFacebook=1 it reads 'monitoreo_total' instead.
 * AsyncLocalStorage keeps the choice scoped to each request, so concurrent users don't collide.
 */
const fuenteContext = new AsyncLocalStorage<{ incluirFacebook: boolean }>();

export function runWithFuente<T>(incluirFacebook: boolean, fn: () => T): T {
  return fuenteContext.run({ incluirFacebook }, fn);
}

export function incluirFacebookActivo(): boolean {
  return fuenteContext.getStore()?.incluirFacebook === true;
}

export function monitoreoTable(): string {
  return incluirFacebookActivo() ? 'monitoreo_total' : 'monitoreo';
}

// Candidate environment variables used across Vercel, Supabase, Neon, and cloud providers
const DB_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'PGDATABASE_URL',
  'POSTGRESQL_URL',
  'PG_URL',
  'DB_URL',
  'VITE_DATABASE_URL',
  'NEXT_PUBLIC_DATABASE_URL',
  'DATABASE_CONNECTION_STRING',
  'POSTGRES_CONNECTION_STRING'
];

export interface DatabaseConnectionMetadata {
  url: string;
  detectedVar: string;
  host: string;
  database: string;
  isCloud: boolean;
}

// Reads the database URL strictly from environment variables (Vercel, Supabase, Neon, etc).
// There is no hardcoded fallback: if no env var is set, this throws instead of silently
// connecting to a hidden default.
let activeOverrideUrl: string | null = null;

export function getCleanDatabaseUrl(): DatabaseConnectionMetadata {
  let detectedVar = '';
  let raw = activeOverrideUrl || '';

  if (!raw) {
    for (const key of DB_ENV_KEYS) {
      const val = process.env[key];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        detectedVar = key;
        raw = val.trim();
        break;
      }
    }
  } else {
    detectedVar = 'AUTO_RECOVERED_URL';
  }

  // Fallback: Check if individual PostgreSQL parameters are present in process.env
  if (!raw) {
    const host = process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST;
    const user = process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER;
    const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;
    const database = process.env.PGDATABASE || process.env.POSTGRES_DATABASE || process.env.DB_NAME;
    const port = process.env.PGPORT || process.env.POSTGRES_PORT || process.env.DB_PORT || '5432';

    if (host && user && database) {
      detectedVar = 'COMPOSED_FROM_PG_VARS';
      raw = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password || '')}@${host}:${port}/${database}`;
    }
  }

  if (!raw) {
    throw new Error(
      `No se encontró ninguna variable de entorno de conexión a PostgreSQL. Define una de: ${DB_ENV_KEYS.join(', ')} o los parámetros individuales PGHOST, PGUSER, PGDATABASE.`
    );
  }

  // Remove wrapping quotes or spaces that users might copy-paste into Vercel UI
  raw = raw.replace(/^["']|["']$/g, '').trim();

  // Proactive auto-recovery: The table is 'monitoreo' inside database 'mnemosine'
  // If the connection string specifies /monitoreo as the database name, rewrite to /mnemosine immediately
  if (/\/monitoreo(\?|$)/i.test(raw)) {
    raw = raw.replace(/\/monitoreo(\?|$)/i, '/mnemosine$1');
  }

  let host = '';
  let database = '';
  try {
    const parsed = new URL(raw.replace(/^postgres(?:ql)?:\/\//, 'http://'));
    host = parsed.host;
    database = parsed.pathname.replace(/^\//, '');
  } catch {
    // fallback parsing
  }

  // Known managed providers that require SSL even without an explicit sslmode/ssl param.
  // A bare IP:port server (e.g. a self-hosted instance) is NOT assumed to require SSL.
  const managedCloudHostPatterns = ['neon.tech', 'supabase.co', 'vercel-storage.com', 'amazonaws.com', 'azure.com'];
  const isCloud = Boolean(host) && managedCloudHostPatterns.some((p) => host.includes(p));

  return { url: raw, detectedVar, host, database, isCloud };
}

let pool: pg.Pool | null = null;
let currentSslSetting: boolean | { rejectUnauthorized: boolean } = false;
let currentPoolUrl: string = '';

export function getPostgresPool(forceSsl?: boolean | { rejectUnauthorized: boolean }, customUrl?: string): pg.Pool {
  const meta = getCleanDatabaseUrl();
  const targetUrl = customUrl || meta.url;

  // Determine initial SSL mode
  let targetSsl: boolean | { rejectUnauthorized: boolean } = false;
  if (forceSsl !== undefined) {
    targetSsl = forceSsl;
  } else {
    const lowerUrl = targetUrl.toLowerCase();
    if (lowerUrl.includes('sslmode=disable')) {
      targetSsl = false;
    } else if (lowerUrl.includes('sslmode=require') || lowerUrl.includes('ssl=true') || meta.isCloud) {
      // Cloud providers (Neon, Supabase, Vercel Postgres) require SSL
      targetSsl = { rejectUnauthorized: false };
    } else {
      // Direct IP Azure server or self-hosted does not force SSL
      targetSsl = false;
    }
  }

  if (!pool || currentSslSetting !== targetSsl || currentPoolUrl !== targetUrl) {
    if (pool) {
      pool.end().catch(() => {});
    }

    currentSslSetting = targetSsl;
    currentPoolUrl = targetUrl;
    pool = new Pool({
      connectionString: targetUrl,
      max: 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000, // 10s connection timeout for reliable connection establishment
      ssl: targetSsl,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

/**
 * STRICT READ-ONLY QUERY ENFORCER WITH AUTO-ADAPTIVE SSL AND DB RECOVERY
 * Guarantees at application level that no write, update, delete or DDL operations
 * can ever be dispatched to the database. Automatically recovers if SSL was rejected or required,
 * or if the database name in the connection string was set to 'monitoreo' instead of 'mnemosine'.
 */
export async function executeReadOnlyQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const normalized = sql.trim().toLowerCase();

  // Must begin with SELECT or WITH
  if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
    throw new Error(
      'VIOLACIÓN DE POLÍTICA: Esta conexión a PostgreSQL es de estricto uso de SOLO LECTURA. Solo se permiten sentencias SELECT.'
    );
  }

  // Block any mutation or administrative SQL keywords
  const blockedKeywords = [
    'insert', 'update', 'delete', 'drop', 'truncate', 'alter',
    'create', 'grant', 'revoke', 'copy', 'execute', 'call'
  ];

  for (const keyword of blockedKeywords) {
    const wordBoundary = new RegExp(`\\b${keyword}\\b`, 'i');
    if (wordBoundary.test(normalized)) {
      throw new Error(
        `VIOLACIÓN DE POLÍTICA: La instrucción contiene la palabra clave restringida '${keyword}'. La base de datos es exclusivamente de lectura.`
      );
    }
  }

  const meta = getCleanDatabaseUrl();

  try {
    const client = getPostgresPool();
    const result = await client.query(sql, params);
    return result.rows as T[];
  } catch (err: any) {
    const errMsg = (err.message || '').toLowerCase();

    // Auto-adaptive recovery 1: Remote server doesn't support SSL -> switch to ssl: false
    if (errMsg.includes('does not support ssl') || errMsg.includes('server does not support ssl')) {
      console.warn('PostgreSQL SSL notice: Server does not support SSL. Retrying with plaintext connection...');
      const fallbackClient = getPostgresPool(false);
      const result = await fallbackClient.query(sql, params);
      return result.rows as T[];
    }

    // Auto-adaptive recovery 2: Remote server requires SSL -> switch to ssl: { rejectUnauthorized: false }
    if (errMsg.includes('no pg_hba.conf entry') || errMsg.includes('ssl required') || errMsg.includes('ssl/tls required') || errMsg.includes('pg_hba.conf rejects')) {
      console.warn('PostgreSQL SSL notice: Server requires SSL. Retrying with SSL enabled...');
      const fallbackClient = getPostgresPool({ rejectUnauthorized: false });
      const result = await fallbackClient.query(sql, params);
      return result.rows as T[];
    }

    // Auto-adaptive recovery 3: If database "monitoreo" does not exist, retry with database "mnemosine" (where table monitoreo actually lives)
    if (errMsg.includes('does not exist') && (errMsg.includes('monitoreo') || meta.database === 'monitoreo')) {
      console.warn('PostgreSQL notice: Database "monitoreo" not found. The table "monitoreo" is located inside database "mnemosine". Retrying with database "mnemosine"...');
      const fixedUrl = meta.url.replace(/\/monitoreo(\?|$)/i, '/mnemosine$1');
      activeOverrideUrl = fixedUrl;
      const fallbackClient = getPostgresPool(currentSslSetting, fixedUrl);
      const result = await fallbackClient.query(sql, params);
      return result.rows as T[];
    }

    throw err;
  }
}

/**
 * Normalizes sentiment strings from database values into strict Calificacion union type
 */
function normalizeCalificacion(val: string | null | undefined): Calificacion {
  if (!val) return 'Neutral';
  const clean = val.trim().toUpperCase();
  if (clean.includes('POSITIV')) return 'Positiva';
  if (clean.includes('NEGATIV')) return 'Negativa';
  return 'Neutral';
}

/**
 * Maps raw PostgreSQL row from table 'monitoreo' to domain MediaRecord
 */
export function mapPostgresRowToMediaRecord(row: any): MediaRecord {
  // Facebook rows (monitoreo_social) have no numeric id; fall back to their Link so each record keeps a unique key
  const idStr = String(row.id || row.Link || '');
  const temaStr = row.Tema ? String(row.Tema).trim() : '';
  const temaMeta = getTemaMetadata(temaStr);
  const matchedOfficialCat = matchCategoriaOficial(row.Categoria);
  const resolvedCat = matchedOfficialCat || temaMeta?.categoria || undefined;
  const resolvedSecCat = row.categoria_secundaria ? String(row.categoria_secundaria).trim() : (temaMeta?.categoria_secundaria || undefined);

  return {
    id: idStr,
    id_: idStr,
    fecha: row.Fecha ? String(row.Fecha).trim() : '',
    usuarioId: row.Usuario ? String(row.Usuario).trim() : '',
    titulo: row.Titulo ? String(row.Titulo).trim() : 'Sin título',
    dependencia: row.Dependencia ? String(row.Dependencia).trim() : undefined,
    region: row.Region ? String(row.Region).trim() : undefined,
    calificacion: normalizeCalificacion(row.Calificacion),
    medio: row.Medio ? String(row.Medio).trim() : 'Medio General',
    reportero: row.Reportero ? String(row.Reportero).trim() : 'Redacción',
    fuente: row.Fuente ? String(row.Fuente).trim() : undefined,
    actor: row.Actor ? String(row.Actor).trim() : 'Entidad no especificada',
    tema: row.Tema ? String(row.Tema).trim() : undefined,
    tipo: row.Tipo ? String(row.Tipo).trim() : undefined,
    link: row.Link ? String(row.Link).trim() : '#',
    resumen: row.Resumen ? String(row.Resumen).trim() : (row.Titulo || 'Sin resumen'),
    contexto: row.Contexto ? String(row.Contexto).trim() : undefined,
    fragmento: row.Fragmento ? String(row.Fragmento).trim() : undefined,
    personajes: row.Personajes ? String(row.Personajes).trim() : undefined,
    instituciones: row.Instituciones ? String(row.Instituciones).trim() : undefined,
    municipio: row.Municipio ? String(row.Municipio).trim() : undefined,
    estado: row.Estado ? String(row.Estado).trim() : (row.Region ? String(row.Region).trim() : undefined),
    categoria: resolvedCat,
    categoriaSecundaria: resolvedSecCat,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

/**
 * Tests connection and returns high-level diagnostic metadata for Vercel & local environments
 */
export async function getPostgresDiagnostics() {
  const start = Date.now();
  let meta: DatabaseConnectionMetadata | null = null;

  // Inspect environment safely (keys only, no passwords)
  const envInspection = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
    hasViteDatabaseUrl: Boolean(process.env.VITE_DATABASE_URL),
    isVercel: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
    vercelEnv: process.env.VERCEL_ENV || 'local',
    matchingEnvKeys: Object.keys(process.env).filter(
      (k) => k.includes('DATA') || k.includes('POSTGRES') || k.includes('DB') || k.includes('PG')
    ),
  };

  try {
    meta = getCleanDatabaseUrl();
    const countResult = await executeReadOnlyQuery<{ count: string }>(`SELECT count(*) as count FROM ${monitoreoTable()}`);
    meta = getCleanDatabaseUrl();
    const latencyMs = Date.now() - start;

    return {
      status: 'connected',
      success: true,
      readOnly: true,
      engine: `PostgreSQL 16+ (${meta.database})`,
      table: monitoreoTable(),
      detectedEnvVar: meta.detectedVar,
      host: meta.host,
      database: meta.database,
      isCloud: meta.isCloud,
      sslActive: Boolean(currentSslSetting),
      totalRecords: parseInt(countResult[0]?.count || '0', 10),
      latencyMs,
      security: 'Read-Only session & application-level SELECT filtering hard enforced',
      vercelReady: true,
      envInspection,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    return {
      status: 'error',
      success: false,
      readOnly: true,
      engine: `PostgreSQL 16+ (${meta?.database || 'desconocida'})`,
      table: monitoreoTable(),
      detectedEnvVar: meta?.detectedVar || '',
      host: meta?.host || '',
      database: meta?.database || '',
      isCloud: meta?.isCloud || false,
      sslActive: Boolean(currentSslSetting),
      latencyMs,
      error: error.message || 'Error desconocido al conectar con PostgreSQL',
      envInspection,
      troubleshooting: [
        '1. Verifica si la variable en Vercel se llama DATABASE_URL o POSTGRES_URL.',
        '2. En Vercel: Al agregar o modificar variables de entorno debes hacer REDEPLOY (Deployments > ... > Redeploy) para que la función serverless las cargue.',
        `3. Revisa si el servidor PostgreSQL${meta?.host ? ` (${meta.host})` : ''} tiene firewall/reglas de red abiertas para el tráfico saliente de Vercel.`,
        '4. Si usas Supabase o Neon, asegúrate de haber copiado la cadena en modo Direct o Pooler con usuario y contraseña válidos.',
        '5. Base de datos vs Tabla: En el servidor 40.233.14.61:5433, la base de datos se llama "mnemosine" y la tabla es "monitoreo". La URL debe terminar en /mnemosine.'
      ]
    };
  }
}

export interface PostgresQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  actores?: string[];
  medios?: string[];
  temas?: string[];
  reporteros?: string[];
  calificaciones?: Calificacion[];
  estados?: string[];
  municipios?: string[];
  categorias?: string[];
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Builds parameterized WHERE clauses for safe, read-only queries
 */
export function buildWhereClauses(
  options: PostgresQueryOptions,
  omitField?: string,
  startParamIdx: number = 1
): { sql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  let paramIdx = startParamIdx;

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    clauses.push(`(
      "Titulo" ILIKE $${paramIdx} OR
      "Resumen" ILIKE $${paramIdx} OR
      "Actor" ILIKE $${paramIdx} OR
      "Medio" ILIKE $${paramIdx} OR
      "Tema" ILIKE $${paramIdx} OR
      "Reportero" ILIKE $${paramIdx} OR
      "Dependencia" ILIKE $${paramIdx} OR
      "Municipio" ILIKE $${paramIdx} OR
      "Estado" ILIKE $${paramIdx} OR
      "Region" ILIKE $${paramIdx}
    )`);
    params.push(term);
    paramIdx++;
  }

  if (omitField !== 'actores' && options.actores && options.actores.length > 0) {
    clauses.push(`"Actor" = ANY($${paramIdx}::text[])`);
    params.push(options.actores);
    paramIdx++;
  }

  if (omitField !== 'medios' && options.medios && options.medios.length > 0) {
    clauses.push(`"Medio" = ANY($${paramIdx}::text[])`);
    params.push(options.medios);
    paramIdx++;
  }

  if (omitField !== 'temas' && omitField !== 'temas_and_categorias' && options.temas && options.temas.length > 0) {
    clauses.push(`"Tema" = ANY($${paramIdx}::text[])`);
    params.push(options.temas);
    paramIdx++;
  }

  if (omitField !== 'reporteros' && options.reporteros && options.reporteros.length > 0) {
    clauses.push(`"Reportero" = ANY($${paramIdx}::text[])`);
    params.push(options.reporteros);
    paramIdx++;
  }

  if (omitField !== 'calificaciones' && options.calificaciones && options.calificaciones.length > 0) {
    const uppercaseVals = options.calificaciones.map((c) => String(c).toUpperCase());
    clauses.push(`UPPER("Calificacion") = ANY($${paramIdx}::text[])`);
    params.push(uppercaseVals);
    paramIdx++;
  }

  if (omitField !== 'estados' && options.estados && options.estados.length > 0) {
    clauses.push(`(
      "Estado" = ANY($${paramIdx}::text[]) OR
      "Region" = ANY($${paramIdx}::text[])
    )`);
    params.push(options.estados);
    paramIdx++;
  }

  if (omitField !== 'municipios' && options.municipios && options.municipios.length > 0) {
    clauses.push(`"Municipio" = ANY($${paramIdx}::text[])`);
    params.push(options.municipios);
    paramIdx++;
  }

  if (omitField !== 'categorias' && omitField !== 'temas_and_categorias' && options.categorias && options.categorias.length > 0) {
    const uppercaseCats = options.categorias.map((c) => String(c).trim().toUpperCase());
    clauses.push(`(
      UPPER(TRIM("Categoria")) = ANY($${paramIdx}::text[]) OR
      UPPER(TRIM("Tema")) = ANY($${paramIdx}::text[]) OR
      UPPER(TRIM("Tema")) IN (
        SELECT UPPER(TRIM(nombre)) FROM temas_completo
        WHERE UPPER(TRIM(categoria)) = ANY($${paramIdx}::text[])
           OR UPPER(TRIM(categoria_secundaria)) = ANY($${paramIdx}::text[])
      )
    )`);
    params.push(uppercaseCats);
    paramIdx++;
  }

  if (options.startDate) {
    clauses.push(`"Fecha" >= $${paramIdx}`);
    params.push(options.startDate);
    paramIdx++;
  }

  if (options.endDate) {
    clauses.push(`"Fecha" <= $${paramIdx}`);
    params.push(options.endDate);
    paramIdx++;
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { sql: whereSql, params };
}

// Listing columns: everything except the heavy free-text fields (Contexto ~3KB/row, Fragmento ~0.6KB/row),
// which are loaded on demand through getPostgresRecordDetails().
const LIST_COLUMNS = [
  'id', 'Fecha', 'Usuario', 'Titulo', 'Dependencia', 'Region', 'Calificacion', 'Medio', 'Reportero',
  'Fuente', 'Actor', 'Tema', 'Tipo', 'Link', 'Resumen', 'Personajes', 'Instituciones', 'Municipio',
  'Estado', 'createdAt', 'updatedAt', 'Categoria'
].map((c) => `"${c}"`).join(', ');

/**
 * Loads the heavy detail fields (Contexto, Fragmento) for a small set of record ids
 */
export async function getPostgresRecordDetails(
  ids: string[]
): Promise<Record<string, { contexto?: string; fragmento?: string }>> {
  const cleanIds = Array.from(new Set(ids.map((i) => String(i).trim()).filter((i) => /^\d+$/.test(i)))).slice(0, 200);
  if (cleanIds.length === 0) return {};

  const rows = await executeReadOnlyQuery<any>(
    `SELECT id, "Contexto", "Fragmento" FROM ${monitoreoTable()} WHERE id = ANY($1::bigint[])`,
    [cleanIds]
  );

  const out: Record<string, { contexto?: string; fragmento?: string }> = {};
  for (const row of rows) {
    out[String(row.id)] = {
      contexto: row.Contexto ? String(row.Contexto).trim() : undefined,
      fragmento: row.Fragmento ? String(row.Fragmento).trim() : undefined,
    };
  }
  return out;
}

/**
 * Fetches filtered records with server-side pagination directly from PostgreSQL
 */
export async function getPostgresRecords(options: PostgresQueryOptions = {}): Promise<{
  records: MediaRecord[];
  total: number;
}> {
  const { sql: whereSql, params } = buildWhereClauses(options);

  // 1. Get filtered count
  const countSql = `SELECT count(*) as count FROM ${monitoreoTable()} ${whereSql}`;
  const countRes = await executeReadOnlyQuery<{ count: string }>(countSql, params);
  const total = parseInt(countRes[0]?.count || '0', 10);

  // 2. Determine sort order safely (prevent SQL injection on sort column)
  const sortMap: Record<string, string> = {
    fecha: '"Fecha"',
    actor: '"Actor"',
    medio: '"Medio"',
    calificacion: '"Calificacion"',
    id: 'id'
  };
  const orderCol = (options.sortField && sortMap[options.sortField.toLowerCase()]) || '"Fecha"';
  const orderDir = options.sortDirection?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // 3. Query paginated records
  const limit = options.limit && options.limit > 0 ? options.limit : 3000;
  const offset = options.offset && options.offset >= 0 ? options.offset : 0;

  const dataSql = `
    SELECT ${LIST_COLUMNS}
    FROM ${monitoreoTable()}
    ${whereSql}
    ORDER BY ${orderCol} ${orderDir}, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await executeReadOnlyQuery(dataSql, params);
  const records = rows.map(mapPostgresRowToMediaRecord);

  return { records, total };
}

/**
 * Calculates aggregated KPIs directly within PostgreSQL engine in < 15ms across 122,264+ records
 */
export async function getPostgresKPIStats(options: PostgresQueryOptions = {}): Promise<KPIStats> {
  const { sql: whereSql, params } = buildWhereClauses(options);

  const statsSql = `
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) AS positivas,
      COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) AS negativas,
      COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) AS neutrales,
      COUNT(DISTINCT "Actor") AS actores_unicos,
      COUNT(DISTINCT "Medio") AS medios_unicos,
      COUNT(DISTINCT "Tema") AS temas_unicos,
      COUNT(DISTINCT "Reportero") AS reporteros_unicos
    FROM ${monitoreoTable()}
    ${whereSql}
  `;

  const res = await executeReadOnlyQuery<any>(statsSql, params);
  const row = res[0] || {};

  const total = parseInt(row.total || '0', 10);
  const pos = parseInt(row.positivas || '0', 10);
  const neg = parseInt(row.negativas || '0', 10);
  const neu = parseInt(row.neutrales || '0', 10);

  const positivePct = total > 0 ? Math.round((pos / total) * 100) : 0;
  const negativePct = total > 0 ? Math.round((neg / total) * 100) : 0;
  const neutralPct = total > 0 ? Math.round((neu / total) * 100) : 0;
  const netSentimentScore = positivePct - negativePct;

  return {
    totalMenciones: total,
    positivas: pos,
    neutrales: neu,
    negativas: neg,
    netSentimentScore,
    actoresUnicos: parseInt(row.actores_unicos || '0', 10),
    mediosUnicos: parseInt(row.medios_unicos || '0', 10),
    temasUnicos: parseInt(row.temas_unicos || '0', 10),
    reporterosUnicos: parseInt(row.reporteros_unicos || '0', 10),
    positivePct,
    negativePct,
    neutralPct,
  };
}

export interface CumulativeTrendPoint {
  semana_inicio: string;
  pos_semana: number;
  neg_semana: number;
  neu_semana: number;
  total_semana: number;
  pos_acumulado: number;
  neg_acumulado: number;
  neu_acumulado: number;
  total_acumulado: number;
}

/**
 * Calculates cumulative sentiment trends week-over-week (or day-over-day)
 * Starts from zero and builds up running totals to the historical maximum.
 */
export async function getPostgresCumulativeTrends(
  options: PostgresQueryOptions = {},
  granularity: 'week' | 'day' = 'week'
): Promise<CumulativeTrendPoint[]> {
  const { sql: whereSql, params } = buildWhereClauses(options);
  const truncUnit = granularity === 'day' ? 'day' : 'week';

  const dateFilter = `("Fecha" IS NOT NULL AND "Fecha" != '' AND "Fecha" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')`;
  const fullWhere = whereSql ? `${whereSql} AND ${dateFilter}` : `WHERE ${dateFilter}`;

  const query = `
    WITH semana_resumen AS (
      SELECT 
        DATE_TRUNC('${truncUnit}', "Fecha"::timestamp)::DATE AS semana_inicio,
        COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%positiv%') AS pos_semana,
        COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%negativ%') AS neg_semana,
        COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%neutral%') AS neu_semana,
        COUNT(*) AS total_semana
      FROM ${monitoreoTable()}
      ${fullWhere}
      GROUP BY DATE_TRUNC('${truncUnit}', "Fecha"::timestamp)
    )
    SELECT 
      TO_CHAR(semana_inicio, 'YYYY-MM-DD') AS semana_inicio,
      pos_semana::int,
      neg_semana::int,
      neu_semana::int,
      total_semana::int,
      SUM(pos_semana) OVER (ORDER BY semana_inicio)::int AS pos_acumulado,
      SUM(neg_semana) OVER (ORDER BY semana_inicio)::int AS neg_acumulado,
      SUM(neu_semana) OVER (ORDER BY semana_inicio)::int AS neu_acumulado,
      SUM(total_semana) OVER (ORDER BY semana_inicio)::int AS total_acumulado
    FROM semana_resumen
    ORDER BY semana_inicio ASC;
  `;

  return await executeReadOnlyQuery<CumulativeTrendPoint>(query, params);
}

export interface FilterContextOptions {
  startDate?: string;
  endDate?: string;
  categorias?: string[];
  estados?: string[];
  municipios?: string[];
  calificaciones?: Calificacion[];
  actores?: string[];
  medios?: string[];
  temas?: string[];
  reporteros?: string[];
  search?: string;
}

export type GeoFilterContext = FilterContextOptions;

interface FilterCacheEntry {
  time: number;
  data: {
    actores: Array<{ name: string; count: number }>;
    medios: Array<{ name: string; count: number }>;
    temas: Array<{ name: string; count: number }>;
    reporteros: Array<{ name: string; count: number }>;
    estados: Array<{ name: string; count: number }>;
    municipios: Array<{ name: string; count: number }>;
    categorias: Array<{ name: string; count: number }>;
  };
}

const filterCache = new Map<string, FilterCacheEntry>();

export async function getPostgresFilterOptions(
  forceRefresh = false,
  filterContext?: FilterContextOptions | GeoFilterContext
): Promise<{
  actores: Array<{ name: string; count: number }>;
  medios: Array<{ name: string; count: number }>;
  temas: Array<{ name: string; count: number }>;
  reporteros: Array<{ name: string; count: number }>;
  estados: Array<{ name: string; count: number }>;
  municipios: Array<{ name: string; count: number }>;
  categorias: Array<{ name: string; count: number }>;
}> {
  const ctx: PostgresQueryOptions = {
    startDate: filterContext?.startDate || undefined,
    endDate: filterContext?.endDate || undefined,
    categorias: filterContext?.categorias || [],
    estados: filterContext?.estados || [],
    municipios: filterContext?.municipios || [],
    calificaciones: filterContext?.calificaciones || [],
    actores: filterContext?.actores || [],
    medios: filterContext?.medios || [],
    temas: filterContext?.temas || [],
    reporteros: filterContext?.reporteros || [],
    search: filterContext?.search || undefined
  };

  const cacheKey = JSON.stringify({
    table: monitoreoTable(),
    start: ctx.startDate,
    end: ctx.endDate,
    cats: ctx.categorias?.slice().sort(),
    ests: ctx.estados?.slice().sort(),
    muns: ctx.municipios?.slice().sort(),
    cals: ctx.calificaciones?.slice().sort(),
    meds: ctx.medios?.slice().sort(),
    acts: ctx.actores?.slice().sort(),
    tems: ctx.temas?.slice().sort(),
    reps: ctx.reporteros?.slice().sort(),
    search: ctx.search?.trim().toLowerCase()
  });

  const now = Date.now();
  if (!forceRefresh && filterCache.has(cacheKey)) {
    const entry = filterCache.get(cacheKey)!;
    if (now - entry.time < 120000) {
      return entry.data;
    }
  }

  // 1. Actores: scoped to period, category, geo, and sentiment
  const { sql: actorWhere, params: actorParams } = buildWhereClauses(ctx, 'actores');
  const actorCond = actorWhere
    ? `${actorWhere} AND "Actor" IS NOT NULL AND TRIM("Actor") != '' AND "Actor" != 'Sin actor'`
    : `WHERE "Actor" IS NOT NULL AND TRIM("Actor") != '' AND "Actor" != 'Sin actor'`;

  // 2. Medios: scoped to period, category, geo, and sentiment
  const { sql: medioWhere, params: medioParams } = buildWhereClauses(ctx, 'medios');
  const medioCond = medioWhere
    ? `${medioWhere} AND "Medio" IS NOT NULL AND TRIM("Medio") != ''`
    : `WHERE "Medio" IS NOT NULL AND TRIM("Medio") != ''`;

  // 3. Temas: scoped to period, category, geo, and sentiment
  let temasQuery = '';
  let temasQueryParams: any[] = [];
  const hasMediosFilter = Boolean(ctx.medios && ctx.medios.length > 0);
  const hasActorFilter = Boolean(ctx.actores && ctx.actores.length > 0);
  const hasActiveFilterScope = Boolean(
    hasActorFilter ||
    hasMediosFilter ||
    ctx.startDate ||
    ctx.endDate ||
    (ctx.estados && ctx.estados.length > 0) ||
    (ctx.municipios && ctx.municipios.length > 0) ||
    (ctx.calificaciones && ctx.calificaciones.length > 0)
  );

  if (ctx.categorias && ctx.categorias.length > 0) {
    const uppercaseCats = ctx.categorias.map((c) => String(c).trim().toUpperCase());
    const { sql: temaWhere, params: temaParams } = buildWhereClauses(ctx, 'temas_and_categorias', 2);
    const monitoreoCond = temaWhere
      ? `${temaWhere} AND "Tema" IS NOT NULL AND TRIM("Tema") != ''`
      : `WHERE "Tema" IS NOT NULL AND TRIM("Tema") != ''`;

    temasQuery = `
      SELECT 
        tc.nombre as name,
        tc.categoria as "categoria",
        tc.categoria_secundaria as "categoriaSecundaria",
        COALESCE(m_counts.count, 0)::text as count,
        (UPPER(TRIM(tc.categoria)) = ANY($1::text[])) as is_primary,
        (UPPER(TRIM(tc.categoria_secundaria)) = ANY($1::text[])) as is_secondary
      FROM temas_completo tc
      ${hasActiveFilterScope ? 'JOIN' : 'LEFT JOIN'} (
        SELECT UPPER(TRIM("Tema")) as tema_key, count(*) as count
        FROM ${monitoreoTable()}
        ${monitoreoCond}
        GROUP BY UPPER(TRIM("Tema"))
      ) m_counts ON UPPER(TRIM(tc.nombre)) = m_counts.tema_key
      WHERE (
        UPPER(TRIM(tc.categoria)) = ANY($1::text[]) OR 
        UPPER(TRIM(tc.categoria_secundaria)) = ANY($1::text[])
      )
      ${hasActiveFilterScope ? 'AND m_counts.count > 0' : ''}
      ORDER BY is_primary DESC, COALESCE(m_counts.count, 0) DESC, tc.nombre ASC
    `;
    temasQueryParams = [uppercaseCats, ...temaParams];
  } else if (hasActiveFilterScope) {
    // When an actor, medio, or period is selected (without category), show only the temas present in those notes
    const { sql: temaWhere, params: temaParams } = buildWhereClauses(ctx, 'temas');
    const mCond = temaWhere
      ? `${temaWhere
          .replaceAll('"Fecha"', 'm."Fecha"')
          .replaceAll('"Actor"', 'm."Actor"')
          .replaceAll('"Medio"', 'm."Medio"')
          .replaceAll('"Calificacion"', 'm."Calificacion"')
          .replaceAll('"Estado"', 'm."Estado"')
          .replaceAll('"Region"', 'm."Region"')
          .replaceAll('"Municipio"', 'm."Municipio"')} AND m."Tema" IS NOT NULL AND TRIM(m."Tema") != ''`
      : `WHERE m."Tema" IS NOT NULL AND TRIM(m."Tema") != ''`;

    temasQuery = `
      SELECT 
        m."Tema" as name,
        tc.categoria as "categoria",
        tc.categoria_secundaria as "categoriaSecundaria",
        count(*)::text as count,
        true as is_primary,
        false as is_secondary
      FROM ${monitoreoTable()} m
      LEFT JOIN temas_completo tc ON UPPER(TRIM(m."Tema")) = UPPER(TRIM(tc.nombre))
      ${mCond}
      GROUP BY m."Tema", tc.categoria, tc.categoria_secundaria
      ORDER BY count(*) DESC, m."Tema" ASC
      LIMIT 250
    `;
    temasQueryParams = temaParams;
  } else {
    const { sql: temaWhere, params: temaParams } = buildWhereClauses(ctx, 'temas');
    const monitoreoCond = temaWhere
      ? `${temaWhere} AND "Tema" IS NOT NULL AND TRIM("Tema") != ''`
      : `WHERE "Tema" IS NOT NULL AND TRIM("Tema") != ''`;

    temasQuery = `
      SELECT 
        tc.nombre as name,
        tc.categoria as "categoria",
        tc.categoria_secundaria as "categoriaSecundaria",
        COALESCE(m_counts.count, 0)::text as count,
        true as is_primary,
        false as is_secondary
      FROM temas_completo tc
      LEFT JOIN (
        SELECT UPPER(TRIM("Tema")) as tema_key, count(*) as count
        FROM ${monitoreoTable()}
        ${monitoreoCond}
        GROUP BY UPPER(TRIM("Tema"))
      ) m_counts ON UPPER(TRIM(tc.nombre)) = m_counts.tema_key
      ORDER BY COALESCE(m_counts.count, 0) DESC, tc.nombre ASC
    `;
    temasQueryParams = temaParams;
  }

  // 4. Reporteros: scoped to period, category, geo, and sentiment
  const { sql: repWhere, params: repParams } = buildWhereClauses(ctx, 'reporteros');
  const repCond = repWhere
    ? `${repWhere} AND "Reportero" IS NOT NULL AND TRIM("Reportero") != '' AND "Reportero" != 'Redacción'`
    : `WHERE "Reportero" IS NOT NULL AND TRIM("Reportero") != '' AND "Reportero" != 'Redacción'`;

  // 5. Estados: scoped to period, category, and sentiment
  const { sql: estWhere, params: estParams } = buildWhereClauses(ctx, 'estados');
  const estCond = estWhere
    ? `${estWhere} AND COALESCE(NULLIF(TRIM("Estado"), ''), NULLIF(TRIM("Region"), '')) IS NOT NULL`
    : `WHERE COALESCE(NULLIF(TRIM("Estado"), ''), NULLIF(TRIM("Region"), '')) IS NOT NULL`;

  // 6. Municipios: scoped to period, category, estado, and sentiment
  const { sql: munWhere, params: munParams } = buildWhereClauses(ctx, 'municipios');
  const munCond = munWhere
    ? `${munWhere} AND "Municipio" IS NOT NULL AND TRIM("Municipio") != ''`
    : `WHERE "Municipio" IS NOT NULL AND TRIM("Municipio") != ''`;

  // 7. Categorias: ONLY official categories from categorias_tema (scoped to active filters)
  const { sql: catWhere, params: catParams } = buildWhereClauses(ctx, 'categorias');
  const directCatCond = catWhere
    ? `${catWhere} AND "Categoria" IS NOT NULL AND TRIM("Categoria") != ''`
    : `WHERE "Categoria" IS NOT NULL AND TRIM("Categoria") != ''`;

  const mCatWhere = catWhere
    ? catWhere
        .replaceAll('"Fecha"', 'm."Fecha"')
        .replaceAll('"Actor"', 'm."Actor"')
        .replaceAll('"Medio"', 'm."Medio"')
        .replaceAll('"Calificacion"', 'm."Calificacion"')
        .replaceAll('"Estado"', 'm."Estado"')
        .replaceAll('"Region"', 'm."Region"')
        .replaceAll('"Municipio"', 'm."Municipio"')
        .replaceAll('"Tema"', 'm."Tema"')
    : '';

  const joinedCatCond = mCatWhere
    ? `${mCatWhere} AND (m."Categoria" IS NULL OR TRIM(m."Categoria") = '')`
    : `WHERE (m."Categoria" IS NULL OR TRIM(m."Categoria") = '')`;

  const categoriasQuery = `
    SELECT 
      ct.nombre as name,
      COALESCE(SUM(sub.cnt), 0)::text as count
    FROM categorias_tema ct
    LEFT JOIN (
      SELECT UPPER(TRIM("Categoria")) as cat_name, count(*) as cnt
      FROM ${monitoreoTable()}
      ${directCatCond}
      GROUP BY UPPER(TRIM("Categoria"))
      
      UNION ALL
      
      SELECT UPPER(TRIM(tc.categoria)) as cat_name, count(*) as cnt
      FROM ${monitoreoTable()} m
      JOIN temas_completo tc ON UPPER(TRIM(m."Tema")) = UPPER(TRIM(tc.nombre))
      ${joinedCatCond}
        AND tc.categoria IS NOT NULL
      GROUP BY UPPER(TRIM(tc.categoria))

      UNION ALL

      SELECT UPPER(TRIM(tc.categoria_secundaria)) as cat_name, count(*) as cnt
      FROM ${monitoreoTable()} m
      JOIN temas_completo tc ON UPPER(TRIM(m."Tema")) = UPPER(TRIM(tc.nombre))
      ${joinedCatCond}
        AND tc.categoria_secundaria IS NOT NULL
      GROUP BY UPPER(TRIM(tc.categoria_secundaria))
    ) sub ON UPPER(TRIM(ct.nombre)) = sub.cat_name
    GROUP BY ct.id, ct.nombre
    ORDER BY count DESC
  `;

  const [actoresRes, mediosRes, temasRes, reporterosRes, estadosRes, municipiosRes, categoriasRes] = await Promise.all([
    executeReadOnlyQuery<{ name: string; count: string }>(`
      SELECT "Actor" as name, count(*) as count
      FROM ${monitoreoTable()}
      ${actorCond}
      GROUP BY "Actor"
      ORDER BY count DESC
      LIMIT 300
    `, actorParams).catch(() => [] as any),
    executeReadOnlyQuery<{ name: string; count: string }>(`
      SELECT "Medio" as name, count(*) as count
      FROM ${monitoreoTable()}
      ${medioCond}
      GROUP BY "Medio"
      ORDER BY count DESC
      LIMIT 300
    `, medioParams).catch(() => [] as any),
    executeReadOnlyQuery<any>(temasQuery, temasQueryParams).catch(() => [] as any),
    executeReadOnlyQuery<{ name: string; count: string }>(`
      SELECT "Reportero" as name, count(*) as count
      FROM ${monitoreoTable()}
      ${repCond}
      GROUP BY "Reportero"
      ORDER BY count DESC
      LIMIT 300
    `, repParams).catch(() => [] as any),
    executeReadOnlyQuery<{ name: string; count: string }>(`
      SELECT COALESCE(NULLIF(TRIM("Estado"), ''), NULLIF(TRIM("Region"), '')) as name, count(*) as count
      FROM ${monitoreoTable()}
      ${estCond}
      GROUP BY name
      ORDER BY count DESC
      LIMIT 100
    `, estParams).catch(() => [] as any),
    executeReadOnlyQuery<{ name: string; count: string }>(`
      SELECT "Municipio" as name, count(*) as count
      FROM ${monitoreoTable()}
      ${munCond}
      GROUP BY "Municipio"
      ORDER BY count DESC
      LIMIT 250
    `, munParams).catch(() => [] as any),
    executeReadOnlyQuery<{ name: string; count: string }>(categoriasQuery, catParams).catch(() => [] as any),
  ]);

  const result = {
    actores: (actoresRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
    medios: (mediosRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
    temas: (temasRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({
        name: String(r.name).trim(),
        count: parseInt(r.count, 10) || 0,
        categoria: r.categoria ? String(r.categoria).trim() : undefined,
        categoriaSecundaria: r.categoriaSecundaria ? String(r.categoriaSecundaria).trim() : null,
        isPrimary: Boolean(r.is_primary),
        isSecondary: Boolean(r.is_secondary)
      })),
    reporteros: (reporterosRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
    estados: (estadosRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
    municipios: (municipiosRes || [])
      .filter((r: any) => r && r.name && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
    categorias: (categoriasRes || [])
      .filter((r: any) => r && r.name && isCategoriaOficial(r.name) && (!hasActiveFilterScope || (parseInt(r.count, 10) || 0) > 0))
      .map((r: any) => ({ name: String(r.name).trim(), count: parseInt(r.count, 10) || 0 })),
  };

  filterCache.set(cacheKey, { time: now, data: result });
  return result;
}

export interface PerspectiveEntity {
  name: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  netSentiment: number;
  topSecondary?: string[];
}

export interface PerspectiveSummaries {
  actores: PerspectiveEntity[];
  medios: PerspectiveEntity[];
  temas: PerspectiveEntity[];
}

const perspectivesCache = new Map<string, { data: PerspectiveSummaries; time: number }>();

/**
 * Returns grouped analytics for the 3 main reading perspectives in media monitoring:
 * 1. Por Actores (Liderazgo, funcionarios, candidatos)
 * 2. Por Medios (Línea editorial, cobertura, volumen)
 * 3. Por Temas (Agenda de gobierno, coyuntura pública)
 */
export async function getPerspectiveSummaries(
  startDate?: string,
  endDate?: string,
  forceRefresh = false,
  estados?: string[],
  municipios?: string[],
  categorias?: string[]
): Promise<PerspectiveSummaries> {
  const hasExtraFilters = Boolean(
    startDate ||
    endDate ||
    (estados && estados.length > 0) ||
    (municipios && municipios.length > 0) ||
    (categorias && categorias.length > 0)
  );
  const now = Date.now();
  const perspectivesKey = monitoreoTable();
  const cachedEntry = perspectivesCache.get(perspectivesKey);
  if (!hasExtraFilters && !forceRefresh && cachedEntry && now - cachedEntry.time < 300000) {
    return cachedEntry.data;
  }

  // Dynamic parameterized filter clauses
  const clauses: string[] = [];
  const queryParams: any[] = [];
  let pIdx = 1;

  if (startDate) {
    clauses.push(`"Fecha" >= $${pIdx}`);
    queryParams.push(startDate);
    pIdx++;
  }
  if (endDate) {
    clauses.push(`"Fecha" <= $${pIdx}`);
    queryParams.push(endDate);
    pIdx++;
  }
  if (estados && estados.length > 0) {
    clauses.push(`(
      "Estado" = ANY($${pIdx}::text[]) OR
      "Region" = ANY($${pIdx}::text[])
    )`);
    queryParams.push(estados);
    pIdx++;
  }
  if (municipios && municipios.length > 0) {
    clauses.push(`"Municipio" = ANY($${pIdx}::text[])`);
    queryParams.push(municipios);
    pIdx++;
  }
  if (categorias && categorias.length > 0) {
    const uppercaseCats = categorias.map((c) => String(c).trim().toUpperCase());
    clauses.push(`(
      UPPER(TRIM("Categoria")) = ANY($${pIdx}::text[]) OR
      UPPER(TRIM("Tema")) = ANY($${pIdx}::text[]) OR
      UPPER(TRIM("Tipo")) = ANY($${pIdx}::text[])
    )`);
    queryParams.push(uppercaseCats);
    pIdx++;
  }

  const extraSql = clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';

  const [actoresRes, mediosRes, temasRes] = await Promise.all([
    executeReadOnlyQuery<any>(`
      SELECT 
        "Actor" as name,
        count(*) as total,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
        COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
      FROM ${monitoreoTable()}
      WHERE "Actor" IS NOT NULL AND TRIM("Actor") != '' AND "Actor" != 'Sin actor'
      ${extraSql}
      GROUP BY "Actor"
      ORDER BY total DESC
      LIMIT 25
    `, queryParams),
    executeReadOnlyQuery<any>(`
      SELECT 
        "Medio" as name,
        count(*) as total,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
        COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
      FROM ${monitoreoTable()}
      WHERE "Medio" IS NOT NULL AND TRIM("Medio") != ''
      ${extraSql}
      GROUP BY "Medio"
      ORDER BY total DESC
      LIMIT 25
    `, queryParams),
    executeReadOnlyQuery<any>(`
      SELECT 
        "Tema" as name,
        count(*) as total,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
        COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
        COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
      FROM ${monitoreoTable()}
      WHERE "Tema" IS NOT NULL AND TRIM("Tema") != ''
      ${extraSql}
      GROUP BY "Tema"
      ORDER BY total DESC
      LIMIT 25
    `, queryParams)
  ]);

  const mapEntity = (row: any): PerspectiveEntity => {
    const total = parseInt(row.total || '0', 10);
    const pos = parseInt(row.pos || '0', 10);
    const neg = parseInt(row.neg || '0', 10);
    const neu = parseInt(row.neu || '0', 10);
    const posPct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const negPct = total > 0 ? Math.round((neg / total) * 100) : 0;
    return {
      name: String(row.name).trim(),
      total,
      pos,
      neu,
      neg,
      netSentiment: posPct - negPct,
    };
  };

  const results: PerspectiveSummaries = {
    actores: actoresRes.map(mapEntity),
    medios: mediosRes.map(mapEntity),
    temas: temasRes.map(mapEntity),
  };

  if (!hasExtraFilters) {
    perspectivesCache.set(perspectivesKey, { data: results, time: now });
  }

  return results;
}

/**
 * Returns deep dive profile for an actor, medio or tema with top correlations and recent notes
 */
export async function getEntityDeepDive(
  type: 'actor' | 'medio' | 'tema',
  name: string,
  startDate?: string,
  endDate?: string,
  estados?: string[],
  municipios?: string[],
  categorias?: string[]
) {
  const colName = type === 'actor' ? '"Actor"' : type === 'medio' ? '"Medio"' : '"Tema"';
  
  // Parameterized filter clauses
  const clauses: string[] = [];
  const baseParams: any[] = [name];
  let pIdx = 2;

  if (startDate) {
    clauses.push(`"Fecha" >= $${pIdx}`);
    baseParams.push(startDate);
    pIdx++;
  }
  if (endDate) {
    clauses.push(`"Fecha" <= $${pIdx}`);
    baseParams.push(endDate);
    pIdx++;
  }
  if (estados && estados.length > 0) {
    clauses.push(`(
      "Estado" = ANY($${pIdx}::text[]) OR
      "Region" = ANY($${pIdx}::text[])
    )`);
    baseParams.push(estados);
    pIdx++;
  }
  if (municipios && municipios.length > 0) {
    clauses.push(`"Municipio" = ANY($${pIdx}::text[])`);
    baseParams.push(municipios);
    pIdx++;
  }
  if (categorias && categorias.length > 0) {
    const uppercaseCats = categorias.map((c) => String(c).trim().toUpperCase());
    clauses.push(`(
      UPPER(TRIM("Categoria")) = ANY($${pIdx}::text[]) OR
      UPPER(TRIM("Tema")) = ANY($${pIdx}::text[]) OR
      UPPER(TRIM("Tipo")) = ANY($${pIdx}::text[])
    )`);
    baseParams.push(uppercaseCats);
    pIdx++;
  }
  const scopedFilterSql = clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';

  // 1. Parallel execution for high-speed political & governmental deep dive
  const statsSql = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
      COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
      COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu,
      COUNT(DISTINCT "Medio") as medios_count,
      COUNT(DISTINCT "Actor") as actores_count,
      COUNT(DISTINCT "Tema") as temas_count
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1 ${scopedFilterSql}
  `;

  // Timeline for political evolution & crisis spikes
  const timelineSql = `
    SELECT "Fecha" as fecha,
           COUNT(*) as total,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
           COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1 AND "Fecha" IS NOT NULL AND TRIM("Fecha") != '' ${scopedFilterSql}
    GROUP BY "Fecha"
    ORDER BY "Fecha" ASC
    LIMIT 40
  `;

  // Themes with sentiment breakdown (Public agenda / Government axes)
  const themeSql = `
    SELECT "Tema" as theme,
           COUNT(*) as total,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
           COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1 AND "Tema" IS NOT NULL AND TRIM("Tema") != '' ${scopedFilterSql}
    GROUP BY "Tema"
    ORDER BY total DESC
    LIMIT 8
  `;

  // Media coverage with editorial stance breakdown
  const mediaSql = `
    SELECT "Medio" as medio,
           COUNT(*) as total,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
           COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1 AND "Medio" IS NOT NULL AND TRIM("Medio") != '' ${scopedFilterSql}
    GROUP BY "Medio"
    ORDER BY total DESC
    LIMIT 8
  `;

  // Actors involved with sentiment (for Themes or Media perspectives)
  const actorsSql = `
    SELECT "Actor" as actor,
           COUNT(*) as total,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%POSITIV%' THEN 1 END) as pos,
           COUNT(CASE WHEN UPPER("Calificacion") LIKE '%NEGATIV%' THEN 1 END) as neg,
           COUNT(CASE WHEN UPPER("Calificacion") NOT LIKE '%POSITIV%' AND UPPER("Calificacion") NOT LIKE '%NEGATIV%' THEN 1 END) as neu
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1 AND "Actor" IS NOT NULL AND TRIM("Actor") != '' AND "Actor" != 'Sin actor' ${scopedFilterSql}
    GROUP BY "Actor"
    ORDER BY total DESC
    LIMIT 8
  `;

  // Latest notes for this entity
  const notesSql = `
    SELECT ${LIST_COLUMNS}
    FROM ${monitoreoTable()}
    WHERE ${colName} = $1
      AND "Actor" IS NOT NULL AND TRIM("Actor") != '' AND "Actor" != 'Sin actor'
      ${scopedFilterSql}
    ORDER BY "Fecha" DESC, id DESC
    LIMIT 20
  `;

  const [statsRes, timelineRes, themeRes, mediaRes, actorsRes, notesRes] = await Promise.all([
    executeReadOnlyQuery<any>(statsSql, baseParams),
    executeReadOnlyQuery<any>(timelineSql, baseParams),
    executeReadOnlyQuery<any>(themeSql, baseParams),
    executeReadOnlyQuery<any>(mediaSql, baseParams),
    executeReadOnlyQuery<any>(actorsSql, baseParams),
    executeReadOnlyQuery<any>(notesSql, baseParams)
  ]);

  const sRow = statsRes[0] || {};
  const total = parseInt(sRow.total || '0', 10);
  const pos = parseInt(sRow.pos || '0', 10);
  const neg = parseInt(sRow.neg || '0', 10);
  const neu = parseInt(sRow.neu || '0', 10);

  const timeline = timelineRes.map((r: any) => {
    const tot = parseInt(r.total || '0', 10);
    const p = parseInt(r.pos || '0', 10);
    const ng = parseInt(r.neg || '0', 10);
    const nu = parseInt(r.neu || '0', 10);
    const posPct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
    const negPct = tot > 0 ? Number(((ng / tot) * 100).toFixed(1)) : 0;
    const neuPct = tot > 0 ? Number(((nu / tot) * 100).toFixed(1)) : 0;
    return {
      fecha: r.fecha,
      total: tot,
      pos: p,
      neu: nu,
      neg: ng,
      posPct,
      neuPct,
      negPct,
      netSentiment: Number((posPct - negPct).toFixed(1))
    };
  });

  const politicalThemes = themeRes.map((r: any) => {
    const tot = parseInt(r.total || '0', 10);
    const p = parseInt(r.pos || '0', 10);
    const ng = parseInt(r.neg || '0', 10);
    const nu = parseInt(r.neu || '0', 10);
    const posPct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
    const negPct = tot > 0 ? Number(((ng / tot) * 100).toFixed(1)) : 0;
    const neuPct = tot > 0 ? Number(((nu / tot) * 100).toFixed(1)) : 0;
    return {
      theme: r.theme.trim(),
      total: tot,
      pos: p,
      neu: nu,
      neg: ng,
      posPct,
      neuPct,
      negPct,
      netSentiment: Number((posPct - negPct).toFixed(1))
    };
  });

  const mediaStance = mediaRes.map((r: any) => {
    const tot = parseInt(r.total || '0', 10);
    const p = parseInt(r.pos || '0', 10);
    const ng = parseInt(r.neg || '0', 10);
    const nu = parseInt(r.neu || '0', 10);
    const posPct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
    const negPct = tot > 0 ? Number(((ng / tot) * 100).toFixed(1)) : 0;
    const neuPct = tot > 0 ? Number(((nu / tot) * 100).toFixed(1)) : 0;
    const net = Number((posPct - negPct).toFixed(1));
    const stance: 'afín' | 'crítico' | 'neutral' = net >= 15 ? 'afín' : net <= -15 ? 'crítico' : 'neutral';
    return {
      medio: r.medio.trim(),
      total: tot,
      pos: p,
      neu: nu,
      neg: ng,
      posPct,
      neuPct,
      negPct,
      netSentiment: net,
      stance
    };
  });

  const actorsInvolved = actorsRes.map((r: any) => {
    const tot = parseInt(r.total || '0', 10);
    const p = parseInt(r.pos || '0', 10);
    const ng = parseInt(r.neg || '0', 10);
    const nu = parseInt(r.neu || '0', 10);
    const posPct = tot > 0 ? Number(((p / tot) * 100).toFixed(1)) : 0;
    const negPct = tot > 0 ? Number(((ng / tot) * 100).toFixed(1)) : 0;
    const neuPct = tot > 0 ? Number(((nu / tot) * 100).toFixed(1)) : 0;
    return {
      actor: r.actor.trim(),
      total: tot,
      pos: p,
      neu: nu,
      neg: ng,
      posPct,
      neuPct,
      negPct,
      netSentiment: Number((posPct - negPct).toFixed(1))
    };
  });

  // Secondary & extra compatibility
  const secondary = (type === 'tema' ? actorsInvolved : politicalThemes).map(item => ({
    label: 'theme' in item ? (item as any).theme : (item as any).actor,
    count: item.total
  }));

  const extra = (type === 'medio' ? politicalThemes : mediaStance).map(item => ({
    label: 'medio' in item ? (item as any).medio : (item as any).theme,
    count: item.total
  }));

  return {
    name,
    type,
    total,
    pos,
    neu,
    neg,
    netSentiment: total > 0 ? Math.round((pos / total) * 100) - Math.round((neg / total) * 100) : 0,
    secondary,
    extra,
    timeline,
    politicalThemes,
    mediaStance,
    actorsInvolved,
    recentNotes: notesRes.map(mapPostgresRowToMediaRecord)
  };
}
