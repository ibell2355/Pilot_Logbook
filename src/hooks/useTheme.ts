import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../db/database';

export type ThemeMode = 'light' | 'dark';

function apply(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
}

function normalise(value: string): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (cancelled) return;
      const resolved = normalise(s.theme);
      setMode(resolved);
      apply(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: ThemeMode) => {
    setMode(next);
    apply(next);
    const existing = await getSettings();
    await saveSettings({ ...existing, theme: next });
  }, []);

  return { mode, setMode: update };
}
