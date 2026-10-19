/**
 * Decoupled Data Repository Layer
 * Implements Repository Pattern for Phase 1 (Google Sheets) and Phase 2 (Postgres)
 */

import { INITIAL_RECORDS, INITIAL_USERS } from '../data/initialData';
import { DataSourceConfig, FilterState, MediaRecord, UserRecord, Calificacion } from '../types';
import { mapRowsToMediaRecords, mapRowsToUsers, parseCsvRows } from './sheetsParser';
import { getTemaMetadata, matchesCategory } from '../data/temasCatalogo';

export interface IMediaRepository {
  getRecords(filters?: Partial<FilterState>): Promise<MediaRecord[]>;
  queryRecords(filters?: Partial<FilterState>, limit?: number, offset?: number): Promise<{ records: MediaRecord[]; total: number }>;
  getKPIStats(filters?: Partial<FilterState>): Promise<any | null>;
  addRecord(record: Omit<MediaRecord, 'id'>): Promise<MediaRecord>;
  syncFromSource(force?: boolean): Promise<{ count: number; source: string; timestamp: string }>;
  getConfig(): DataSourceConfig;
  updateConfig(config: Partial<DataSourceConfig>): Promise<DataSourceConfig>;
}

export interface IAuthRepository {
  authenticate(usuario: string, password: string): Promise<UserRecord | null>;
  getUsers(): Promise<UserRecord[]>;
  addUser(user: Omit<UserRecord, 'id'>): Promise<UserRecord>;
}

// Global internal data-source switch: false (default) = table 'monitoreo', true = 'monitoreo_total' (incluye Facebook).
// Deliberately not persisted, so every session starts without Facebook.
let incluirFacebook = false;

function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (incluirFacebook) url += (url.includes('?') ? '&' : '?') + 'incluirFacebook=1';
  return fetch(url, init);
}

const STORAGE_KEY_CONFIG = 'mm_datasource_config';
const STORAGE_KEY_CUSTOM_RECORDS = 'mm_custom_records';
const STORAGE_KEY_CUSTOM_USERS = 'mm_custom_users';

class AppDataRepository implements IMediaRepository, IAuthRepository {
  private config: DataSourceConfig;
  private memoryRecords: MediaRecord[] = [];
  private memoryUsers: UserRecord[] = [];
  private cacheTimestamp: number = 0;
  private isSyncing: boolean = false;

  constructor() {
    this.config = this.loadConfig();
    this.memoryRecords = [...INITIAL_RECORDS];
    this.memoryUsers = [...INITIAL_USERS];
    this.purgeObsoleteStorage();
  }

  /**
   * Purges any huge local storage blobs that previously caused QuotaExceededError
   */
  private purgeObsoleteStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_RECORDS);
        localStorage.removeItem(STORAGE_KEY_CUSTOM_USERS);
        localStorage.setItem('mm_active_source', 'postgres');
      } catch (e) {
        // Ignore storage exceptions
      }
    }
  }

  private loadConfig(): DataSourceConfig {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.sourceType = 'postgres';
          parsed.postgresConfigured = true;
          parsed.newsSheetName = 'monitoreo';
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading saved config', e);
      }
    }

    return {
      sourceType: 'postgres',
      sheetId: '18GrnU-Q1Ci44zuiMj2fxjW169mHnKlrIRlfB-8PcPI0',
      newsSheetName: 'monitoreo',
      usersSheetName: 'USERS',
      cacheTtlSeconds: 60,
      lastSyncTime: new Date().toISOString(),
      status: 'connected',
      recordCount: 122264,
      userCount: INITIAL_USERS.length,
      postgresConfigured: true
    };
  }

  private saveConfig(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
      } catch (e) {
        console.warn('Error saving config', e);
      }
    }
  }

  private loadCustomStoredData(): void {
    if (typeof window !== 'undefined') {
      try {
        const storedSource = localStorage.getItem('mm_active_source');
        if (storedSource === 'postgres') {
          const storedRecords = localStorage.getItem(STORAGE_KEY_CUSTOM_RECORDS);
          if (storedRecords) {
            const parsed = JSON.parse(storedRecords);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.memoryRecords = parsed;
            }
          }
        } else {
          // Clear old sheets cache to force immediate PostgreSQL display
          localStorage.removeItem(STORAGE_KEY_CUSTOM_RECORDS);
          localStorage.setItem('mm_active_source', 'postgres');
        }

        const storedUsers = localStorage.getItem(STORAGE_KEY_CUSTOM_USERS);
        if (storedUsers) {
          const parsedU = JSON.parse(storedUsers);
          if (Array.isArray(parsedU) && parsedU.length > 0) {
            this.memoryUsers = parsedU;
          }
        }
      } catch (e) {
        console.warn('Error loading custom stored data', e);
      }
    }
  }

  public getConfig(): DataSourceConfig {
    return {
      ...this.config,
      recordCount: this.memoryRecords.length,
      userCount: this.memoryUsers.length
    };
  }

  public getIncluirFacebook(): boolean {
    return incluirFacebook;
  }

  /** Switches the global data source and drops everything cached from the previous one. */
  public setIncluirFacebook(value: boolean): void {
    if (incluirFacebook === value) return;
    incluirFacebook = value;
    this.memoryRecords = [];
    this.cacheTimestamp = 0;
    this.detailCache.clear();
  }

  public async updateConfig(newConfig: Partial<DataSourceConfig>): Promise<DataSourceConfig> {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.saveConfig();
    await this.syncFromSource(true);
    return this.getConfig();
  }

  public async syncFromSource(force = false): Promise<{ count: number; source: string; timestamp: string }> {
    const now = Date.now();
    const ttlMs = (this.config.cacheTtlSeconds || 180) * 1000;

    // Check in-memory cache to respect quota limits
    if (!force && now - this.cacheTimestamp < ttlMs && this.memoryRecords.length > 0) {
      return {
        count: this.memoryRecords.length,
        source: `Cache (${this.config.sourceType})`,
        timestamp: this.config.lastSyncTime || new Date().toISOString()
      };
    }

    if (this.isSyncing) {
      return {
        count: this.memoryRecords.length,
        source: 'Sync in progress',
        timestamp: this.config.lastSyncTime || new Date().toISOString()
      };
    }

    this.isSyncing = true;
    this.config.status = 'syncing';

    try {
      // 1. Prioritize PostgreSQL 16+ records from /api/records?source=postgres
      try {
        const apiResp = await apiFetch(`/api/records?source=postgres&limit=3000&refresh=${force}`);
        if (apiResp.ok) {
          const apiJson = await apiResp.json();
          const isRealPostgres = apiJson.source && !apiJson.source.toLowerCase().includes('fallback') && !apiJson.source.toLowerCase().includes('sheets');

          if (isRealPostgres && apiJson.records && Array.isArray(apiJson.records) && apiJson.records.length > 0) {
            this.memoryRecords = apiJson.records;
            this.config.sourceType = 'postgres';
            this.config.postgresConfigured = true;
            this.config.status = 'connected';
            this.config.recordCount = apiJson.totalInDatabase || 122264;
            this.cacheTimestamp = now;
            this.config.lastSyncTime = new Date().toISOString();
            this.saveConfig();
            this.isSyncing = false;
            return {
              count: apiJson.totalInDatabase || this.memoryRecords.length,
              source: `PostgreSQL 16+ (monitoreo • ${apiJson.totalInDatabase?.toLocaleString() || '122,264'} notas)`,
              timestamp: this.config.lastSyncTime
            };
          } else if (apiJson.postgresError) {
            this.config.errorMessage = `PostgreSQL no respondió: ${apiJson.postgresError}`;
            console.warn('PostgreSQL returned error notice, using Sheets fallback:', apiJson.postgresError);
          }
        }
      } catch (apiErr: any) {
        this.config.errorMessage = `Error al consultar /api/records: ${apiErr?.message || String(apiErr)}`;
        console.warn('PostgreSQL records endpoint sync failed:', apiErr);
      }

      if (this.config.sourceType === 'sheets' && this.config.sheetId) {
        // Fallback: Open range CSV export without limit parameter to bring all records
        const sheetParam = `&sheet=${encodeURIComponent(this.config.newsSheetName || 'DATA')}`;
        const newsUrl = `https://docs.google.com/spreadsheets/d/${this.config.sheetId}/gviz/tq?tqx=out:csv${sheetParam}`;
        const usersUrl = `https://docs.google.com/spreadsheets/d/${this.config.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.usersSheetName || 'USERS')}`;

        const fetchWithTimeout = async (url: string, timeoutMs = 12000) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const resp = await apiFetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            return resp;
          } catch (err) {
            clearTimeout(timeout);
            throw err;
          }
        };

        let newsFetched = false;
        try {
          let newsResp = await fetchWithTimeout(newsUrl);
          if (!newsResp.ok) {
            const fallbackUrl = `https://docs.google.com/spreadsheets/d/${this.config.sheetId}/gviz/tq?tqx=out:csv`;
            newsResp = await fetchWithTimeout(fallbackUrl);
          }
          if (newsResp.ok) {
            const csv = await newsResp.text();
            const rows = parseCsvRows(csv);
            const parsedRecords = mapRowsToMediaRecords(rows);
            if (parsedRecords.length > 0) {
              this.memoryRecords = parsedRecords;
              newsFetched = true;
            }
          }
        } catch (fetchErr) {
          console.warn('Sheets news sync notice: Using resilient local repository buffer', fetchErr);
        }

        try {
          const usersResp = await fetchWithTimeout(usersUrl);
          if (usersResp.ok) {
            const csv = await usersResp.text();
            const rows = parseCsvRows(csv);
            const parsedUsers = mapRowsToUsers(rows);
            if (parsedUsers.length > 0) {
              const existingIds = new Set(parsedUsers.map(u => u.usuario.toLowerCase()));
              const combined = [...parsedUsers];
              for (const defUser of INITIAL_USERS) {
                if (!existingIds.has(defUser.usuario.toLowerCase())) {
                  combined.push(defUser);
                }
              }
              this.memoryUsers = combined;
            }
          }
        } catch (usersErr) {
          console.warn('Sheets users sync notice: Retaining authenticated users table buffer', usersErr);
        }

        this.config.status = newsFetched ? 'connected' : 'fallback';
      } else {
        this.config.status = 'connected';
      }

      this.cacheTimestamp = now;
      this.config.lastSyncTime = new Date().toISOString();
      this.saveConfig();

      return {
        count: this.memoryRecords.length,
        source: this.config.status === 'fallback' ? 'Google Sheets (Buffer con Respaldo)' : 'Google Sheets en Vivo',
        timestamp: this.config.lastSyncTime
      };
    } catch (err: unknown) {
      console.error('Error during data repository sync:', err);
      this.config.status = 'error';
      this.config.errorMessage = err instanceof Error ? err.message : 'Error desconocido al sincronizar';
      return {
        count: this.memoryRecords.length,
        source: 'Error (Buffer activo)',
        timestamp: this.config.lastSyncTime || new Date().toISOString()
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Queries records directly from PostgreSQL when connected, returning matches and total
   */
  public async queryRecords(
    filters?: Partial<FilterState>,
    limit = 3000,
    offset = 0
  ): Promise<{ records: MediaRecord[]; total: number }> {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
      if (filters?.actores && filters.actores.length > 0) params.set('actores', filters.actores.join(','));
      if (filters?.medios && filters.medios.length > 0) params.set('medios', filters.medios.join(','));
      if (filters?.temas && filters.temas.length > 0) params.set('temas', filters.temas.join(','));
      if (filters?.reporteros && filters.reporteros.length > 0) params.set('reporteros', filters.reporteros.join(','));
      if (filters?.calificaciones && filters.calificaciones.length > 0) params.set('calificaciones', filters.calificaciones.join(','));
      if (filters?.estados && filters.estados.length > 0) params.set('estados', filters.estados.join(','));
      if (filters?.municipios && filters.municipios.length > 0) params.set('municipios', filters.municipios.join(','));
      if (filters?.categorias && filters.categorias.length > 0) params.set('categorias', filters.categorias.join(','));
      if (filters?.dateRange?.start) params.set('startDate', filters.dateRange.start);
      if (filters?.dateRange?.end) params.set('endDate', filters.dateRange.end);
      if (filters?.sortField) params.set('sortField', String(filters.sortField));
      if (filters?.sortDirection) params.set('sortDirection', filters.sortDirection);

      const resp = await apiFetch(`/api/postgres/records?${params.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.records && Array.isArray(json.records)) {
          return { records: json.records, total: json.total ?? json.records.length };
        }
      }
    } catch (e) {
      console.warn('Postgres queryRecords failed, falling back to local memory records:', e);
    }

    const localList = await this.getRecords(filters);
    return { records: localList.slice(offset, offset + limit), total: localList.length };
  }

  private detailCache = new Map<string, { contexto?: string; fragmento?: string }>();

  /**
   * Loads Contexto/Fragmento on demand (the record listing omits them to keep payloads small)
   */
  async getRecordDetails(ids: string[]): Promise<Record<string, { contexto?: string; fragmento?: string }>> {
    const out: Record<string, { contexto?: string; fragmento?: string }> = {};
    const missing: string[] = [];
    for (const id of ids) {
      const hit = this.detailCache.get(id);
      if (hit) out[id] = hit;
      else missing.push(id);
    }

    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100);
      try {
        const resp = await apiFetch(`/api/postgres/records/details?ids=${encodeURIComponent(chunk.join(','))}`);
        if (!resp.ok) continue;
        const json = await resp.json();
        for (const [id, d] of Object.entries(json.details || {})) {
          this.detailCache.set(id, d as any);
          out[id] = d as any;
        }
      } catch (e) {
        console.warn('getRecordDetails failed:', e);
      }
    }
    return out;
  }

  /**
   * Fetches exact KPI metrics from PostgreSQL engine for any active filter set
   */
  public async getKPIStats(filters?: Partial<FilterState>): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
      if (filters?.actores && filters.actores.length > 0) params.set('actores', filters.actores.join(','));
      if (filters?.medios && filters.medios.length > 0) params.set('medios', filters.medios.join(','));
      if (filters?.temas && filters.temas.length > 0) params.set('temas', filters.temas.join(','));
      if (filters?.reporteros && filters.reporteros.length > 0) params.set('reporteros', filters.reporteros.join(','));
      if (filters?.calificaciones && filters.calificaciones.length > 0) params.set('calificaciones', filters.calificaciones.join(','));
      if (filters?.estados && filters.estados.length > 0) params.set('estados', filters.estados.join(','));
      if (filters?.municipios && filters.municipios.length > 0) params.set('municipios', filters.municipios.join(','));
      if (filters?.categorias && filters.categorias.length > 0) params.set('categorias', filters.categorias.join(','));
      if (filters?.dateRange?.start) params.set('startDate', filters.dateRange.start);
      if (filters?.dateRange?.end) params.set('endDate', filters.dateRange.end);

      const resp = await apiFetch(`/api/postgres/stats?${params.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        return json.stats;
      }
    } catch (e) {
      console.warn('Postgres getKPIStats failed:', e);
    }
    return null;
  }

  public async getRecords(filters?: Partial<FilterState>): Promise<MediaRecord[]> {
    let result = [...this.memoryRecords];

    if (!filters) return result;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(r =>
        r.actor.toLowerCase().includes(q) ||
        r.medio.toLowerCase().includes(q) ||
        r.resumen.toLowerCase().includes(q) ||
        r.reportero.toLowerCase().includes(q) ||
        (r.municipio && r.municipio.toLowerCase().includes(q)) ||
        (r.estado && r.estado.toLowerCase().includes(q))
      );
    }

    if (filters.actores && filters.actores.length > 0) {
      result = result.filter(r => filters.actores!.includes(r.actor));
    }

    if (filters.medios && filters.medios.length > 0) {
      result = result.filter(r => filters.medios!.includes(r.medio));
    }

    if (filters.temas && filters.temas.length > 0) {
      result = result.filter(r => filters.temas!.includes(r.tema || r.categoria || ''));
    }

    if (filters.calificaciones && filters.calificaciones.length > 0) {
      result = result.filter(r => filters.calificaciones!.includes(r.calificacion));
    }

    if (filters.reporteros && filters.reporteros.length > 0) {
      result = result.filter(r => filters.reporteros!.includes(r.reportero));
    }

    if (filters.estados && filters.estados.length > 0) {
      result = result.filter(r => filters.estados!.includes(r.estado || r.region || ''));
    }

    if (filters.municipios && filters.municipios.length > 0) {
      result = result.filter(r => filters.municipios!.includes(r.municipio || ''));
    }

    if (filters.categorias && filters.categorias.length > 0) {
      result = result.filter(r => {
        if (r.categoria && filters.categorias!.includes(r.categoria)) return true;
        if (r.categoriaSecundaria && filters.categorias!.includes(r.categoriaSecundaria)) return true;
        const meta = getTemaMetadata(r.tema || '');
        if (meta) {
          const match = matchesCategory(meta, filters.categorias!);
          if (match.matches) return true;
        }
        return false;
      });
    }

    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      if (start) {
        result = result.filter(r => r.fecha >= start);
      }
      if (end) {
        result = result.filter(r => r.fecha <= end);
      }
    }

    if (filters.sortField) {
      const field = filters.sortField;
      const dir = filters.sortDirection === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    return result;
  }

  public async fetchPostgresFilters(
    force = false,
    filterContext?: {
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
  ): Promise<any> {
    try {
      const params = new URLSearchParams({ refresh: String(force) });
      if (filterContext?.startDate) params.set('startDate', filterContext.startDate);
      if (filterContext?.endDate) params.set('endDate', filterContext.endDate);
      if (filterContext?.search) params.set('search', filterContext.search);
      if (filterContext?.categorias && filterContext.categorias.length > 0) {
        params.set('categorias', filterContext.categorias.join(','));
      }
      if (filterContext?.estados && filterContext.estados.length > 0) {
        params.set('estados', filterContext.estados.join(','));
      }
      if (filterContext?.municipios && filterContext.municipios.length > 0) {
        params.set('municipios', filterContext.municipios.join(','));
      }
      if (filterContext?.calificaciones && filterContext.calificaciones.length > 0) {
        params.set('calificaciones', filterContext.calificaciones.join(','));
      }
      if (filterContext?.actores && filterContext.actores.length > 0) {
        params.set('actores', filterContext.actores.join(','));
      }
      if (filterContext?.medios && filterContext.medios.length > 0) {
        params.set('medios', filterContext.medios.join(','));
      }
      if (filterContext?.temas && filterContext.temas.length > 0) {
        params.set('temas', filterContext.temas.join(','));
      }
      if (filterContext?.reporteros && filterContext.reporteros.length > 0) {
        params.set('reporteros', filterContext.reporteros.join(','));
      }
      const resp = await apiFetch(`/api/postgres/filters?${params.toString()}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('Error fetching postgres filters:', e);
    }
    return null;
  }

  public async fetchPerspectives(
    force = false,
    startDate?: string,
    endDate?: string,
    estados?: string[],
    municipios?: string[],
    categorias?: string[]
  ): Promise<any> {
    try {
      const params = new URLSearchParams({ refresh: String(force) });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (estados && estados.length > 0) params.append('estados', estados.join(','));
      if (municipios && municipios.length > 0) params.append('municipios', municipios.join(','));
      if (categorias && categorias.length > 0) params.append('categorias', categorias.join(','));
      const resp = await apiFetch(`/api/postgres/perspectives?${params.toString()}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('Error fetching perspectives:', e);
    }
    return null;
  }

  public async fetchEntityDeepDive(
    type: 'actor' | 'medio' | 'tema',
    name: string,
    startDate?: string,
    endDate?: string,
    estados?: string[],
    municipios?: string[],
    categorias?: string[]
  ): Promise<any> {
    try {
      const params = new URLSearchParams({ type, name });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (estados && estados.length > 0) params.append('estados', estados.join(','));
      if (municipios && municipios.length > 0) params.append('municipios', municipios.join(','));
      if (categorias && categorias.length > 0) params.append('categorias', categorias.join(','));
      const resp = await apiFetch(`/api/postgres/perspectives/deepdive?${params.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        return json.data;
      }
    } catch (e) {
      console.warn('Error fetching deepdive:', e);
    }
    return null;
  }

  public async fetchCumulativeTrends(
    filters?: Partial<FilterState>,
    granularity: 'week' | 'day' = 'week'
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('granularity', granularity);
      if (filters?.search && filters.search.trim()) params.set('search', filters.search.trim());
      if (filters?.actores && filters.actores.length > 0) params.set('actores', filters.actores.join(','));
      if (filters?.medios && filters.medios.length > 0) params.set('medios', filters.medios.join(','));
      if (filters?.temas && filters.temas.length > 0) params.set('temas', filters.temas.join(','));
      if (filters?.reporteros && filters.reporteros.length > 0) params.set('reporteros', filters.reporteros.join(','));
      if (filters?.calificaciones && filters.calificaciones.length > 0) params.set('calificaciones', filters.calificaciones.join(','));
      if (filters?.estados && filters.estados.length > 0) params.set('estados', filters.estados.join(','));
      if (filters?.municipios && filters.municipios.length > 0) params.set('municipios', filters.municipios.join(','));
      if (filters?.categorias && filters.categorias.length > 0) params.set('categorias', filters.categorias.join(','));
      if (filters?.dateRange?.start) params.set('startDate', filters.dateRange.start);
      if (filters?.dateRange?.end) params.set('endDate', filters.dateRange.end);

      const resp = await apiFetch(`/api/postgres/trends/cumulative?${params.toString()}`);
      if (resp.ok) {
        const json = await resp.json();
        return json.data || [];
      }
    } catch (e) {
      console.warn('Error fetching cumulative trends from postgres:', e);
    }
    return [];
  }

  public async getPostgresDiagnostics(): Promise<any> {
    try {
      const resp = await apiFetch('/api/postgres/diagnostics');
      if (resp.ok) {
        return await resp.json();
      }
      const errText = await resp.text();
      return { status: 'error', success: false, error: `HTTP ${resp.status}: ${errText}` };
    } catch (e: any) {
      console.warn('Error fetching diagnostics:', e);
      return { status: 'error', success: false, error: e?.message || 'Error de red al consultar diagnóstico' };
    }
  }

  public async addRecord(record: Omit<MediaRecord, 'id'>): Promise<MediaRecord> {
    throw new Error('Base de datos en modo SOLO LECTURA. No se permiten inserciones ni modificaciones.');
  }

  public async authenticate(usuario: string, password: string): Promise<UserRecord | null> {
    const cleanUser = usuario.trim().toLowerCase();
    const cleanPass = password.trim();

    const matched = this.memoryUsers.find(
      u => u.usuario.trim().toLowerCase() === cleanUser && u.password === cleanPass
    );

    if (matched) {
      return matched;
    }
    return null;
  }

  public async getUsers(): Promise<UserRecord[]> {
    return [...this.memoryUsers];
  }

  public async addUser(user: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    const newUser: UserRecord = {
      ...user,
      id: `usr-${Date.now()}`
    };
    this.memoryUsers.push(newUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_USERS, JSON.stringify(this.memoryUsers));
    }
    return newUser;
  }
}

export const repository = new AppDataRepository();
