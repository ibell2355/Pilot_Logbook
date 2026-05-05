export type LogStatus = 'open' | 'closed';

export interface Profile {
  id: 'default';
  pilotName: string;
  licenceNumber: string;
  employeeNumber: string;
  homeBase: string;
  defaultAircraft: string;
  defaultPilot: string;
}

export type PresetType = 'pilots' | 'locations' | 'aircraft';

export interface Presets {
  type: PresetType;
  values: string[];
}

export interface AppSettings {
  id: 'default';
  theme: 'light' | 'dark';
  currentLogId: string | null;
}

export interface Leg {
  id: string;
  logId: string;
  order: number;
  pilot: string;
  from: string;
  to: string;
  hobbsReading: number | null;
  landings: number;
  startUpCount: number;
  shutdownCount: number;
  notes: string;
  updatedAt: number;
}

export interface Log {
  id: string;
  title: string;
  date: string;
  aircraft: string;
  hobbsStart: number | null;
  taft: number | null;
  hookTime: number | null;
  inspectionInterval: number;
  hobbsDueAt: number | null;
  status: LogStatus;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

export interface LogBackup {
  format: 'pilot-logbook-backup';
  version: 2;
  exportedAt: number;
  profile: Profile | null;
  log: Log;
  legs: Leg[];
}
