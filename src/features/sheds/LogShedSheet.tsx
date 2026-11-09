import { useState, type FormEvent } from 'react';
import type { Pet, ShedQuality } from '../../domain/types';
import { dateKey, isDateKey } from '../../domain/dates';
import { SHED_QUALITIES } from '../../domain/sheds';
import { logShed } from '../../db/sheds';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogShedSheet(props: Props) {
  if (!props.open) return null;
  return <ShedForm {...props} />;
}

function ShedForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [quality, setQuality] = useState<ShedQuality>('complete');
  const [inBlue, setInBlue] = useState(pet.inBlueSince ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const valid = isDateKey(date) && (inBlue === '' || isDateKey(inBlue));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(undefined);
    setSaving(true);
    try {
      await logShed({ petId: pet.id, date, quality, inBlueDate: inBlue || undefined, notes });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log shed">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Shed" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Shed date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="label">How did it go?</div>
        <Segmented label="Quality" options={SHED_QUALITIES} value={quality} onChange={setQuality} />
        <Field label="Went into blue">
          <input type="date" value={inBlue} onChange={(e) => setInBlue(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Optional: the day its eyes turned cloudy.</div>
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !valid}>Save shed</button>
      </form>
    </Sheet>
  );
}
