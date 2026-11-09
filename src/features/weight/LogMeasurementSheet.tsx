import { useState, type FormEvent } from 'react';
import type { Pet } from '../../domain/types';
import { dateKey, isDateKey } from '../../domain/dates';
import { lengthToMm, weightToG, type Units } from '../../domain/units';
import { logMeasurement } from '../../db/measurements';
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

export default function LogMeasurementSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <MeasurementForm {...props} units={units} />;
}

function MeasurementForm({ pet, onClose, now: fixedNow, units }: Props & { units: Units }) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isDateKey(date)) return;
    const w = parseOptionalNumber(weight);
    const l = parseOptionalNumber(length);
    if (Number.isNaN(w)) return setError('Weight must be a number');
    if (Number.isNaN(l)) return setError('Length must be a number');
    setError(undefined);
    setSaving(true);
    try {
      await logMeasurement({
        petId: pet.id,
        date,
        weightG: w === undefined ? undefined : weightToG(w, units.weight),
        lengthMm: l === undefined ? undefined : lengthToMm(l, units.length),
      });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log weight & length">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Weight & length" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`Weight (${units.weight})`}>
          <input type="number" inputMode="decimal" step="any" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label={`Length (${units.length})`}>
          <input type="number" inputMode="decimal" step="any" min={0} value={length} onChange={(e) => setLength(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Fill in one or both.</div>
        <button type="submit" className="btn-primary" disabled={saving || !isDateKey(date)}>Save entry</button>
      </form>
    </Sheet>
  );
}
