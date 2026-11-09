import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import type { Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { tempToC, type Units } from '../../domain/units';
import { logHabitatReading } from '../../db/habitat';
import { saveErrorText } from '../../db/ids';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { useUnits } from '../settings/useUnits';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogHabitatSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <HabitatForm {...props} units={units} />;
}

function HabitatForm({ pet, onClose, now: fixedNow, units }: Props & { units: Units }) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [warm, setWarm] = useState('');
  const [cool, setCool] = useState('');
  const [humidity, setHumidity] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at) return;
    const [w, c, h] = [warm, cool, humidity].map(parseOptionalNumber);
    if ([w, c, h].some((v) => Number.isNaN(v))) return setError('Readings must be numbers');
    const toC = (v: number | undefined) => (v === undefined ? undefined : tempToC(v, units.temp));
    setError(undefined);
    setSaving(true);
    try {
      await logHabitatReading({ petId: pet.id, at: at.toISOString(), warmC: toC(w), coolC: toC(c), humidityPct: h });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  const number = (value: string, set: (v: string) => void) => (
    <input type="number" inputMode="decimal" step="any" value={value} onChange={(e) => set(e.target.value)} />
  );

  return (
    <Sheet open onClose={onClose} title="Log habitat reading">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Habitat reading" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label={`Warm side (°${units.temp})`}>{number(warm, setWarm)}</Field>
        <Field label={`Cool side (°${units.temp})`}>{number(cool, setCool)}</Field>
        <Field label="Humidity (%)">{number(humidity, setHumidity)}</Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Fill in any of the three.</div>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save reading</button>
      </form>
    </Sheet>
  );
}
