import {
  getLog,
  saveLeg,
  saveLog
} from '../db/database';
import type { Leg, Log, LogBackup, Profile } from '../types';
import { sanitizeFilename, saveBlob } from './download';
import { newLegId, newLogId } from './ids';
import { todayIso } from './time';

export async function downloadBackup(args: {
  log: Log;
  legs: Leg[];
  profile: Profile | null;
}): Promise<void> {
  const payload: LogBackup = {
    format: 'pilot-logbook-backup',
    version: 1,
    exportedAt: Date.now(),
    profile: args.profile,
    log: args.log,
    legs: args.legs
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${sanitizeFilename(args.log.title)}-backup.json`;
  saveBlob(blob, filename);
}

export async function importBackupFile(text: string): Promise<{ log: Log; legs: Leg[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (!isBackup(parsed)) {
    throw new Error('Not a recognised pilot logbook backup file.');
  }

  const originalId = parsed.log.id;
  const existing = await getLog(originalId);
  const date = parsed.log.startDate || todayIso();
  const newId = existing ? newLogId(date) : originalId;
  const now = Date.now();

  const restoredLog: Log = {
    ...parsed.log,
    id: newId,
    title: existing ? `${parsed.log.title} (imported)` : parsed.log.title,
    updatedAt: now
  };
  await saveLog(restoredLog);

  const restoredLegs: Leg[] = parsed.legs.map((leg, i) => ({
    ...leg,
    id: existing ? newLegId() : leg.id,
    logId: newId,
    order: i,
    updatedAt: now
  }));
  await Promise.all(restoredLegs.map((leg) => saveLeg(leg)));

  return { log: restoredLog, legs: restoredLegs };
}

function isBackup(value: unknown): value is LogBackup {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<LogBackup>;
  return (
    v.format === 'pilot-logbook-backup' &&
    v.version === 1 &&
    !!v.log &&
    Array.isArray(v.legs)
  );
}
