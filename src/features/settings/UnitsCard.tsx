import { useState } from 'react';
import type { LengthUnit, Settings, TempUnit, WeightUnit } from '../../domain/types';
import { updateSettings } from '../../db/settings';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';

const TEMPS = [
  { value: 'F', label: '°F' },
  { value: 'C', label: '°C' },
] as const;
const WEIGHTS = [
  { value: 'g', label: 'g' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
] as const;
const LENGTHS = [
  { value: 'in', label: 'in' },
  { value: 'cm', label: 'cm' },
] as const;

type UnitPatch = Partial<Pick<Settings, 'tempUnit' | 'weightUnit' | 'lengthUnit'>>;

/** Spec §5.15 Units. Records stay in canonical units (g, mm, °C); this only changes the display. */
export function UnitsCard({ settings }: { settings: Settings }) {
  const [error, setError] = useState<string>();
  const save = (patch: UnitPatch) => {
    setError(undefined);
    updateSettings(patch).catch((err: unknown) => setError(saveErrorText(err)));
  };

  return (
    <>
      <div className="label">Units</div>
      <Card role="group" aria-label="Units">
        {error && <div role="alert" className="form-error">{error}</div>}
        <div className="setting-row">
          <span>Temperature</span>
          <Segmented<TempUnit> label="Temperature" options={TEMPS} value={settings.tempUnit} onChange={(tempUnit) => save({ tempUnit })} />
        </div>
        <div className="setting-row">
          <span>Weight</span>
          <Segmented<WeightUnit> label="Weight" options={WEIGHTS} value={settings.weightUnit} onChange={(weightUnit) => save({ weightUnit })} />
        </div>
        <div className="setting-row" style={{ marginBottom: 0 }}>
          <span>Length</span>
          <Segmented<LengthUnit> label="Length" options={LENGTHS} value={settings.lengthUnit} onChange={(lengthUnit) => save({ lengthUnit })} />
        </div>
        <p className="muted setting-note">Changing units only changes how values are shown. Nothing is lost.</p>
      </Card>
    </>
  );
}
