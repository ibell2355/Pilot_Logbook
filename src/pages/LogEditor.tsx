import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LegForm } from '../components/LegForm';
import {
  deleteLeg,
  getAllPresets,
  getLog,
  getProfile,
  listLegs,
  saveLeg,
  saveLog,
  saveSettings,
  getSettings
} from '../db/database';
import type { Leg, Log, PresetType, Profile } from '../types';
import {
  duplicateLegFrom,
  emptyLeg,
  nextLegFrom,
  returnLegFrom
} from '../utils/legFactory';
import { sumDurations } from '../utils/time';
import { exportLogPdf } from '../utils/pdf';
import { downloadBackup } from '../utils/backup';

export function LogEditor() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();

  const [log, setLog] = useState<Log | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [presets, setPresets] = useState<Record<PresetType, string[]>>({
    companies: [],
    aircraftTypes: [],
    aircraftRegs: [],
    locations: [],
    copilots: []
  });
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
        const first = emptyLeg(logId, 0, loadedProfile.defaultCompany);
        await saveLeg(first);
        legsToUse = [first];
      }
      setLog(loadedLog);
      setLegs(legsToUse);
      setCurrentIndex(legsToUse.length - 1);
      setProfile(loadedProfile);
      setPresets(loadedPresets);
      const settings = await getSettings();
      if (settings.currentLogId !== logId) {
        await saveSettings({ ...settings, currentLogId: logId });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, navigate]);

  // Debounced auto-save for current leg
  const saveTimer = useRef<number | null>(null);
  const pendingLeg = useRef<Leg | null>(null);

  const scheduleSave = useCallback((leg: Leg) => {
    pendingLeg.current = leg;
    setStatus('saving');
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const toSave = pendingLeg.current;
      if (!toSave) return;
      pendingLeg.current = null;
      await saveLeg(toSave);
      if (log) {
        const nextLog = { ...log, updatedAt: Date.now() };
        await saveLog(nextLog);
        setLog(nextLog);
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
      scheduleSave(next);
    },
    [currentIndex, scheduleSave]
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
    if (!confirm('Close this log? You can still view and export it later.')) return;
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
    if (!log || !profile) return;
    await flushSave();
    const freshLegs = await listLegs(log.id);
    await exportLogPdf({ log, legs: freshLegs, profile });
  };

  const createBackup = async () => {
    if (!log) return;
    await flushSave();
    const freshLegs = await listLegs(log.id);
    await downloadBackup({ log, legs: freshLegs, profile });
  };

  const totals = useMemo(() => {
    return {
      flight: sumDurations(legs.map((l) => l.totalFlightTime)),
      actual: sumDurations(legs.map((l) => l.actualInstrument)),
      simulated: sumDurations(legs.map((l) => l.simulatedInstrument))
    };
  }, [legs]);

  if (!log || !current) {
    return (
      <Layout title="Loading…" showBack>
        <p className="empty">Loading log…</p>
      </Layout>
    );
  }

  return (
    <Layout
      title={log.title}
      showBack
      right={
        <span
          className="pill"
          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : log.status === 'closed' ? 'Closed' : 'Auto-save'}
        </span>
      }
    >
      <section className="card">
        <div className="totals">
          <span>Legs: {legs.length}</span>
          <span>Total: {totals.flight || '0:00'}</span>
        </div>

        <ul className="leg-list" aria-label="Legs">
          {legs.map((l, i) => (
            <li
              key={l.id}
              className={i === currentIndex ? 'current' : ''}
              onClick={() => selectLeg(i)}
              role="button"
              tabIndex={0}
            >
              <div>
                <div className="leg-route">
                  {(l.depLocation || '—')} → {(l.arrLocation || '—')}
                </div>
                <div className="leg-meta">
                  #{i + 1} · {l.date}
                  {l.depTime && l.arrTime ? ` · ${l.depTime}–${l.arrTime}` : ''}
                </div>
              </div>
              <div className="leg-time">{l.totalFlightTime || '—'}</div>
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
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Leg #{currentIndex + 1}</h2>
        <LegForm
          leg={current}
          presets={presets}
          onChange={onLegChange}
          onPresetsRefresh={refreshPresets}
        />
      </section>

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
