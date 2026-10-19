/**
 * Media Monitoring & Reputation BI - Global Types
 * Modelos de datos para el ecosistema Next.js (App Router) & Google Sheets
 */

// Calificación reputacional de cada mención
export type Calificacion = 'Positiva' | 'Neutral' | 'Negativa';

// Roles admitidos en el sistema cerrado
export type UserRole = 'admin' | 'analista' | 'lector';

// Estado de la cuenta de usuario
export type UserStatus = 'activo' | 'inactivo' | 'bloqueado';

/**
 * 1. Pestaña 'USERS' de Google Sheets
 * Mapeo estricto de columnas:
 * Col A: id_
 * Col B: usuario
 * Col C: Password
 * Col D: Nombre
 * Col E: Rol
 * Col F: Status ('activo' | 'inactivo' | 'bloqueado')
 * Col G: email_alterno
 * Col H: Departamento
 * Col I: fecha_creacion
 * Col J: ultimo_acceso
 * Col K: [VACÍA - IGNORADA]
 * Col L: Id (Identificador único global del usuario que enlaza con Col C 'Usuario' de DATA)
 */
export interface User {
  id: string;              // Columna L ('Id'): Identificador único global
  id_?: string;            // Columna A ('id_')
  usuario: string;         // Columna B ('usuario')
  password?: string;       // Columna C ('Password') - omitido en respuestas públicas
  nombre: string;          // Columna D ('Nombre')
  rol: UserRole;           // Columna E ('Rol')
  status?: UserStatus;     // Columna F ('Status')
  email_alterno?: string;  // Columna G ('email_alterno')
  departamento?: string;   // Columna H ('Departamento')
  fecha_creacion?: string; // Columna I ('fecha_creacion')
  ultimo_acceso?: string;  // Columna J ('ultimo_acceso')
  avatar?: string;
}

// Alias para compatibilidad
export type UserRecord = User;

// Sesión de usuario autenticado
export interface UserSession {
  user: Omit<User, 'password'>;
  token: string;
  expiresAt: number;
}

export type AuthSession = UserSession;

/**
 * 2. Pestaña 'DATA' de Google Sheets
 * Mapeo de columnas desde Col A (id_) hasta Col U (updatedAt):
 * Col A: id_
 * Col B: Fecha (YYYY-MM-DD)
 * Col C: Usuario (Id único del usuario que capturó la nota, FK hacia Col L de USERS)
 * Col D: Titulo
 * Col E: Dependencia
 * Col F: Region
 * Col G: Calificacion ('Positiva' | 'Neutral' | 'Negativa')
 * Col H: Medio
 * Col I: Reportero
 * Col J: Fuente
 * Col K: Actor
 * Col L: Tema
 * Col M: Tipo
 * Col N: Link (URL de la publicación)
 * Col O: Resumen
 * Col P: Contexto
 * Col Q: Fragmento
 * Col R: Personajes
 * Col S: Instituciones
 * Col T: Municipio
 * Col U: Estado / updatedAt
 */
export interface MediaRecord {
  id: string;              // Identificador unificado para React (mapeado de id_)
  id_?: string;            // Columna A: id_
  fecha: string;           // Columna B: Fecha
  usuarioId?: string;      // Columna C: Usuario (FK a Col L de USERS)
  usuario?: string;        // Columna C: Usuario (Compatibilidad directa con nombre de columna DB)
  titulo?: string;         // Columna D: Titulo
  dependencia?: string;    // Columna E: Dependencia
  region?: string;         // Columna F: Region
  calificacion: Calificacion; // Columna G: Calificacion
  medio: string;           // Columna H: Medio
  reportero: string;       // Columna I: Reportero
  fuente?: string;         // Columna J: Fuente
  actor: string;           // Columna K: Actor
  tema?: string;           // Columna L: Tema
  tipo?: string;           // Columna M: Tipo
  link: string;            // Columna N: Link
  resumen: string;         // Columna O: Resumen
  contexto?: string;       // Columna P: Contexto
  fragmento?: string;      // Columna Q: Fragmento
  personajes?: string;     // Columna R: Personajes
  instituciones?: string;  // Columna S: Instituciones
  municipio?: string;      // Columna T: Municipio
  estado?: string;         // Columna U: Estado / updatedAt
  categoria?: string;
  categoriaSecundaria?: string;
  alcanceEstimado?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Estado de filtros del Dashboard Ejecutivo
export type DateRangePreset = 'all' | 'today' | '7d' | '30d' | '60d' | '90d' | 'custom';

export interface FilterState {
  search: string;
  actores: string[];
  medios: string[];
  temas: string[];
  calificaciones: Calificacion[];
  reporteros: string[];
  estados?: string[];
  municipios?: string[];
  categorias?: string[];
  dateRange: {
    start: string;
    end: string;
    preset: DateRangePreset;
  };
  sortField: keyof MediaRecord;
  sortDirection: 'asc' | 'desc';
}

export interface FilterOptionItem {
  name: string;
  count: number;
  categoria?: string;
  categoriaSecundaria?: string | null;
  isPrimary?: boolean;
  isSecondary?: boolean;
}

export interface FilterOptions {
  actores: FilterOptionItem[];
  medios: FilterOptionItem[];
  temas: FilterOptionItem[];
  reporteros: FilterOptionItem[];
  estados?: FilterOptionItem[];
  municipios?: FilterOptionItem[];
  categorias?: FilterOptionItem[];
}

// Estadísticas e Indicadores Clave de Desempeño (KPIs)
export interface KPIStats {
  totalMenciones: number;
  positivas: number;
  neutrales: number;
  negativas: number;
  netSentimentScore: number; // Net Sentiment Score = % Positivas - % Negativas
  actoresUnicos: number;
  mediosUnicos: number;
  temasUnicos?: number;
  reporterosUnicos: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}

// Configuración de sincronización de datos
export interface DataSourceConfig {
  sourceType: 'sheets' | 'postgres' | 'hybrid';
  sheetId: string;
  apiKey?: string;
  newsSheetName: string;
  usersSheetName: string;
  publicCsvUrl?: string;
  cacheTtlSeconds: number;
  lastSyncTime: string | null;
  status: 'connected' | 'syncing' | 'error' | 'fallback';
  recordCount: number;
  userCount: number;
  errorMessage?: string;
  postgresConfigured: boolean;
}

// Modelos de Inteligencia Política y Análisis Gubernamental
export interface PoliticalTimelinePoint {
  fecha: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  posPct: number;
  neuPct: number;
  negPct: number;
  netSentiment: number;
}

export interface PoliticalThemeBreakdown {
  theme: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  posPct: number;
  neuPct: number;
  negPct: number;
  netSentiment: number;
}

export interface MediaStanceBreakdown {
  medio: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  posPct: number;
  neuPct: number;
  negPct: number;
  netSentiment: number;
  stance: 'afín' | 'crítico' | 'neutral';
}

export interface ActorInvolvementBreakdown {
  actor: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  posPct: number;
  neuPct: number;
  negPct: number;
  netSentiment: number;
}

export interface PerspectiveDeepDive {
  name: string;
  type: 'actor' | 'medio' | 'tema';
  total: number;
  pos: number;
  neu: number;
  neg: number;
  netSentiment: number;
  secondary: Array<{ label: string; count: number }>;
  extra: Array<{ label: string; count: number }>;
  timeline: PoliticalTimelinePoint[];
  politicalThemes: PoliticalThemeBreakdown[];
  mediaStance: MediaStanceBreakdown[];
  actorsInvolved: ActorInvolvementBreakdown[];
  recentNotes: MediaRecord[];
}

