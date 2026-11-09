import { useState, type FormEvent } from 'react';
import type { HabitatTargets, Pet } from '../../domain/types';
import { displayTemp, tempToC, type Units } from '../../domain/units';
import { updateHabitatSetup } from '../../db/habitat';
import { saveErrorText } from '../../db/ids';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { useUnits } from '../settings/useUnits';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

type Key = keyof Required<HabitatTargets>;
const FIELDS: { key: Key; name: string; temp: boolean }[] = [
  { key: 'warmMinC', name: 'Warm side min', temp: true },
  { key: 'warmMaxC', name: 'Warm side max', temp: true },
  { key: 'coolMinC', name: 'Cool side min', temp: true },
  { key: 'coolMaxC', name: 'Cool side max', temp: true },
  { key: 'humidityMin', name: 'Humidity min', temp: false },
  { key: 'humidityMax', name: 'Humidity max', temp: false },
];

export default function HabitatSetupSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <SetupForm {...props} units={units} />;
}

function SetupForm({ pet, onClose, units }: Props & { units: Units }) {
  const stored: HabitatTargets = pet.habitatTargets ?? {};
  const [initial] = useState(() => {
    const text = {} as Record<Key, string>;
    for (const { key, temp } of FIELDS) {
      const v = stored[key];
      text[key] = v === undefined ? '' : String(temp ? displayTemp(v, units.temp) : v);
    }
    return text;
  });
  const [values, setValues] = useState(initial);
  const [label, setLabel] = useState(pet.enclosureLabel ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const habitatTargets: HabitatTargets = {};
    for (const { key, temp } of FIELDS) {
      // An untouched field keeps its stored value exactly (no °F → °C rounding drift).
      if (values[key] === initial[key]) {
        habitatTargets[key] = stored[key];
        continue;
      }
      const v = parseOptionalNumber(values[key]);
      if (Number.isNaN(v)) return setError('Targets must be numbers');
      habitatTargets[key] = v === undefined ? undefined : temp ? tempToC(v, units.temp) : v;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateHabitatSetup(pet.id, { enclosureLabel: label, habitatTargets });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Habitat setup">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Habitat setup" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Enclosure label">
          <input value={label} placeholder="40-gal tank" onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className="label">Target ranges</div>
        {FIELDS.map(({ key, name, temp }) => (
          <Field key={key} label={`${name} (${temp ? `°${units.temp}` : '%'})`}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </Field>
        ))}
        <button type="submit" className="btn-primary" disabled={saving}>Save setup</button>
      </form>
    </Sheet>
  );
}
