import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import { saveErrorText } from '../../db/ids';
import type { ThemePref } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { loadSampleData } from '../../dev/sampleData';
import { RemindersButton } from '../reminders/RemindersButton';
import { useScheduleSources } from '../schedule/scheduleSources';
import { UnitsCard } from './UnitsCard';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const sources = useScheduleSources();
  const [loading, setLoading] = useState(false);
  const [themeError, setThemeError] = useState<string>();
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
        {themeError && <div role="alert" className="form-error">{themeError}</div>}
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => {
            setThemeError(undefined);
            updateSettings({ theme }).catch((err: unknown) => setThemeError(saveErrorText(err)));
          }}
        />
        <p className="muted setting-note">Auto follows your iPhone's light/dark setting.</p>
      </Card>

      <UnitsCard settings={settings} />

      <div className="label">Reminders &amp; data</div>
      <Card role="group" aria-label="Reminders & data">
        <div className="data-actions">
          <RemindersButton sources={sources} label="📅 Add reminders to Calendar" />
        </div>
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
