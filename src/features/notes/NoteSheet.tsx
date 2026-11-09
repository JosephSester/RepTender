import { useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import type { Note, Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { addNote, updateNote } from '../../db/notes';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  note?: Note;
  now?: Date;
}

export default function NoteSheet(props: Props) {
  if (!props.open) return null;
  return <NoteForm {...props} />;
}

function NoteForm({ pet, onClose, note, now: fixedNow }: Props) {
  const [start] = useState(() => (note ? parseISO(note.at) : (fixedNow ?? new Date())));
  const [date, setDate] = useState(dateKey(start));
  const [time, setTime] = useState(format(start, 'HH:mm'));
  const [text, setText] = useState(note?.text ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);
  const title = note ? 'Edit note' : 'New note';

  function cancel() {
    // Dismissing mid-save is a no-op: the save finishes and closes the sheet itself.
    if (saving) return;
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at || saving) return;
    setError(undefined);
    setSaving(true);
    try {
      if (note) await updateNote(note.id, { at: at.toISOString(), text });
      else await addNote({ petId: pet.id, at: at.toISOString(), text });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={cancel} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label="Note" stack>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save note</button>
      </form>
    </Sheet>
  );
}
