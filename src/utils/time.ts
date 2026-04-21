const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function timeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function minutesToTime(total: number): string {
  const normalised = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalised / 60);
  const m = normalised % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns the duration between two 24h HH:mm strings, rolling forward past
 * midnight if arrival is earlier than departure. Empty string if either is
 * invalid.
 */
export function durationBetween(dep: string, arr: string): string {
  const depMin = timeToMinutes(dep);
  const arrMin = timeToMinutes(arr);
  if (depMin == null || arrMin == null) return '';
  let diff = arrMin - depMin;
  if (diff < 0) diff += 24 * 60;
  return minutesToTime(diff);
}

export function sumDurations(values: string[]): string {
  let total = 0;
  for (const v of values) {
    const m = timeToMinutes(v);
    if (m != null) total += m;
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateFriendly(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}
