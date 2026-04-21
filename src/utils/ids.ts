function randomSuffix(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function newLogId(dateIso: string): string {
  return `${dateIso}-${randomSuffix(6)}`;
}

export function newLegId(): string {
  return `leg-${Date.now().toString(36)}-${randomSuffix(4)}`;
}
