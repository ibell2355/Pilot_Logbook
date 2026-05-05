import type { Leg, Log } from '../types';
import { round1 } from './time';

export interface LegDerived {
  airTime: number | null;
  flightTime: number | null;
}

/**
 * Air time for a leg = currentHobbs - prevHobbs (or hobbsStart for the first
 * leg). Returns null when either side is missing so the UI can show a blank
 * cell rather than a misleading zero.
 */
export function legAirTime(
  hobbsReading: number | null,
  prevHobbs: number | null
): number | null {
  if (hobbsReading == null || prevHobbs == null) return null;
  return round1(hobbsReading - prevHobbs);
}

export function legFlightTime(
  airTime: number | null,
  startUpCount: number,
  shutdownCount: number
): number | null {
  if (airTime == null) return null;
  return round1(airTime + startUpCount * 0.1 + shutdownCount * 0.1);
}

/**
 * Compute air time / flight time for every leg in order. The previous leg's
 * hobbs reading rolls forward, falling back to the log's hobbsStart when the
 * earlier leg has no reading yet.
 */
export function deriveLegs(log: Log, legs: Leg[]): LegDerived[] {
  const out: LegDerived[] = [];
  let prevHobbs: number | null = log.hobbsStart;
  for (const leg of legs) {
    const air = legAirTime(leg.hobbsReading, prevHobbs);
    const flight = legFlightTime(air, leg.startUpCount, leg.shutdownCount);
    out.push({ airTime: air, flightTime: flight });
    if (leg.hobbsReading != null) prevHobbs = leg.hobbsReading;
  }
  return out;
}

export interface LogTotals {
  totalAirTime: number;
  totalFlightTime: number;
  totalLandings: number;
  totalStartUps: number;
  totalShutdowns: number;
  taftEnd: number | null;
  hookTimeEnd: number | null;
  /** Most recent hobbs reading entered, or hobbsStart if none. */
  currentHobbs: number | null;
}

export function computeTotals(log: Log, legs: Leg[]): LogTotals {
  const derived = deriveLegs(log, legs);
  let totalAirTime = 0;
  let totalFlightTime = 0;
  for (const d of derived) {
    if (d.airTime != null) totalAirTime += d.airTime;
    if (d.flightTime != null) totalFlightTime += d.flightTime;
  }
  totalAirTime = round1(totalAirTime);
  totalFlightTime = round1(totalFlightTime);

  const totalLandings = legs.reduce((s, l) => s + (l.landings || 0), 0);
  const totalStartUps = legs.reduce((s, l) => s + (l.startUpCount || 0), 0);
  const totalShutdowns = legs.reduce((s, l) => s + (l.shutdownCount || 0), 0);

  const taftEnd = log.taft != null ? round1(log.taft + totalAirTime) : null;
  const hookTimeEnd =
    log.hookTime != null ? round1(log.hookTime + totalAirTime) : null;

  let currentHobbs: number | null = log.hobbsStart;
  for (let i = legs.length - 1; i >= 0; i -= 1) {
    if (legs[i].hobbsReading != null) {
      currentHobbs = legs[i].hobbsReading;
      break;
    }
  }

  return {
    totalAirTime,
    totalFlightTime,
    totalLandings,
    totalStartUps,
    totalShutdowns,
    taftEnd,
    hookTimeEnd,
    currentHobbs
  };
}

export interface PilotSummary {
  pilot: string;
  airTime: number;
  flightTime: number;
}

export function pilotSummaries(log: Log, legs: Leg[]): PilotSummary[] {
  const derived = deriveLegs(log, legs);
  const map = new Map<string, PilotSummary>();
  legs.forEach((leg, i) => {
    const name = (leg.pilot || '').trim();
    if (!name) return;
    const entry = map.get(name) ?? { pilot: name, airTime: 0, flightTime: 0 };
    if (derived[i].airTime != null) entry.airTime += derived[i].airTime!;
    if (derived[i].flightTime != null)
      entry.flightTime += derived[i].flightTime!;
    map.set(name, entry);
  });
  return Array.from(map.values()).map((s) => ({
    pilot: s.pilot,
    airTime: round1(s.airTime),
    flightTime: round1(s.flightTime)
  }));
}

export type MaintenanceState = 'none' | 'ok' | 'caution' | 'overdue';

export interface MaintenanceStatus {
  state: MaintenanceState;
  dueIn: number | null;
  dueAt: number | null;
  currentHobbs: number | null;
  label: string;
}

/**
 * Demo maintenance status. Caution when within 10 hobbs hours of due,
 * overdue once past. `none` when no due-at value is configured.
 */
export function maintenanceStatus(
  log: Log,
  totals: LogTotals
): MaintenanceStatus {
  if (log.hobbsDueAt == null) {
    return {
      state: 'none',
      dueIn: null,
      dueAt: null,
      currentHobbs: totals.currentHobbs,
      label: 'No inspection due-at set'
    };
  }
  const current = totals.currentHobbs;
  if (current == null) {
    return {
      state: 'none',
      dueIn: null,
      dueAt: log.hobbsDueAt,
      currentHobbs: null,
      label: 'Enter Hobbs to see status'
    };
  }
  const dueIn = round1(log.hobbsDueAt - current);
  let state: MaintenanceState = 'ok';
  let label = `${dueIn.toFixed(1)} hrs to inspection`;
  if (dueIn < 0) {
    state = 'overdue';
    label = `Overdue by ${Math.abs(dueIn).toFixed(1)} hrs`;
  } else if (dueIn <= 10) {
    state = 'caution';
    label = `Due in ${dueIn.toFixed(1)} hrs`;
  }
  return { state, dueIn, dueAt: log.hobbsDueAt, currentHobbs: current, label };
}
