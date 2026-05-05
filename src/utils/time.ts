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

/** Round to 1 decimal place, avoiding -0 and floating-point noise. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Format a number as decimal hours to 1 decimal place. Empty for null. */
export function formatHours(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return round1(n).toFixed(1);
}

/** Parse a user-entered decimal-hours string. Empty/invalid → null. */
export function parseHours(value: string): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}
