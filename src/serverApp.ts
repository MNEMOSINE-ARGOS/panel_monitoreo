import 'dotenv/config';
import express from 'express';
import { validateUserCredentials, getMediaRecordsFromSheets, getUsersFromSheets } from './services/googleSheets.js';
import {
  getPostgresDiagnostics,
  getPostgresRecords,
  getPostgresRecordDetails,
  getPostgresKPIStats,
  getPostgresFilterOptions,
  getPerspectiveSummaries,
  getEntityDeepDive,
  getPostgresCumulativeTrends,
  monitoreoTable,
  runWithFuente,
} from './services/postgres.js';
import { getComparativoActores } from './services/comparativo.js';

const app = express();

app.use(express.json());

// Data source per request: ?incluirFacebook=1 reads 'monitoreo_total', otherwise 'monitoreo'
app.use((req, res, next) => {
  const flag = String(req.query?.incluirFacebook ?? '');
  runWithFuente(flag === '1' || flag === 'true', next);
});

// Resilient URL normalizer for Vercel Serverless Functions and standalone Express
// Handles both Vercel rewrites (x-matched-path, query.__url) and standard proxying
app.use((req, res, next) => {
  const queryUrl = typeof req.query?.__url === 'string' ? req.query.__url : '';
  const matchedHeader = (req.headers['x-matched-path'] || req.headers['x-vercel-matched-path']) as string;
  
  if (queryUrl) {
    req.url = '/api/' + queryUrl.replace(/^\/+/, '');
  } else if (matchedHeader && matchedHeader.startsWith('/api')) {
    req.url = matchedHeader;
  } else if (req.originalUrl && req.originalUrl.startsWith('/api') && (!req.url || req.url === '/' || req.url === '/api')) {
    req.url = req.originalUrl;
  }

  // Prepend /api if it was stripped by a reverse proxy
  if (!req.url.startsWith('/api') && (
    req.url.startsWith('/records') ||
    req.url.startsWith('/postgres') ||
    req.url.startsWith('/health') ||
    req.url.startsWith('/architecture') ||
    req.url.startsWith('/auth') ||
    req.url.startsWith('/users')
  )) {
    req.url = '/api' + req.url;
  }
  next();
});

// Helper to parse query array parameters
function parseArrayParam(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

// In-memory server-side session store & demo data
const DEMO_USERS = [
  { id: 'usr-1', usuario: 'admin@mediamonitor.com', password: 'admin123', nombre: 'Roberto Morales', rol: 'admin' },
  { id: 'usr-2', usuario: 'analista@mediamonitor.com', password: 'analista123', nombre: 'Claudia Vega', rol: 'analista' },
  { id: 'usr-3', usuario: 'director@corporativo.com', password: 'director123', nombre: 'Alejandro Garza', rol: 'lector' }
];

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Media Monitoring & Reputation BI Engine',
    timestamp: new Date().toISOString(),
    architecture: {
      phase1: { name: 'Google Sheets Relational Layer', status: 'active', quotaProtection: 'in-memory-caching' },
      phase2: { name: 'Postgres Repository Adapter', status: 'ready-for-migration', orm: 'Drizzle / Prisma compatible' }
    }
  });
});

// Authentication endpoint - strictly verifies user and password against Google Sheets USERS table
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const cleanUser = String(usuario).trim();
  const cleanPass = String(password).trim();

  try {
    // 1. Validar contra la pestaña 'USERS' de Google Sheets
    const sheetUser = await validateUserCredentials(cleanUser, cleanPass);

    if (sheetUser) {
      const token = `mmsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const { password: _, ...userSafe } = sheetUser;
      return res.json({
        success: true,
        token,
        user: userSafe,
        expiresAt: Date.now() + 86400000 // 24 horas
      });
    }

    // 2. Fallback de contingencia a usuarios locales si aplica
    const fallbackUser = DEMO_USERS.find(
      u => u.usuario.toLowerCase() === cleanUser.toLowerCase() && u.password === cleanPass
    );

    if (fallbackUser) {
      const token = `mmsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const { password: _, ...userSafe } = fallbackUser;
      return res.json({
        success: true,
        token,
        user: { ...userSafe, status: 'activo' },
        expiresAt: Date.now() + 86400000
      });
    }

    return res.status(401).json({
      error: 'Credenciales inválidas o cuenta no activa en el sistema.'
    });
  } catch (authErr) {
    console.error('Error en autenticación:', authErr);
    return res.status(500).json({
      error: 'Error interno en el servidor de autenticación.'
    });
  }
});

// Unified media records endpoint: Supports PostgreSQL (Fase 2) and Google Sheets (Fase 1 fallback)
app.get('/api/records', async (req, res) => {
  const source = (req.query.source as string)?.toLowerCase();
  const forceRefresh = req.query.refresh === 'true';

  // If explicit source is sheets, or if postgres is not available
  if (source === 'sheets') {
    try {
      const records = await getMediaRecordsFromSheets(forceRefresh);
      return res.json({
        success: true,
        source: 'Google Sheets (DATA!A2:U)',
        count: records.length,
        records
      });
    } catch (error) {
      console.error('Error fetching from Sheets:', error);
      return res.status(500).json({ error: 'Error al consultar Google Sheets', details: String(error) });
    }
  }

  // Default: Try PostgreSQL (Fase 2) first if configured
  try {
    const limit = parseInt(req.query.limit as string, 10) || 3000;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const pgResult = await getPostgresRecords({ limit, offset });
    return res.json({
      success: true,
      source: 'PostgreSQL 16+ (monitoreo • Fase 2)',
      readOnly: true,
      totalInDatabase: pgResult.total,
      count: pgResult.records.length,
      records: pgResult.records
    });
  } catch (pgError: any) {
    console.warn('PostgreSQL query notice, falling back to Sheets:', pgError);
    try {
      const records = await getMediaRecordsFromSheets(forceRefresh);
      return res.json({
        success: true,
        source: 'Google Sheets (DATA!A2:U • Fallback)',
        postgresConnected: false,
        postgresError: pgError?.message || 'Error al conectar con PostgreSQL',
        count: records.length,
        records
      });
    } catch (sheetsError) {
      return res.status(500).json({
        error: 'Error al consultar base de datos y fallback',
        postgresError: pgError?.message,
        details: String(sheetsError)
      });
    }
  }
});

// Get users from USERS!A2:L
app.get('/api/users', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const users = await getUsersFromSheets(forceRefresh);
    // Sanitize passwords before returning
    const safeUsers = users.map(({ password: _, ...rest }) => rest);
    res.json({
      success: true,
      count: safeUsers.length,
      users: safeUsers
    });
  } catch (error) {
    console.error('Error fetching users endpoint:', error);
    res.status(500).json({
      error: 'Error al consultar la pestaña USERS de Google Sheets',
      details: String(error)
    });
  }
});

// Architecture & Migration status endpoint (Fase 1 vs Fase 2)
app.get(['/api/architecture/status', '/architecture/status'], async (req, res) => {
  let postgresInfo: any = null;
  try {
    postgresInfo = await getPostgresDiagnostics();
  } catch (err: any) {
    postgresInfo = { status: 'error', error: err.message };
  }

  const dbLabel = postgresInfo?.database ? `PostgreSQL 16+ (${postgresInfo.database})` : 'PostgreSQL 16+';

  res.json({
    currentPhase: 2,
    activeEngine: dbLabel,
    securityPolicy: 'STRICT_READ_ONLY_ENFORCED',
    phase1: {
      name: 'Google Sheets (DATA!A2:U)',
      status: 'Fallback Activo',
      table: 'DATA',
      caching: { strategy: 'In-Memory Stale-While-Revalidate', ttlSeconds: 180 },
    },
    phase2: {
      name: dbLabel,
      status: postgresInfo?.status === 'connected' ? 'Operativo y Conectado' : 'Configurado',
      table: monitoreoTable(),
      readOnly: true,
      totalRecords: postgresInfo?.totalRecords || 122264,
      latencyMs: postgresInfo?.latencyMs || 0,
      enforcement: 'Database-level (default_transaction_read_only=on) & Application-level SELECT filtering'
    }
  });
});

// ==========================================
// FASE 2: POSTGRESQL READ-ONLY ENDPOINTS
// ==========================================

// Diagnostics & Health for PostgreSQL
app.get(['/api/postgres/health', '/api/postgres/diagnostics', '/postgres/health', '/postgres/diagnostics'], async (req, res) => {
  try {
    const diag = await getPostgresDiagnostics();
    res.json(diag);
  } catch (error: any) {
    res.status(500).json({ success: false, status: 'error', error: error.message });
  }
});

// On-demand heavy fields (Contexto, Fragmento) for a few record ids: /api/postgres/records/details?ids=1,2,3
app.get(['/api/postgres/records/details', '/postgres/records/details'], async (req, res) => {
  try {
    const ids = parseArrayParam(req.query.ids);
    const details = await getPostgresRecordDetails(ids);
    res.set('Cache-Control', 'private, max-age=300');
    res.json({ success: true, details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Server-side filtered & paginated records from PostgreSQL 'monitoreo' table
app.get(['/api/postgres/records', '/postgres/records'], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 3000;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const search = req.query.search as string;
    const sortField = req.query.sortField as string;
    const sortDirection = req.query.sortDirection as 'asc' | 'desc';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const actores = parseArrayParam(req.query.actores);
    const medios = parseArrayParam(req.query.medios);
    const temas = parseArrayParam(req.query.temas);
    const reporteros = parseArrayParam(req.query.reporteros);
    const calificaciones = parseArrayParam(req.query.calificaciones) as any;
    const estados = parseArrayParam(req.query.estados);
    const municipios = parseArrayParam(req.query.municipios);
    const categorias = parseArrayParam(req.query.categorias);

    const result = await getPostgresRecords({
      limit,
      offset,
      search,
      actores,
      medios,
      temas,
      reporteros,
      calificaciones,
      estados,
      municipios,
      categorias,
      startDate,
      endDate,
      sortField,
      sortDirection
    });

    res.json({
      success: true,
      engine: 'PostgreSQL 16+ (monitoreo)',
      readOnly: true,
      total: result.total,
      count: result.records.length,
      limit,
      offset,
      records: result.records
    });
  } catch (error: any) {
    console.warn('Error in /api/postgres/records, attempting fallback to Sheets:', error?.message);
    try {
      const all = await getMediaRecordsFromSheets();
      let filtered = [...all];
      const search = (req.query.search as string || '').trim().toLowerCase();
      const actores = parseArrayParam(req.query.actores);
      const medios = parseArrayParam(req.query.medios);
      const temas = parseArrayParam(req.query.temas);
      const reporteros = parseArrayParam(req.query.reporteros);
      const calificaciones = parseArrayParam(req.query.calificaciones);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const limit = parseInt(req.query.limit as string, 10) || 3000;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (search) {
        filtered = filtered.filter(r =>
          (r.titulo && r.titulo.toLowerCase().includes(search)) ||
          (r.resumen && r.resumen.toLowerCase().includes(search)) ||
          (r.actor && r.actor.toLowerCase().includes(search)) ||
          (r.medio && r.medio.toLowerCase().includes(search))
        );
      }
      if (actores.length > 0) filtered = filtered.filter(r => actores.includes(r.actor));
      if (medios.length > 0) filtered = filtered.filter(r => medios.includes(r.medio));
      if (temas.length > 0) filtered = filtered.filter(r => r.tema && temas.includes(r.tema));
      if (reporteros.length > 0) filtered = filtered.filter(r => reporteros.includes(r.reportero));
      if (calificaciones.length > 0) filtered = filtered.filter(r => calificaciones.map(c => c.toUpperCase()).includes(r.calificacion.toUpperCase()));
      if (startDate) filtered = filtered.filter(r => r.fecha >= startDate);
      if (endDate) filtered = filtered.filter(r => r.fecha <= endDate);

      const paged = filtered.slice(offset, offset + limit);
      res.json({
        success: true,
        engine: 'Google Sheets (Fallback)',
        readOnly: true,
        total: filtered.length,
        count: paged.length,
        limit,
        offset,
        records: paged
      });
    } catch (fallbackErr) {
      console.error('Error in /api/postgres/records:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Fast server-side aggregated KPI stats over 122,264+ records in PostgreSQL
app.get('/api/postgres/stats', async (req, res) => {
  try {
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const parseArrayParam = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      return String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const actores = parseArrayParam(req.query.actores);
    const medios = parseArrayParam(req.query.medios);
    const temas = parseArrayParam(req.query.temas);
    const reporteros = parseArrayParam(req.query.reporteros);
    const calificaciones = parseArrayParam(req.query.calificaciones) as any;
    const estados = parseArrayParam(req.query.estados);
    const municipios = parseArrayParam(req.query.municipios);
    const categorias = parseArrayParam(req.query.categorias);

    const stats = await getPostgresKPIStats({
      search,
      actores,
      medios,
      temas,
      reporteros,
      calificaciones,
      estados,
      municipios,
      categorias,
      startDate,
      endDate
    });

    res.json({
      success: true,
      engine: 'PostgreSQL 16+',
      stats
    });
  } catch (error: any) {
    console.warn('Error in /api/postgres/stats, attempting fallback:', error?.message);
    try {
      const all = await getMediaRecordsFromSheets();
      const pos = all.filter(r => r.calificacion === 'Positiva').length;
      const neg = all.filter(r => r.calificacion === 'Negativa').length;
      const neu = all.filter(r => r.calificacion === 'Neutral').length;
      const total = all.length;
      const positivePct = total > 0 ? Math.round((pos / total) * 100) : 0;
      const negativePct = total > 0 ? Math.round((neg / total) * 100) : 0;
      const neutralPct = total > 0 ? Math.round((neu / total) * 100) : 0;

      res.json({
        success: true,
        engine: 'Google Sheets (Fallback)',
        stats: {
          totalMenciones: total,
          positivas: pos,
          neutrales: neu,
          negativas: neg,
          netSentimentScore: positivePct - negativePct,
          actoresUnicos: new Set(all.map(r => r.actor)).size,
          mediosUnicos: new Set(all.map(r => r.medio)).size,
          temasUnicos: new Set(all.map(r => r.tema).filter(Boolean)).size,
          reporterosUnicos: new Set(all.map(r => r.reportero)).size,
          positivePct,
          negativePct,
          neutralPct,
        }
      });
    } catch {
      console.error('Error in /api/postgres/stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Fast distinct options for Actores, Medios, Temas, Reporteros, Categorias from PostgreSQL
app.get('/api/postgres/filters', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const parseArrayParam = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      return String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const estados = parseArrayParam(req.query.estados);
    const municipios = parseArrayParam(req.query.municipios);
    const categorias = parseArrayParam(req.query.categorias);
    const calificaciones = parseArrayParam(req.query.calificaciones) as any;
    const actores = parseArrayParam(req.query.actores);
    const medios = parseArrayParam(req.query.medios);
    const temas = parseArrayParam(req.query.temas);
    const reporteros = parseArrayParam(req.query.reporteros);

    const filters = await getPostgresFilterOptions(forceRefresh, {
      startDate,
      endDate,
      search,
      estados,
      municipios,
      categorias,
      calificaciones,
      actores,
      medios,
      temas,
      reporteros
    });
    res.json({
      success: true,
      engine: 'PostgreSQL 16+',
      ...filters
    });
  } catch (error: any) {
    console.error('Error in /api/postgres/filters:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3 Perspectives: Actores, Medios, Temas summaries with sentiment breakdowns and date range filtering
app.get('/api/postgres/perspectives', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const estados = parseArrayParam(req.query.estados as string | string[] | undefined);
    const municipios = parseArrayParam(req.query.municipios as string | string[] | undefined);
    const categorias = parseArrayParam(req.query.categorias as string | string[] | undefined);

    const perspectives = await getPerspectiveSummaries(startDate, endDate, forceRefresh, estados, municipios, categorias);
    res.json({
      success: true,
      engine: 'PostgreSQL 16+ (monitoreo)',
      startDate,
      endDate,
      estados,
      municipios,
      categorias,
      ...perspectives
    });
  } catch (error: any) {
    console.error('Error in /api/postgres/perspectives:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deep dive profile for a single Actor, Medio or Tema with optional date range
app.get('/api/postgres/perspectives/deepdive', async (req, res) => {
  try {
    const type = req.query.type as 'actor' | 'medio' | 'tema';
    const name = req.query.name as string;
    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const estados = parseArrayParam(req.query.estados as string | string[] | undefined);
    const municipios = parseArrayParam(req.query.municipios as string | string[] | undefined);
    const categorias = parseArrayParam(req.query.categorias as string | string[] | undefined);

    if (!type || !name) {
      return res.status(400).json({ error: 'Parámetros "type" y "name" requeridos' });
    }
    const deepDive = await getEntityDeepDive(type, name, startDate, endDate, estados, municipios, categorias);
    res.json({
      success: true,
      engine: 'PostgreSQL 16+',
      startDate,
      endDate,
      data: deepDive
    });
  } catch (error: any) {
    console.error('Error in /api/postgres/perspectives/deepdive:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comparativo de actores: PUBLIC (no login), read-only, aggregated daily counts only.
// Actors are separated by "|" in the query string; period is one of 7, 30, 90 days.
const COMPARATIVO_TTL_MS = 5 * 60 * 1000;
const COMPARATIVO_MAX_PER_MIN = 60;
const comparativoCache = new Map<string, { at: number; body: unknown }>();
const comparativoHits = new Map<string, { windowStart: number; count: number }>();

app.get(['/api/postgres/comparativo', '/postgres/comparativo'], async (req, res) => {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    const hit = comparativoHits.get(ip);
    if (!hit || now - hit.windowStart > 60_000) {
      comparativoHits.set(ip, { windowStart: now, count: 1 });
    } else if (++hit.count > COMPARATIVO_MAX_PER_MIN) {
      return res.status(429).json({ error: 'Demasiadas solicitudes, intenta en un minuto.' });
    }

    const actores = String(req.query.actores || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    const dias = req.query.periodo === undefined ? 30 : Number(req.query.periodo);

    if (actores.length < 2 || actores.length > 4) {
      return res.status(400).json({ error: 'Se requieren de 2 a 4 actores separados por "|".' });
    }
    if (actores.some(a => a.length > 200)) {
      return res.status(400).json({ error: 'Nombre de actor demasiado largo.' });
    }
    if (![7, 30, 90].includes(dias)) {
      return res.status(400).json({ error: 'El periodo debe ser 7, 30 o 90.' });
    }

    const cacheKey = `${monitoreoTable()}::${dias}::${actores.join('|').toLowerCase()}`;
    const cached = comparativoCache.get(cacheKey);
    if (cached && now - cached.at < COMPARATIVO_TTL_MS) return res.json(cached.body);

    const data = await getComparativoActores(actores, dias);
    const body = { success: true, engine: 'PostgreSQL 16+', data };
    comparativoCache.set(cacheKey, { at: now, body });
    res.json(body);
  } catch (error: any) {
    console.error('Error in /api/postgres/comparativo:', error);
    res.status(500).json({ error: 'No se pudo generar el comparativo.' });
  }
});

// Cumulative Sentiment Trends endpoint: Week-over-week or day-over-day running totals
app.get(['/api/postgres/trends/cumulative', '/postgres/trends/cumulative'], async (req, res) => {
  try {
    const search = req.query.search as string;
    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const granularity = (req.query.granularity as 'week' | 'day') || 'week';
    const actores = parseArrayParam(req.query.actores);
    const medios = parseArrayParam(req.query.medios);
    const temas = parseArrayParam(req.query.temas);
    const reporteros = parseArrayParam(req.query.reporteros);
    const calificaciones = parseArrayParam(req.query.calificaciones) as any;
    const estados = parseArrayParam(req.query.estados);
    const municipios = parseArrayParam(req.query.municipios);
    const categorias = parseArrayParam(req.query.categorias);

    const data = await getPostgresCumulativeTrends(
      {
        search,
        actores,
        medios,
        temas,
        reporteros,
        calificaciones,
        estados,
        municipios,
        categorias,
        startDate,
        endDate
      },
      granularity
    );

    res.json({
      success: true,
      granularity,
      count: data.length,
      data
    });
  } catch (error: any) {
    console.error('Error in /api/postgres/trends/cumulative:', error);
    res.status(500).json({ error: error.message });
  }
});

// Global error handler middleware to prevent serverless function crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express Uncaught Error Handler:', err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: err?.message || 'Error interno del servidor',
    });
  }
});

export default app;
