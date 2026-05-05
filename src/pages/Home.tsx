import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getSettings, listLogs } from '../db/database';
import type { Log } from '../types';

export function Home() {
  const navigate = useNavigate();
  const [resume, setResume] = useState<Log | null>(null);
  const [hasAnyLog, setHasAnyLog] = useState(false);

  useEffect(() => {
    (async () => {
      const [settings, logs] = await Promise.all([getSettings(), listLogs()]);
      setHasAnyLog(logs.length > 0);
      if (settings.currentLogId) {
        const match = logs.find((l) => l.id === settings.currentLogId);
        if (match && match.status === 'open') {
          setResume(match);
          return;
        }
      }
      const firstOpen = logs.find((l) => l.status === 'open');
      if (firstOpen) setResume(firstOpen);
    })();
  }, []);

  return (
    <Layout>
      <section className="card">
        <h2 style={{ margin: '4px 0 2px' }}>Pilot Daily Flight Notes</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Pick up where you left off or start a fresh log.
        </p>
      </section>

      <div className="home-actions">
        {resume && (
          <button className="primary" onClick={() => navigate(`/logs/${resume.id}`)}>
            Resume Current Log
            <small>{resume.title}</small>
          </button>
        )}

        <button
          className={resume ? '' : 'primary'}
          onClick={() => navigate('/logs/new')}
        >
          Start New Log
          <small>Begin today's daily flight notes</small>
        </button>

        <button onClick={() => navigate('/logs')} disabled={!hasAnyLog}>
          View Saved Logs
          <small>
            {hasAnyLog ? 'Reopen, back up, or export prior logs' : 'No logs yet'}
          </small>
        </button>

        <button disabled aria-disabled="true">
          Log Work Hours
          <small>Coming later</small>
        </button>
      </div>
    </Layout>
  );
}
