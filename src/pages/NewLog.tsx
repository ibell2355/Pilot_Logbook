import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Autocomplete } from '../components/Autocomplete';
import { HoursInput } from '../components/HoursInput';
import {
  addPresetValue,
  getAllPresets,
  getProfile,
  getSettings,
  listLegs,
  listLogs,
  removePresetValue,
  saveLog,
  saveSettings
} from '../db/database';
import type { Log, PresetType } from '../types';
import { computeTotals } from '../utils/calculations';
import { newLogId } from '../utils/ids';
import { formatDateFriendly, todayIso } from '../utils/time';

const DEFAULT_INSPECTION_INTERVAL = 500;

interface PrevSuggestion {
  hobbsStart: number | null;
  taft: number | null;
  hookTime: number | null;
  aircraft: string;
  hobbsDueAt: number | null;
  inspectionInterval: number;
}

export function NewLog() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<Record<PresetType, string[]>>({
    pilots: [],
    locations: [],
    aircraft: []
  });
  const [date, setDate] = useState(todayIso());
  const [aircraft, setAircraft] = useState('');
  const [hobbsStart, setHobbsStart] = useState<number | null>(null);
  const [taft, setTaft] = useState<number | null>(null);
  const [hookTime, setHookTime] = useState<number | null>(null);
  const [inspectionInterval, setInspectionInterval] = useState<number>(
    DEFAULT_INSPECTION_INTERVAL
  );
  const [hobbsDueAt, setHobbsDueAt] = useState<number | null>(null);
  const [prev, setPrev] = useState<PrevSuggestion | null>(null);
  const [usedSuggestion, setUsedSuggestion] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [profile, loadedPresets, logs] = await Promise.all([
        getProfile(),
        getAllPresets(),
        listLogs()
      ]);
      setPresets(loadedPresets);

      let suggestion: PrevSuggestion | null = null;
      if (logs.length > 0) {
        const latest = logs[0];
        const legs = await listLegs(latest.id);
        const totals = computeTotals(latest, legs);
        suggestion = {
          hobbsStart: totals.currentHobbs,
          taft: totals.taftEnd,
          hookTime: totals.hookTimeEnd,
          aircraft: latest.aircraft,
          hobbsDueAt: latest.hobbsDueAt,
          inspectionInterval:
            latest.inspectionInterval || DEFAULT_INSPECTION_INTERVAL
        };
      }
      setPrev(suggestion);

      // Default aircraft: prior log's aircraft, else profile default.
      setAircraft(suggestion?.aircraft || profile.defaultAircraft || '');
      if (suggestion) {
        setHobbsStart(suggestion.hobbsStart);
        setTaft(suggestion.taft);
        setHookTime(suggestion.hookTime);
        setHobbsDueAt(suggestion.hobbsDueAt);
        setInspectionInterval(suggestion.inspectionInterval);
        setUsedSuggestion(true);
      }
    })();
  }, []);

  const clearSuggestions = () => {
    setHobbsStart(null);
    setTaft(null);
    setHookTime(null);
    setUsedSuggestion(false);
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const id = newLogId(date);
    const now = Date.now();
    const log: Log = {
      id,
      title: `Daily Flight Notes · ${formatDateFriendly(date)}`,
      date,
      aircraft: aircraft.trim(),
      hobbsStart,
      taft,
      hookTime,
      inspectionInterval: inspectionInterval || DEFAULT_INSPECTION_INTERVAL,
      hobbsDueAt,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      closedAt: null
    };
    if (aircraft.trim()) await addPresetValue('aircraft', aircraft.trim());
    await saveLog(log);
    const settings = await getSettings();
    await saveSettings({ ...settings, currentLogId: id });
    navigate(`/logs/${id}`, { replace: true });
  };

  return (
    <Layout title="Start New Log" showBack>
      {prev && usedSuggestion && (
        <section className="card note">
          Pre-filled from your last log. You can override anything below.{' '}
          <button
            type="button"
            className="inline-link"
            onClick={clearSuggestions}
          >
            Clear suggestions
          </button>
        </section>
      )}

      <section className="card">
        <div className="stack">
          <div className="row">
            <div>
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="aircraft">Aircraft</label>
              <Autocomplete
                id="aircraft"
                value={aircraft}
                options={presets.aircraft}
                onChange={(v) => setAircraft(v)}
                onCommit={async (v) => {
                  if (v.trim()) {
                    await addPresetValue('aircraft', v.trim());
                    setPresets(await getAllPresets());
                  }
                }}
                onRemove={async (v) => {
                  await removePresetValue('aircraft', v);
                  setPresets(await getAllPresets());
                }}
                placeholder="e.g. C-FIJI"
                autoCapitalize="characters"
              />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="hobbsStart">Hobbs Start</label>
              <HoursInput
                id="hobbsStart"
                value={hobbsStart}
                onChange={setHobbsStart}
              />
            </div>
            <div>
              <label htmlFor="taft">TAFT</label>
              <HoursInput id="taft" value={taft} onChange={setTaft} />
            </div>
          </div>

          <div className="row">
            <div>
              <label htmlFor="hook">Hook Time</label>
              <HoursInput
                id="hook"
                value={hookTime}
                onChange={setHookTime}
              />
            </div>
            <div>
              <label htmlFor="interval">Inspection Interval</label>
              <input
                id="interval"
                type="number"
                inputMode="numeric"
                step={1}
                value={inspectionInterval}
                onChange={(e) =>
                  setInspectionInterval(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div>
            <label htmlFor="dueAt">Hobbs Due At</label>
            <HoursInput
              id="dueAt"
              value={hobbsDueAt}
              onChange={setHobbsDueAt}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              Optional. Used for the maintenance alert.
            </small>
          </div>
        </div>
      </section>

      <section className="card">
        <button
          className="primary"
          onClick={create}
          disabled={busy}
          style={{ width: '100%' }}
        >
          Create Log
        </button>
      </section>
    </Layout>
  );
}
