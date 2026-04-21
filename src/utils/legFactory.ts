import type { Leg } from '../types';
import { newLegId } from './ids';
import { todayIso } from './time';

export function emptyLeg(logId: string, order: number, defaultCompany = ''): Leg {
  return {
    id: newLegId(),
    logId,
    order,
    date: todayIso(),
    depLocation: '',
    arrLocation: '',
    depTime: '',
    arrTime: '',
    totalFlightTime: '',
    totalFlightTimeOverridden: false,
    aircraftType: '',
    aircraftReg: '',
    company: defaultCompany,
    copilot: '',
    role: 'PIC',
    dayNight: 'Day',
    flightRules: 'VFR',
    actualInstrument: '',
    simulatedInstrument: '',
    remarks: '',
    updatedAt: Date.now()
  };
}

const CARRY_KEYS = [
  'date',
  'company',
  'aircraftType',
  'aircraftReg',
  'copilot',
  'role',
  'flightRules'
] as const;

function carryForward(prev: Leg): Partial<Leg> {
  const out: Partial<Leg> = {};
  for (const key of CARRY_KEYS) {
    (out as Record<string, unknown>)[key] = prev[key];
  }
  out.dayNight = prev.dayNight;
  return out;
}

export function nextLegFrom(prev: Leg, logId: string, order: number): Leg {
  return {
    ...emptyLeg(logId, order),
    ...carryForward(prev),
    depLocation: prev.arrLocation,
    arrLocation: '',
    depTime: '',
    arrTime: '',
    totalFlightTime: '',
    totalFlightTimeOverridden: false,
    actualInstrument: '',
    simulatedInstrument: '',
    remarks: ''
  };
}

export function returnLegFrom(prev: Leg, logId: string, order: number): Leg {
  return {
    ...emptyLeg(logId, order),
    ...carryForward(prev),
    depLocation: prev.arrLocation,
    arrLocation: prev.depLocation,
    depTime: '',
    arrTime: '',
    totalFlightTime: '',
    totalFlightTimeOverridden: false,
    actualInstrument: '',
    simulatedInstrument: '',
    remarks: ''
  };
}

export function duplicateLegFrom(prev: Leg, logId: string, order: number): Leg {
  return {
    ...prev,
    id: newLegId(),
    logId,
    order,
    updatedAt: Date.now()
  };
}
