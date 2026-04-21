import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Segmented } from '../components/Segmented';
import { useTheme, type ThemeMode } from '../hooks/useTheme';
import { listLegs, listLogs } from '../db/database';

interface Storage {
  logs: number;
  legs: number;
  usage?: number;
  quota?: number;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPage() {
  const { mode, setMode } = useTheme();
  const [storage, setStorage] = useState<Storage>({ logs: 0, legs: 0 });

  useEffect(() => {
    (async () => {
      const logs = await listLogs();
      let legCount = 0;
      for (const log of logs) {
        const legs = await listLegs(log.id);
        legCount += legs.length;
      }
      let usage: number | undefined;
      let quota: number | undefined;
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        usage = est.usage;
        quota = est.quota;
      }
      setStorage({ logs: logs.length, legs: legCount, usage, quota });
    })();
  }, []);

  return (
    <Layout title="Settings" showBack>
      <section className="card">
        <h2>Theme</h2>
        <Segmented<ThemeMode>
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
          value={mode}
          onChange={(v) => setMode(v)}
          ariaLabel="Theme"
        />
      </section>

      <section className="card">
        <h2>Storage</h2>
        <div className="stack-sm" style={{ fontSize: '0.9rem' }}>
          <div>Saved logs: <strong>{storage.logs}</strong></div>
          <div>Total legs: <strong>{storage.legs}</strong></div>
          <div>
            Browser storage used:{' '}
            <strong>{formatBytes(storage.usage)}</strong>{' '}
            {storage.quota ? (
              <span style={{ color: 'var(--text-muted)' }}>
                of {formatBytes(storage.quota)}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Backups</h2>
        <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Create per-log backups from the Saved Logs screen or from inside an open log.
          Backups are small JSON files you can save to your phone, email, or cloud drive.
        </p>
        <p className="note">
          <strong>Warning:</strong> clearing this browser's site data — by clearing
          browsing data, reinstalling the app, or using a private window — can remove
          your locally stored logs. Export a backup regularly to keep a copy outside
          the device.
        </p>
      </section>

      <section className="card">
        <h2>About</h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Pilot Logbook · local-first proof of concept. No accounts, no servers,
          no cloud sync. All data stays on this device in your browser's storage.
        </p>
      </section>
    </Layout>
  );
}
