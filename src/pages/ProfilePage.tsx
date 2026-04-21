import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  getAllPresets,
  getProfile,
  savePresets,
  saveProfile
} from '../db/database';
import type { PresetType, Profile } from '../types';

const PRESET_SECTIONS: { type: PresetType; label: string; hint: string }[] = [
  { type: 'companies', label: 'Companies', hint: 'Operators you fly for' },
  { type: 'aircraftTypes', label: 'Aircraft Types / Models', hint: 'e.g. AS350 B2' },
  { type: 'aircraftRegs', label: 'Aircraft Registrations', hint: 'e.g. C-FXYZ' },
  { type: 'locations', label: 'Common Locations', hint: 'Airports, pads, strips' },
  { type: 'copilots', label: 'Co-pilots', hint: 'Frequent crew members' }
];

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [presets, setPresets] = useState<Record<PresetType, string[]>>({
    companies: [],
    aircraftTypes: [],
    aircraftRegs: [],
    locations: [],
    copilots: []
  });
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    (async () => {
      setProfile(await getProfile());
      setPresets(await getAllPresets());
    })();
  }, []);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  };

  const persistProfile = async () => {
    if (!profile) return;
    await saveProfile(profile);
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1200);
  };

  const addPresetValue = async (type: PresetType, value: string) => {
    const v = value.trim();
    if (!v) return;
    const next = Array.from(new Set([...presets[type], v]));
    setPresets((prev) => ({ ...prev, [type]: next }));
    await savePresets(type, next);
  };

  const removePresetValue = async (type: PresetType, value: string) => {
    const next = presets[type].filter((x) => x !== value);
    setPresets((prev) => ({ ...prev, [type]: next }));
    await savePresets(type, next);
  };

  if (!profile) {
    return (
      <Layout title="Profile" showBack>
        <p className="empty">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout
      title="Profile"
      showBack
      right={status === 'saved' ? <span className="pill" style={{ fontSize: '0.7rem' }}>Saved</span> : undefined}
    >
      <section className="card">
        <h2>Pilot details</h2>
        <div className="stack">
          <div>
            <label htmlFor="pilotName">Pilot Name</label>
            <input
              id="pilotName"
              value={profile.pilotName}
              onChange={(e) => update('pilotName', e.target.value)}
              onBlur={persistProfile}
            />
          </div>
          <div>
            <label htmlFor="licence">Licence Number</label>
            <input
              id="licence"
              value={profile.licenceNumber}
              onChange={(e) => update('licenceNumber', e.target.value)}
              onBlur={persistProfile}
            />
          </div>
          <div>
            <label htmlFor="employee">Employee Number</label>
            <input
              id="employee"
              value={profile.employeeNumber}
              onChange={(e) => update('employeeNumber', e.target.value)}
              onBlur={persistProfile}
            />
          </div>
          <div>
            <label htmlFor="homeBase">Home Base</label>
            <input
              id="homeBase"
              value={profile.homeBase}
              onChange={(e) => update('homeBase', e.target.value)}
              onBlur={persistProfile}
            />
          </div>
          <div>
            <label htmlFor="defaultCompany">Default Company</label>
            <input
              id="defaultCompany"
              value={profile.defaultCompany}
              onChange={(e) => update('defaultCompany', e.target.value)}
              onBlur={persistProfile}
            />
          </div>
        </div>
      </section>

      {PRESET_SECTIONS.map(({ type, label, hint }) => (
        <PresetSection
          key={type}
          title={label}
          hint={hint}
          values={presets[type]}
          onAdd={(v) => addPresetValue(type, v)}
          onRemove={(v) => removePresetValue(type, v)}
        />
      ))}
    </Layout>
  );
}

interface PresetSectionProps {
  title: string;
  hint: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

function PresetSection({ title, hint, values, onAdd, onRemove }: PresetSectionProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {hint}
      </p>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Add ${title.toLowerCase()}`}
        />
        <button type="button" onClick={submit} style={{ flex: '0 0 auto' }}>
          Add
        </button>
      </div>
      {values.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {values.map((v) => (
            <span key={v} className="preset-chip">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onRemove(v)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '10px 0 0' }}>
          No entries yet.
        </p>
      )}
    </section>
  );
}
