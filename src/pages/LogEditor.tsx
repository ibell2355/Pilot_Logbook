import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LegForm } from '../components/LegForm';
import { Autocomplete } from '../components/Autocomplete';
import { HoursInput } from '../components/HoursInput';
import {
  addPresetValue,
  deleteLeg,
  getAllPresets,
  getLog,
  getProfile,
  getSettings,
  listLegs,
  removePresetValue,
  saveLeg,
  saveLog,
  saveSettings
} from '../db/database';
import type { Leg, Log, PresetType } from '../types';
import {
  duplicateLegFrom,
  emptyLeg,
  nextLegFrom,
  returnLegFrom
} from '../utils/legFactory';
import {
  computeTotals,
  deriveLegs,
  maintenanceStatus,
  pilotSummaries
} from '../utils/calculations';
import { formatHours } from '../utils/time';
import { exportLogPdf } from '../utils/pdf';
import { downloadBackup } from '../utils/backup';

export function LogEditor() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();

  const [log, setLog] = useState<Log | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [presets, setPresets] = useState<Record<PresetType, string[]>>({
    pilots: [],
    locations: [],
    aircraft: []
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const refreshPresets = useCallback(async () => {
    setPresets(await getAllPresets());
  }, []);

  useEffect(() => {
    if (!logId) return;
    let cancelled = false;
    (async () => {
      const [loadedLog, loadedLegs, loadedProfile, loadedPresets] = await Promise.all([
        getLog(logId),
        listLegs(logId),
        getProfile(),
        getAllPresets()
      ]);
      if (cancelled) return;
      if (!loadedLog) {
        navigate('/logs', { replace: true });
        return;
      }
      let legsToUse = loadedLegs;
      if (legsToUse.length === 0) {
        const first = emptyLeg(logId, 0, { pilot: loadedProfile.defaultPilot });
        await saveLeg(first);
        legsToUse = [first];
      }
      setLog(loadedLog);
      setLegs(legsToUse);
      setCurrentIndex(legsToUse.length - 1);
      setPresets(loadedPresets);
      setProfileLoaded(true);
      const settings = await getSettings();
      if (settings.currentLogId !== logId) {
        await saveSettings({ ...settings, currentLogId: logId });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, navigate]);

  const saveTimer = useRef<number | null>(null);
  const pendingLeg = useRef<Leg | null>(null);
  const pendingLog = useRef<Log | null>(null);

  const scheduleSave = useCallback((leg: Leg | null, logUpdate: Log | null) => {
    if (leg) pendingLeg.current = leg;
    if (logUpdate) pendingLog.current = logUpdate;
    setStatus('saving');
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const toSaveLeg = pendingLeg.current;
      const toSaveLog = pendingLog.current;
      pendingLeg.current = null;
      pendingLog.current = null;
      if (toSaveLeg) await saveLeg(toSaveLeg);
      if (toSaveLog) {
        const next = { ...toSaveLog, updatedAt: Date.now() };
        await saveLog(next);
        setLog(next);
      } else if (log) {
        const next = { ...log, updatedAt: Date.now() };
        await saveLog(next);
        setLog(next);
      }
      setStatus('saved');
      window.setTimeout(() => {
        setStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 1200);
    }, 400);
  }, [log]);

  useEffect(() => {
    return () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const current = legs[currentIndex];

  const onLegChange = useCallback(
    (next: Leg) => {
      setLegs((prev) => prev.map((l, i) => (i === currentIndex ? next : l)));
      scheduleSave(next, null);
    },
    [currentIndex, scheduleSave]
  );

  const onLogChange = useCallback(
    <K extends keyof Log>(key: K, value: Log[K]) => {
      if (!log) return;
      const next = { ...log, [key]: value };
      setLog(next);
      scheduleSave(null, next);
    },
    [log, scheduleSave]
  );

  const flushSave = async () => {
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingLeg.current) {
      await saveLeg(pendingLeg.current);
      pendingLeg.current = null;
    }
    if (pendingLog.current) {
      await saveLog({ ...pendingLog.current, updatedAt: Date.now() });
      pendingLog.current = null;
    }
  };

  const commitAndOpen = async (
    makeNext: (prev: Leg, logId: string, order: number) => Leg
  ) => {
    if (!current || !log) return;
    await flushSave();
    const nextLeg = makeNext(current, log.id, legs.length);
    await saveLeg(nextLeg);
    const nextLog = { ...log, updatedAt: Date.now() };
    await saveLog(nextLog);
    setLog(nextLog);
    setLegs((prev) => [...prev, nextLeg]);
    setCurrentIndex(legs.length);
  };

  const handleNext = () => commitAndOpen(nextLegFrom);
  const handleReturn = () => commitAndOpen(returnLegFrom);
  const handleDuplicate = () => commitAndOpen(duplicateLegFrom);

  const selectLeg = (index: number) => {
    flushSave();
    setCurrentIndex(index);
  };

  const removeLeg = async (leg: Leg) => {
    if (legs.length <= 1) return;
    if (!confirm('Remove this leg?')) return;
    await flushSave();
    await deleteLeg(leg.id);
    const remaining = legs
      .filter((l) => l.id !== leg.id)
      .map((l, i) => ({ ...l, order: i }));
    await Promise.all(remaining.map((l) => saveLeg(l)));
    setLegs(remaining);
    setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
  };

  const closeLog = async () => {
    if (!log) return;
    if (!confirm('Close this log? You can reopen it later from Saved Logs.')) return;
    await flushSave();
    const closed: Log = {
      ...log,
      status: 'closed',
      closedAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveLog(closed);
    const settings = await getSettings();
    if (settings.currentLogId === log.id) {
      await saveSettings({ ...settings, currentLogId: null });
    }
    navigate('/logs');
  };

  const reopenLog = async () => {
    if (!log) return;
    const reopened: Log = {
      ...log,
      status: 'open',
      closedAt: null,
      updatedAt: Date.now()
    };
    await saveLog(reopened);
    setLog(reopened);
  };

  const exportPdf = async () => {
    if (!log) return;
    await flushSave();
    const profile = await getProfile();
    const freshLegs = await listLegs(log.id);
    await exportLogPdf({ log, legs: freshLegs, profile });
  };

  const createBackup = async () => {
    if (!log) return;
    await flushSave();
    const profile = await getProfile();
    const freshLegs = await listLegs(log.id);
    await downloadBackup({ log, legs: freshLegs, profile });
  };

  const totals = useMemo(() => {
    if (!log) return null;
    return computeTotals(log, legs);
  }, [log, legs]);

  const derived = useMemo(() => {
    if (!log) return [];
    return deriveLegs(log, legs);
  }, [log, legs]);

  const maint = useMemo(() => {
    if (!log || !totals) return null;
    return maintenanceStatus(log, totals);
  }, [log, totals]);

  const summaries = useMemo(() => {
    if (!log) return [];
    return pilotSummaries(log, legs);
  }, [log, legs]);

  if (!log || !current || !totals || !profileLoaded) {
    return (
      <Layout title="Loading…" showBack>
        <p className="empty">Loading log…</p>
      </Layout>
    );
  }

  const currentDerived = derived[currentIndex] ?? { airTime: null, flightTime: null };

  const commitAircraftPreset = async (v: string) => {
    if (v.trim()) {
      await addPresetValue('aircraft', v.trim());
      refreshPresets();
    }
  };

  const removeAircraftPreset = async (v: string) => {
    await removePresetValue('aircraft', v);
    refreshPresets();
  };

  return (
    <Layout
      title="Daily Flight Notes"
      showBack
      right={
        <span
          className="pill"
          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
        >
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
            ? 'Saved'
            : log.status === 'closed'
            ? 'Closed'
            : 'Auto-save'}
        </span>
      }
    >
      <section className="card">
        <div className="row">
          <div>
            <label htmlFor="log-date">Date</label>
            <input
              id="log-date"
              type="date"
              value={log.date}
              onChange={(e) => onLogChange('date', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="log-aircraft">Aircraft</label>
            <Autocomplete
              id="log-aircraft"
              value={log.aircraft}
              options={presets.aircraft}
              onChange={(v) => onLogChange('aircraft', v)}
              onCommit={commitAircraftPreset}
              onRemove={removeAircraftPreset}
              autoCapitalize="characters"
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="log-hobbsStart">Hobbs Start</label>
            <HoursInput
              id="log-hobbsStart"
              value={log.hobbsStart}
              onChange={(v) => onLogChange('hobbsStart', v)}
            />
          </div>
          <div>
            <label htmlFor="log-taft">TAFT</label>
            <HoursInput
              id="log-taft"
              value={log.taft}
              onChange={(v) => onLogChange('taft', v)}
            />
          </div>
          <div>
            <label htmlFor="log-hook">Hook Time</label>
            <HoursInput
              id="log-hook"
              value={log.hookTime}
              onChange={(v) => onLogChange('hookTime', v)}
            />
          </div>
        </div>
      </section>

      {maint && (
        <section className={`card maint maint--${maint.state}`}>
          <div className="maint__row">
            <strong>Inspection</strong>
            <span className="maint__label">{maint.label}</span>
          </div>
          <div className="maint__details">
            <span>
              Due at:{' '}
              <strong>
                {maint.dueAt != null ? formatHours(maint.dueAt) : '—'}
              </strong>
            </span>
            <span>
              Current Hobbs:{' '}
              <strong>
                {maint.currentHobbs != null
                  ? formatHours(maint.currentHobbs)
                  : '—'}
              </strong>
            </span>
            <span>
              Due in:{' '}
              <strong>
                {maint.dueIn != null ? formatHours(maint.dueIn) : '—'}
              </strong>
            </span>
          </div>
          <div className="maint__edit">
            <label htmlFor="log-dueAt">Hobbs Due At</label>
            <HoursInput
              id="log-dueAt"
              value={log.hobbsDueAt}
              onChange={(v) => onLogChange('hobbsDueAt', v)}
            />
          </div>
        </section>
      )}

      <section className="card">
        <div className="totals">
          <span>Air {formatHours(totals.totalAirTime)}</span>
          <span>Flight {formatHours(totals.totalFlightTime)}</span>
          <span>Lndg {totals.totalLandings}</span>
        </div>
        <div className="totals" style={{ marginTop: 6 }}>
          <span>
            TAFT End{' '}
            {totals.taftEnd != null ? formatHours(totals.taftEnd) : '—'}
          </span>
          <span>
            Hook End{' '}
            {totals.hookTimeEnd != null
              ? formatHours(totals.hookTimeEnd)
              : '—'}
          </span>
        </div>

        <ul className="leg-list" aria-label="Legs" style={{ marginTop: 12 }}>
          {legs.map((l, i) => {
            const d = derived[i] ?? { airTime: null, flightTime: null };
            return (
              <li
                key={l.id}
                className={i === currentIndex ? 'current' : ''}
                onClick={() => selectLeg(i)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <div className="leg-route">
                    {(l.from || '—')} → {(l.to || '—')}
                  </div>
                  <div className="leg-meta">
                    #{i + 1} · {l.pilot || 'no pilot'}
                    {l.hobbsReading != null
                      ? ` · Hobbs ${formatHours(l.hobbsReading)}`
                      : ''}
                  </div>
                </div>
                <div className="leg-time">
                  {d.flightTime != null ? formatHours(d.flightTime) : '—'}
                </div>
                {legs.length > 1 && (
                  <button
                    className="icon-btn danger"
                    aria-label="Remove leg"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLeg(l);
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Leg #{currentIndex + 1}</h2>
        <LegForm
          leg={current}
          presets={presets}
          airTime={currentDerived.airTime}
          flightTime={currentDerived.flightTime}
          onChange={onLegChange}
          onPresetsRefresh={refreshPresets}
        />
      </section>

      {summaries.length > 0 && (
        <section className="card">
          <h2>Pilot summaries</h2>
          <ul className="pilot-summary">
            {summaries.map((s) => (
              <li key={s.pilot}>
                <span>{s.pilot}</span>
                <span>
                  Air {formatHours(s.airTime)} · Flight{' '}
                  {formatHours(s.flightTime)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="stack">
          <button onClick={exportPdf}>Export PDF</button>
          <button onClick={createBackup}>Create Backup</button>
          {log.status === 'open' ? (
            <button className="danger" onClick={closeLog}>
              Close Log
            </button>
          ) : (
            <button onClick={reopenLog}>Reopen Log</button>
          )}
        </div>
      </section>

      {log.status === 'open' && (
        <div className="leg-actions">
          <button onClick={handleNext} className="primary">
            Next Leg
            <small>New leg, carry forward</small>
          </button>
          <button onClick={handleReturn}>
            Return Leg
            <small>Reverse route</small>
          </button>
          <button onClick={handleDuplicate}>
            Duplicate
            <small>Copy &amp; edit</small>
          </button>
        </div>
      )}
    </Layout>
  );
}
