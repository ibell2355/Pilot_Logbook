import type { Leg, PresetType } from '../types';
import { Autocomplete } from './Autocomplete';
import { Counter } from './Counter';
import { HoursInput } from './HoursInput';
import { addPresetValue } from '../db/database';
import { formatHours } from '../utils/time';

interface LegFormProps {
  leg: Leg;
  presets: Record<PresetType, string[]>;
  airTime: number | null;
  flightTime: number | null;
  onChange: (next: Leg) => void;
  onPresetsRefresh: () => void;
}

type Field = keyof Leg;

export function LegForm({
  leg,
  presets,
  airTime,
  flightTime,
  onChange,
  onPresetsRefresh
}: LegFormProps) {
  const update = <K extends Field>(key: K, value: Leg[K]) => {
    onChange({ ...leg, [key]: value, updatedAt: Date.now() });
  };

  const commitPreset = async (type: PresetType, value: string) => {
    const v = value.trim();
    if (!v) return;
    await addPresetValue(type, v);
    onPresetsRefresh();
  };

  return (
    <div className="stack">
      <div>
        <label htmlFor="pilot">Pilot</label>
        <Autocomplete
          id="pilot"
          value={leg.pilot}
          options={presets.pilots}
          onChange={(v) => update('pilot', v)}
          onCommit={(v) => commitPreset('pilots', v)}
          placeholder="Pilot name"
        />
      </div>

      <div className="row">
        <div>
          <label htmlFor="from">From</label>
          <Autocomplete
            id="from"
            value={leg.from}
            options={presets.locations}
            onChange={(v) => update('from', v)}
            onCommit={(v) => commitPreset('locations', v)}
            placeholder="e.g. field"
          />
        </div>
        <div>
          <label htmlFor="to">To</label>
          <Autocomplete
            id="to"
            value={leg.to}
            options={presets.locations}
            onChange={(v) => update('to', v)}
            onCommit={(v) => commitPreset('locations', v)}
            placeholder="e.g. swan hills"
          />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="hobbs">Hobbs Reading</label>
          <HoursInput
            id="hobbs"
            value={leg.hobbsReading}
            onChange={(v) => update('hobbsReading', v)}
            placeholder="e.g. 1387.7"
          />
        </div>
        <div>
          <label>Air Time</label>
          <div className="readout" aria-live="polite">
            {airTime != null ? formatHours(airTime) : '—'}
          </div>
        </div>
      </div>

      <div className="row">
        <div>
          <label>Landings</label>
          <Counter
            value={leg.landings}
            onChange={(v) => update('landings', v)}
            ariaLabel="Landings"
          />
        </div>
        <div>
          <label>Flight Time</label>
          <div className="readout">
            {flightTime != null ? formatHours(flightTime) : '—'}
          </div>
        </div>
      </div>

      <div className="row">
        <div>
          <label>Start Up</label>
          <Counter
            value={leg.startUpCount}
            onChange={(v) => update('startUpCount', v)}
            ariaLabel="Start ups"
          />
          <small style={{ color: 'var(--text-muted)' }}>+0.1 hr each</small>
        </div>
        <div>
          <label>Shutdown</label>
          <Counter
            value={leg.shutdownCount}
            onChange={(v) => update('shutdownCount', v)}
            ariaLabel="Shutdowns"
          />
          <small style={{ color: 'var(--text-muted)' }}>+0.1 hr each</small>
        </div>
      </div>

      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={leg.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}
