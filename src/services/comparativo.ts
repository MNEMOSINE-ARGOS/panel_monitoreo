import { executeReadOnlyQuery, monitoreoTable } from './postgres.js';
import { getOperationalDateOffset } from '../utils/dateUtils.js';

// Comparativo de actores (página pública independiente). Server-only.

export interface ComparativoDayPoint {
  fecha: string;
  positivas: number;
  negativas: number;
  neutras: number;
  sinCalificar: number;
  totales: number;
  balance: number;
  balanceAcumulado: number;
}

export interface ComparativoBreakdownItem {
  nombre: string;
  positivas: number;
  negativas: number;
  neutras: number;
  totales: number;
}

export interface ComparativoNota {
  fecha: string;
  titulo: string;
  medio: string;
  reportero: string;
  tema: string;
  tipo: string;
  resumen: string;
  link: string | null;
}

export interface ComparativoActorSeries {
  actor: string;
  /** Últimas notas positivas y negativas del actor en el periodo (más recientes primero) */
  notasPositivas: ComparativoNota[];
  notasNegativas: ComparativoNota[];
  /** Temas / medios con más cobertura positiva y negativa del actor en el periodo */
  temasPositivos: ComparativoBreakdownItem[];
  temasNegativos: ComparativoBreakdownItem[];
  mediosTop: ComparativoBreakdownItem[];
  totales: { positivas: number; negativas: number; neutras: number; sinCalificar: number; totales: number; balance: number };
  serie: ComparativoDayPoint[];
}

export interface ComparativoResult {
  dias: number;
  startDate: string;
  endDate: string;
  actores: ComparativoActorSeries[];
  noEncontrados: Array<{ solicitado: string; sugerencias: string[] }>;
}

const ACCENTED = 'áéíóúüñÁÉÍÓÚÜÑ';
const PLAIN = 'aeiouunAEIOUUN';

/** Lowercase, no accents, collapsed spaces. Must mirror NORMALIZED_ACTOR_SQL. */
export function normalizeActorName(name: string): string {
  return name
    .replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, c => PLAIN[ACCENTED.indexOf(c)])
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const NORMALIZED_ACTOR_SQL =
  `LOWER(REGEXP_REPLACE(TRIM(TRANSLATE("Actor", '${ACCENTED}', '${PLAIN}')), '\\s+', ' ', 'g'))`;

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split('T')[0];
}

/**
 * Daily sentiment series for 2-4 actors over the last `dias` days (operational
 * timezone). Names are matched EXACTLY (ignoring case, accents and extra spaces),
 * never partially. Balance = neutras + (positivas - negativas), as in the Excel.
 * Neutras = explicitly neutral notes. Notes with a null/unknown Calificacion are
 * counted as `sinCalificar`: they add to totales but not to the balance.
 */
export async function getComparativoActores(nombres: string[], dias: number): Promise<ComparativoResult> {
  const endDate = getOperationalDateOffset(0);
  const startDate = getOperationalDateOffset(dias - 1);

  const requested = nombres.map(n => ({ solicitado: n, key: normalizeActorName(n) }));
  const keys = requested.map(r => r.key);

  const namesSql = `
    SELECT ${NORMALIZED_ACTOR_SQL} AS k, TRIM("Actor") AS nombre, COUNT(*)::int AS c
    FROM ${monitoreoTable()}
    WHERE "Actor" IS NOT NULL AND ${NORMALIZED_ACTOR_SQL} = ANY($1::text[])
    GROUP BY 1, 2
  `;
  const dailySql = `
    SELECT ${NORMALIZED_ACTOR_SQL} AS k,
      LEFT("Fecha", 10) AS fecha,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%positiv%')::int AS pos,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%negativ%')::int AS neg,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%neutr%')::int AS neu,
      COUNT(*)::int AS total
    FROM ${monitoreoTable()}
    WHERE "Actor" IS NOT NULL
      AND ${NORMALIZED_ACTOR_SQL} = ANY($1::text[])
      AND "Fecha" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND LEFT("Fecha", 10) BETWEEN $2 AND $3
    GROUP BY 1, 2
  `;

  const breakdownSql = (col: 'Tema' | 'Medio') => `
    SELECT ${NORMALIZED_ACTOR_SQL} AS k, TRIM("${col}") AS nombre,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%positiv%')::int AS pos,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%negativ%')::int AS neg,
      COUNT(*) FILTER (WHERE LOWER("Calificacion") LIKE '%neutr%')::int AS neu,
      COUNT(*)::int AS total
    FROM ${monitoreoTable()}
    WHERE "Actor" IS NOT NULL
      AND ${NORMALIZED_ACTOR_SQL} = ANY($1::text[])
      AND "${col}" IS NOT NULL AND TRIM("${col}") != ''
      AND "Fecha" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND LEFT("Fecha", 10) BETWEEN $2 AND $3
    GROUP BY 1, 2
  `;
  type BreakdownRow = { k: string; nombre: string; pos: number; neg: number; neu: number; total: number };

  const NOTAS_POR_TONO = 10;
  const notasSql = `
    SELECT k, cls, fecha, titulo, medio, reportero, tema, tipo, resumen, link FROM (
      SELECT x.*, ROW_NUMBER() OVER (PARTITION BY k, cls ORDER BY fecha DESC) AS rn FROM (
        SELECT ${NORMALIZED_ACTOR_SQL} AS k,
          CASE WHEN LOWER("Calificacion") LIKE '%positiv%' THEN 'pos'
               WHEN LOWER("Calificacion") LIKE '%negativ%' THEN 'neg' END AS cls,
          "Fecha" AS fecha,
          TRIM("Titulo") AS titulo,
          TRIM("Medio") AS medio,
          TRIM("Reportero") AS reportero,
          TRIM("Tema") AS tema,
          TRIM("Tipo") AS tipo,
          LEFT(TRIM("Resumen"), 400) AS resumen,
          TRIM("Link") AS link
        FROM ${monitoreoTable()}
        WHERE "Actor" IS NOT NULL
          AND ${NORMALIZED_ACTOR_SQL} = ANY($1::text[])
          AND "Fecha" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND LEFT("Fecha", 10) BETWEEN $2 AND $3
      ) x WHERE cls IS NOT NULL
    ) y WHERE rn <= ${NOTAS_POR_TONO}
    ORDER BY fecha DESC
  `;
  type NotaRow = {
    k: string; cls: 'pos' | 'neg'; fecha: string | null; titulo: string | null; medio: string | null;
    reportero: string | null; tema: string | null; tipo: string | null; resumen: string | null; link: string | null;
  };

  const [nameRows, dailyRows, temaRows, medioRows, notaRows] = await Promise.all([
    executeReadOnlyQuery<{ k: string; nombre: string; c: number }>(namesSql, [keys]),
    executeReadOnlyQuery<{ k: string; fecha: string; pos: number; neg: number; neu: number; total: number }>(
      dailySql,
      [keys, startDate, endDate]
    ),
    executeReadOnlyQuery<BreakdownRow>(breakdownSql('Tema'), [keys, startDate, endDate]),
    executeReadOnlyQuery<BreakdownRow>(breakdownSql('Medio'), [keys, startDate, endDate]),
    executeReadOnlyQuery<NotaRow>(notasSql, [keys, startDate, endDate]),
  ]);

  // Only http(s) links are exposed: the page is public and renders them as hrefs
  const safeLink = (l: string | null) => (l && /^https?:\/\//i.test(l) ? l : null);
  const toNota = (r: NotaRow): ComparativoNota => ({
    fecha: r.fecha ?? '',
    titulo: r.titulo || r.resumen || 'Sin título',
    medio: r.medio || '',
    reportero: r.reportero || '',
    tema: r.tema || '',
    tipo: r.tipo || '',
    resumen: r.resumen || '',
    link: safeLink(r.link),
  });
  const notasDe = (key: string, cls: 'pos' | 'neg') =>
    notaRows.filter(r => r.k === key && r.cls === cls).map(toNota);

  const TOP = 6;
  const toItem = (r: BreakdownRow): ComparativoBreakdownItem =>
    ({ nombre: r.nombre, positivas: r.pos, negativas: r.neg, neutras: r.neu, totales: r.total });
  const top = (rows: BreakdownRow[], key: string, by: (r: BreakdownRow) => number) =>
    rows.filter(r => r.k === key && by(r) > 0)
      .sort((a, b) => by(b) - by(a) || b.total - a.total)
      .slice(0, TOP).map(toItem);

  // Canonical display name = most frequent spelling in the database
  const canonical = new Map<string, string>();
  const best = new Map<string, number>();
  for (const r of nameRows) {
    if (r.c > (best.get(r.k) ?? -1)) {
      best.set(r.k, r.c);
      canonical.set(r.k, r.nombre);
    }
  }

  const days: string[] = [];
  for (let i = 0; i < dias; i++) days.push(addDays(startDate, i));

  const actores: ComparativoActorSeries[] = [];
  const noEncontrados: ComparativoResult['noEncontrados'] = [];

  const suggest = async (solicitado: string): Promise<string[]> => {
    // Suggestions share the longest word; the user copies the exact name into the URL
    const token = solicitado.split(/\s+/).sort((a, b) => b.length - a.length)[0] || '';
    if (token.length < 3) return [];
    const rows = await executeReadOnlyQuery<{ nombre: string }>(
      `SELECT TRIM("Actor") AS nombre FROM ${monitoreoTable()}
       WHERE "Actor" ILIKE $1 AND "Actor" != 'Sin actor'
       GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 5`,
      [`%${token.replace(/[%_\\]/g, '')}%`]
    );
    return rows.map(r => r.nombre);
  };

  const missing = requested.filter(r => !canonical.has(r.key));
  const suggestions = await Promise.all(missing.map(r => suggest(r.solicitado)));
  missing.forEach((r, i) => noEncontrados.push({ solicitado: r.solicitado, sugerencias: suggestions[i] }));

  for (const req of requested) {
    const actor = canonical.get(req.key);
    if (!actor) continue;
    if (actores.some(a => a.actor === actor)) continue; // duplicate in URL

    const byDay = new Map(dailyRows.filter(r => r.k === req.key).map(r => [r.fecha, r]));
    let acumulado = 0;
    const tot = { positivas: 0, negativas: 0, neutras: 0, sinCalificar: 0, totales: 0, balance: 0 };
    const serie = days.map(fecha => {
      const r = byDay.get(fecha);
      const positivas = r?.pos ?? 0;
      const negativas = r?.neg ?? 0;
      const totales = r?.total ?? 0;
      const neutras = r?.neu ?? 0;
      const sinCalificar = Math.max(0, totales - positivas - negativas - neutras);
      const balance = neutras + (positivas - negativas);
      acumulado += balance;
      tot.positivas += positivas;
      tot.negativas += negativas;
      tot.neutras += neutras;
      tot.sinCalificar += sinCalificar;
      tot.totales += totales;
      tot.balance += balance;
      return { fecha, positivas, negativas, neutras, sinCalificar, totales, balance, balanceAcumulado: acumulado };
    });
    actores.push({
      actor, totales: tot, serie,
      notasPositivas: notasDe(req.key, 'pos'),
      notasNegativas: notasDe(req.key, 'neg'),
      temasPositivos: top(temaRows, req.key, r => r.pos),
      temasNegativos: top(temaRows, req.key, r => r.neg),
      mediosTop: top(medioRows, req.key, r => r.total),
    });
  }

  return { dias, startDate, endDate, actores, noEncontrados };
}
