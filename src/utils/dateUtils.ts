import { DateRangePreset } from '../types';

/**
 * Returns today's calendar date in YYYY-MM-DD format respecting the
 * Mexico operational timezone (America/Mexico_City / America/Monterrey).
 * This prevents UTC day turnover from advancing to "tomorrow" in the afternoon/evening.
 */
export function getOperationalTodayDate(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Returns a past date offset by N days from the operational today date.
 */
export function getOperationalDateOffset(daysBack: number): string {
  const todayStr = getOperationalTodayDate();
  if (daysBack <= 0) return todayStr;
  const [y, m, d] = todayStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d - daysBack));
  return target.toISOString().split('T')[0];
}

/**
 * Computes { start, end } for a given date preset.
 */
export function getPresetDateRange(preset: DateRangePreset): { start: string; end: string } {
  const today = getOperationalTodayDate();
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case '7d':
      return { start: getOperationalDateOffset(7), end: today };
    case '30d':
      return { start: getOperationalDateOffset(30), end: today };
    case '60d':
      return { start: getOperationalDateOffset(60), end: today };
    case '90d':
      return { start: getOperationalDateOffset(90), end: today };
    case 'all':
      return { start: '', end: '' };
    default:
      return { start: getOperationalDateOffset(90), end: today };
  }
}
