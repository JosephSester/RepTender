import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import type { Pet, PoopKind } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { POOP_KINDS } from '../../domain/poop';
import { logPoop } from '../../db/poops';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogPoopSheet(props: Props) {
  if (!props.open) return null;
  return <PoopForm {...props} />;
}

function PoopForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [kind, setKind] = useState<PoopKind>('normal');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at) return;
    setError(undefined);
    setSaving(true);
    try {
      await logPoop({ petId: pet.id, at: at.toISOString(), kind, notes });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log poop">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Poop" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <div className="label">What did it look like?</div>
        <Segmented label="Kind" options={POOP_KINDS} value={kind} onChange={setKind} />
        <div className="label">When</div>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save poop</button>
      </form>
    </Sheet>
  );
}
