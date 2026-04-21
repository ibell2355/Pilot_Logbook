import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  getProfile,
  getSettings,
  listLegs,
  listLogs,
  saveLeg,
  saveLog,
  saveSettings
} from '../db/database';
import type { Log } from '../types';
import { emptyLeg } from '../utils/legFactory';
import { newLogId } from '../utils/ids';
import { todayIso, formatDateFriendly } from '../utils/time';

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

  const startNewLog = async () => {
    const profile = await getProfile();
    const date = todayIso();
    const id = newLogId(date);
    const now = Date.now();
    const log: Log = {
      id,
      title: `Log ${formatDateFriendly(date)}`,
      startDate: date,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      closedAt: null
    };
    await saveLog(log);
    const legs = await listLegs(id);
    if (legs.length === 0) {
      await saveLeg(emptyLeg(id, 0, profile.defaultCompany));
    }
    const settings = await getSettings();
    await saveSettings({ ...settings, currentLogId: id });
    navigate(`/logs/${id}`);
  };

  const resumeLog = () => {
    if (resume) navigate(`/logs/${resume.id}`);
  };

  return (
    <Layout>
      <section className="card">
        <h2 style={{ margin: '4px 0 2px' }}>Welcome aboard</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Pick up where you left off or start a fresh log.
        </p>
      </section>

      <div className="home-actions">
        {resume && (
          <button className="primary" onClick={resumeLog}>
            Resume Current Log
            <small>{resume.title}</small>
          </button>
        )}

        <button className={resume ? '' : 'primary'} onClick={startNewLog}>
          Start New Log
          <small>Begin a new flight log for today</small>
        </button>

        <button onClick={() => navigate('/logs')} disabled={!hasAnyLog}>
          View Saved Logs
          <small>
            {hasAnyLog ? 'Review, export, or continue prior logs' : 'No logs yet'}
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
