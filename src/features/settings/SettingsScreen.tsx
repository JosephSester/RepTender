import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import type { ThemePref } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { loadSampleData } from '../../dev/sampleData';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const [loading, setLoading] = useState(false);
  if (!settings) return null;

  return (
    <>
      <h1>Settings</h1>
      <Card style={{ marginTop: 12 }}>
        <div className="row">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          <div className="grow">
            <b style={{ fontSize: 17 }}>RepTender</b>
            <div className="muted">{`${petCount ?? 0} pets · version ${__APP_VERSION__}`}</div>
          </div>
        </div>
      </Card>

      <div className="label">Appearance</div>
      <Card>
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
        <p className="muted" style={{ margin: '8px 2px 0', fontSize: 13 }}>
          Auto follows your iPhone's light/dark setting.
        </p>
      </Card>

      {import.meta.env.DEV && (
        <>
          <div className="label">Developer</div>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await loadSampleData();
              } finally {
                setLoading(false);
              }
            }}
          >
            Load sample pets
          </button>
        </>
      )}
    </>
  );
}
