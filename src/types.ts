export type Role = 'PIC' | 'SIC';
export type DayNight = 'Day' | 'Night';
export type FlightRules = 'VFR' | 'IFR';
export type LogStatus = 'open' | 'closed';

export interface Profile {
  id: 'default';
  pilotName: string;
  licenceNumber: string;
  employeeNumber: string;
  homeBase: string;
  defaultCompany: string;
}

export type PresetType =
  | 'companies'
  | 'aircraftTypes'
  | 'aircraftRegs'
  | 'locations'
  | 'copilots';

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
  date: string;            // ISO date yyyy-mm-dd
  depLocation: string;
  arrLocation: string;
  depTime: string;         // HH:mm (24h)
  arrTime: string;         // HH:mm (24h)
  totalFlightTime: string; // HH:mm
  totalFlightTimeOverridden: boolean;
  aircraftType: string;
  aircraftReg: string;
  company: string;
  copilot: string;
  role: Role | '';
  dayNight: DayNight | '';
  flightRules: FlightRules | '';
  actualInstrument: string;    // HH:mm
  simulatedInstrument: string; // HH:mm
  remarks: string;
  updatedAt: number;
}

export interface Log {
  id: string;
  title: string;        // auto-generated label, editable later
  startDate: string;    // ISO date of first leg or creation date
  status: LogStatus;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

export interface LogBackup {
  format: 'pilot-logbook-backup';
  version: 1;
  exportedAt: number;
  profile: Profile | null;
  log: Log;
  legs: Leg[];
}
