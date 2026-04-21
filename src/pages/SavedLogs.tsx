import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  deleteLog,
  getProfile,
  getSettings,
  listLegs,
  listLogs,
  saveSettings
} from '../db/database';
import type { Log, Profile } from '../types';
import { formatDateFriendly, sumDurations } from '../utils/time';
import { exportLogPdf } from '../utils/pdf';
import { downloadBackup } from '../utils/backup';
import { importBackupFile } from '../utils/backup';

interface LogSummary {
  log: Log;
  legCount: number;
  totalTime: string;
}

export function SavedLogs() {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<LogSummary[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [logs, loadedProfile] = await Promise.all([listLogs(), getProfile()]);
    const withCounts: LogSummary[] = await Promise.all(
      logs.map(async (log) => {
        const legs = await listLegs(log.id);
        return {
          log,
          legCount: legs.length,
          totalTime: sumDurations(legs.map((l) => l.totalFlightTime)) || '0:00'
        };
      })
    );
    setSummaries(withCounts);
    setProfile(loadedProfile);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const openLog = async (log: Log) => {
    const settings = await getSettings();
    await saveSettings({ ...settings, currentLogId: log.id });
    navigate(`/logs/${log.id}`);
  };

  const removeLog = async (log: Log) => {
    if (!confirm(`Delete ${log.title}? This cannot be undone.`)) return;
    await deleteLog(log.id);
    const settings = await getSettings();
    if (settings.currentLogId === log.id) {
      await saveSettings({ ...settings, currentLogId: null });
    }
    refresh();
  };

  const exportPdf = async (log: Log) => {
    if (!profile) return;
    const legs = await listLegs(log.id);
    await exportLogPdf({ log, legs, profile });
  };

  const createBackup = async (log: Log) => {
    const legs = await listLegs(log.id);
    await downloadBackup({ log, legs, profile });
  };

  const handleImport = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const restored = await importBackupFile(text);
      await refresh();
      if (restored) navigate(`/logs/${restored.log.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <Layout title="Saved Logs" showBack>
      <div className="list-toolbar">
        <label
          className="inline-link"
          style={{ padding: '8px 0', textTransform: 'none', fontSize: '0.9rem' }}
        >
          Import Backup…
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {importError && <p className="error">{importError}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : summaries.length === 0 ? (
        <p className="empty">No logs saved yet. Start one from the Home screen.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {summaries.map(({ log, legCount, totalTime }) => (
            <li key={log.id} style={{ marginBottom: 10 }}>
              <div className="card saved-log-card">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openLog(log)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openLog(log);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <h3>{log.title}</h3>
                  <div className="meta">
                    <span>{formatDateFriendly(log.startDate)}</span>
                    <span>
                      {legCount} leg{legCount === 1 ? '' : 's'}
                    </span>
                    <span>Total {totalTime}</span>
                    <span className="pill">
                      {log.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </div>
                <div
                  className="stack-sm"
                  style={{ marginTop: 12, display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                  <button onClick={() => openLog(log)}>Open</button>
                  <button onClick={() => exportPdf(log)}>Export PDF</button>
                  <button onClick={() => createBackup(log)}>Backup</button>
                  <button className="danger" onClick={() => removeLog(log)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
