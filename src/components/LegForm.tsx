import { useEffect, useMemo, useRef } from 'react';
import type { DayNight, FlightRules, Leg, PresetType, Role } from '../types';
import { durationBetween } from '../utils/time';
import { Autocomplete } from './Autocomplete';
import { Segmented } from './Segmented';
import { addPresetValue } from '../db/database';

interface LegFormProps {
  leg: Leg;
  presets: Record<PresetType, string[]>;
  onChange: (next: Leg) => void;
  onPresetsRefresh: () => void;
}

type Field = keyof Leg;

export function LegForm({ leg, presets, onChange, onPresetsRefresh }: LegFormProps) {
  const overrideRef = useRef(leg.totalFlightTimeOverridden);
  overrideRef.current = leg.totalFlightTimeOverridden;

  const update = <K extends Field>(key: K, value: Leg[K]) => {
    onChange({ ...leg, [key]: value, updatedAt: Date.now() });
  };

  // Auto-calculate total flight time when dep/arr change, unless overridden
  useEffect(() => {
    if (overrideRef.current) return;
    const calc = durationBetween(leg.depTime, leg.arrTime);
    if (calc && calc !== leg.totalFlightTime) {
      onChange({ ...leg, totalFlightTime: calc, updatedAt: Date.now() });
    }
    // Intentionally depend on dep/arr only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg.depTime, leg.arrTime]);

  const calcHint = useMemo(
    () => durationBetween(leg.depTime, leg.arrTime),
    [leg.depTime, leg.arrTime]
  );

  const commitPreset = async (type: PresetType, value: string) => {
    const v = value.trim();
    if (!v) return;
    await addPresetValue(type, v);
    onPresetsRefresh();
  };

  return (
    <div className="stack">
      <div className="row">
        <div>
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={leg.date}
            onChange={(e) => update('date', e.target.value)}
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="dep">Departure</label>
          <Autocomplete
            id="dep"
            value={leg.depLocation}
            options={presets.locations}
            onChange={(v) => update('depLocation', v)}
            onCommit={(v) => commitPreset('locations', v)}
            placeholder="e.g. CYYZ"
            autoCapitalize="characters"
          />
        </div>
        <div>
          <label htmlFor="arr">Arrival</label>
          <Autocomplete
            id="arr"
            value={leg.arrLocation}
            options={presets.locations}
            onChange={(v) => update('arrLocation', v)}
            onCommit={(v) => commitPreset('locations', v)}
            placeholder="e.g. CYOW"
            autoCapitalize="characters"
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="depTime">Dep. Time (24h)</label>
          <input
            id="depTime"
            type="time"
            step={60}
            value={leg.depTime}
            onChange={(e) => update('depTime', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="arrTime">Arr. Time (24h)</label>
          <input
            id="arrTime"
            type="time"
            step={60}
            value={leg.arrTime}
            onChange={(e) => update('arrTime', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="tft">
          Total Flight Time
          {calcHint && !leg.totalFlightTimeOverridden && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
              (auto {calcHint})
            </span>
          )}
        </label>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <input
            id="tft"
            type="time"
            step={60}
            value={leg.totalFlightTime}
            onChange={(e) =>
              onChange({
                ...leg,
                totalFlightTime: e.target.value,
                totalFlightTimeOverridden: true,
                updatedAt: Date.now()
              })
            }
          />
          {leg.totalFlightTimeOverridden && (
            <button
              type="button"
              style={{ flex: '0 0 auto' }}
              onClick={() =>
                onChange({
                  ...leg,
                  totalFlightTime: durationBetween(leg.depTime, leg.arrTime),
                  totalFlightTimeOverridden: false,
                  updatedAt: Date.now()
                })
              }
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="aircraftType">Aircraft Type / Model</label>
          <Autocomplete
            id="aircraftType"
            value={leg.aircraftType}
            options={presets.aircraftTypes}
            onChange={(v) => update('aircraftType', v)}
            onCommit={(v) => commitPreset('aircraftTypes', v)}
            placeholder="e.g. AS350 B2"
          />
        </div>
        <div>
          <label htmlFor="aircraftReg">Registration</label>
          <Autocomplete
            id="aircraftReg"
            value={leg.aircraftReg}
            options={presets.aircraftRegs}
            onChange={(v) => update('aircraftReg', v)}
            onCommit={(v) => commitPreset('aircraftRegs', v)}
            placeholder="e.g. C-FXYZ"
            autoCapitalize="characters"
          />
        </div>
      </div>

      <div>
        <label htmlFor="company">Company</label>
        <Autocomplete
          id="company"
          value={leg.company}
          options={presets.companies}
          onChange={(v) => update('company', v)}
          onCommit={(v) => commitPreset('companies', v)}
          placeholder="Operator"
        />
      </div>

      <div>
        <label htmlFor="copilot">Co-pilot</label>
        <Autocomplete
          id="copilot"
          value={leg.copilot}
          options={presets.copilots}
          onChange={(v) => update('copilot', v)}
          onCommit={(v) => commitPreset('copilots', v)}
          placeholder="Name or leave blank"
        />
      </div>

      <div>
        <label>Pilot Role</label>
        <Segmented<Role>
          options={[
            { value: 'PIC', label: 'PIC' },
            { value: 'SIC', label: 'SIC' }
          ]}
          value={(leg.role || 'PIC') as Role}
          onChange={(v) => update('role', v)}
          ariaLabel="Pilot role"
        />
      </div>

      <div>
        <label>Day / Night</label>
        <Segmented<DayNight>
          options={[
            { value: 'Day', label: 'Day' },
            { value: 'Night', label: 'Night' }
          ]}
          value={(leg.dayNight || 'Day') as DayNight}
          onChange={(v) => update('dayNight', v)}
          ariaLabel="Day or night"
        />
      </div>

      <div>
        <label>Flight Rules</label>
        <Segmented<FlightRules>
          options={[
            { value: 'VFR', label: 'VFR' },
            { value: 'IFR', label: 'IFR' }
          ]}
          value={(leg.flightRules || 'VFR') as FlightRules}
          onChange={(v) => update('flightRules', v)}
          ariaLabel="Flight rules"
        />
      </div>

      <div className="row">
        <div>
          <label htmlFor="actInst">Actual Instrument</label>
          <input
            id="actInst"
            type="time"
            step={60}
            value={leg.actualInstrument}
            onChange={(e) => update('actualInstrument', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="simInst">Simulated Instrument</label>
          <input
            id="simInst"
            type="time"
            step={60}
            value={leg.simulatedInstrument}
            onChange={(e) => update('simulatedInstrument', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="remarks">Remarks</label>
        <textarea
          id="remarks"
          value={leg.remarks}
          onChange={(e) => update('remarks', e.target.value)}
          placeholder="Any notes for this leg"
        />
      </div>
    </div>
  );
}
