import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AppSettings,
  Leg,
  Log,
  PresetType,
  Presets,
  Profile
} from '../types';

export interface PilotLogbookDB extends DBSchema {
  profile: {
    key: 'default';
    value: Profile;
  };
  settings: {
    key: 'default';
    value: AppSettings;
  };
  presets: {
    key: PresetType;
    value: Presets;
  };
  logs: {
    key: string;
    value: Log;
    indexes: { 'by-updatedAt': number };
  };
  legs: {
    key: string;
    value: Leg;
    indexes: { 'by-logId': string };
  };
}

const DB_NAME = 'pilot-logbook';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PilotLogbookDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PilotLogbookDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PilotLogbookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'type' });
        }
        if (!db.objectStoreNames.contains('logs')) {
          const store = db.createObjectStore('logs', { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('legs')) {
          const store = db.createObjectStore('legs', { keyPath: 'id' });
          store.createIndex('by-logId', 'logId');
        }
      }
    });
  }
  return dbPromise;
}

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  pilotName: '',
  licenceNumber: '',
  employeeNumber: '',
  homeBase: '',
  defaultCompany: ''
};

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  theme: 'light',
  currentLogId: null
};

export async function getProfile(): Promise<Profile> {
  const db = await getDB();
  return (await db.get('profile', 'default')) ?? { ...DEFAULT_PROFILE };
}

export async function saveProfile(profile: Profile): Promise<void> {
  const db = await getDB();
  await db.put('profile', profile);
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  return (await db.get('settings', 'default')) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

export async function getPresets(type: PresetType): Promise<string[]> {
  const db = await getDB();
  const entry = await db.get('presets', type);
  return entry?.values ?? [];
}

export async function getAllPresets(): Promise<Record<PresetType, string[]>> {
  const types: PresetType[] = [
    'companies',
    'aircraftTypes',
    'aircraftRegs',
    'locations',
    'copilots'
  ];
  const result = {} as Record<PresetType, string[]>;
  await Promise.all(
    types.map(async (t) => {
      result[t] = await getPresets(t);
    })
  );
  return result;
}

export async function savePresets(type: PresetType, values: string[]): Promise<void> {
  const db = await getDB();
  const clean = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  await db.put('presets', { type, values: clean });
}

export async function addPresetValue(type: PresetType, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = await getPresets(type);
  if (existing.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
  await savePresets(type, [...existing, trimmed]);
}

export async function listLogs(): Promise<Log[]> {
  const db = await getDB();
  const logs = await db.getAll('logs');
  return logs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getLog(id: string): Promise<Log | undefined> {
  const db = await getDB();
  return db.get('logs', id);
}

export async function saveLog(log: Log): Promise<void> {
  const db = await getDB();
  await db.put('logs', log);
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['logs', 'legs'], 'readwrite');
  const legsIndex = tx.objectStore('legs').index('by-logId');
  const legKeys = await legsIndex.getAllKeys(id);
  await Promise.all([
    tx.objectStore('logs').delete(id),
    ...legKeys.map((k) => tx.objectStore('legs').delete(k))
  ]);
  await tx.done;
}

export async function listLegs(logId: string): Promise<Leg[]> {
  const db = await getDB();
  const legs = await db.getAllFromIndex('legs', 'by-logId', logId);
  return legs.sort((a, b) => a.order - b.order);
}

export async function saveLeg(leg: Leg): Promise<void> {
  const db = await getDB();
  await db.put('legs', leg);
}

export async function deleteLeg(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('legs', id);
}
