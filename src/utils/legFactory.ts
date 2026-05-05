import type { Leg } from '../types';
import { newLegId } from './ids';

export function emptyLeg(
  logId: string,
  order: number,
  defaults?: { pilot?: string }
): Leg {
  return {
    id: newLegId(),
    logId,
    order,
    pilot: defaults?.pilot ?? '',
    from: '',
    to: '',
    hobbsReading: null,
    landings: 0,
    startUpCount: 0,
    shutdownCount: 0,
    notes: '',
    updatedAt: Date.now()
  };
}

export function nextLegFrom(prev: Leg, logId: string, order: number): Leg {
  return {
    ...emptyLeg(logId, order, { pilot: prev.pilot }),
    from: prev.to
  };
}

export function returnLegFrom(prev: Leg, logId: string, order: number): Leg {
  return {
    ...emptyLeg(logId, order, { pilot: prev.pilot }),
    from: prev.to,
    to: prev.from
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
