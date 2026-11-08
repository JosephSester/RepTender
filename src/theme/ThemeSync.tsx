import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../db/settings';
import { applyTheme } from './theme';

export default function ThemeSync() {
  const pref = useLiveQuery(async () => (await getSettings()).theme, []);
  useEffect(() => {
    if (!pref) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(pref, mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [pref]);
  return null;
}
