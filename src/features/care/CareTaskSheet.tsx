import { useState, type FormEvent } from 'react';
import type { CareTask, Pet } from '../../domain/types';
import { archiveCareTask, createCareTask, updateCareTask } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  task?: CareTask;
}

type Scope = 'pet' | 'all';

export default function CareTaskSheet(props: Props) {
  if (!props.open) return null;
  return <CareTaskForm {...props} />;
}

function CareTaskForm({ pet, onClose, task }: Props) {
  const [name, setName] = useState(task?.name ?? '');
  const [intervalDays, setIntervalDays] = useState(String(task?.intervalDays ?? 1));
  const [time, setTime] = useState(task?.timeOfDay ?? '');
  const [scope, setScope] = useState<Scope>(task && !task.petId ? 'all' : 'pet');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const title = task ? 'Edit care task' : 'New care task';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSaving(true);
    const input = {
      petId: scope === 'pet' ? pet.id : undefined,
      name,
      intervalDays: Number(intervalDays),
      timeOfDay: time || undefined,
    };
    try {
      if (task) await updateCareTask(task.id, input);
      else await createCareTask(input);
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!task || !window.confirm(`Remove ${task.name}? Its history is kept.`)) return;
    try {
      await archiveCareTask(task.id);
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
    }
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Name">
          <input value={name} placeholder="Spot clean" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Repeat every (days)">
          <input type="number" inputMode="numeric" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
        </Field>
        <Field label="Time of day">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Optional. Leave it empty for any time.</div>
        <div className="label">For</div>
        <Segmented<Scope>
          label="For"
          options={[{ value: 'pet', label: pet.name }, { value: 'all', label: 'All pets' }]}
          value={scope}
          onChange={setScope}
        />
        <button type="submit" className="btn-primary" style={{ marginTop: 12 }} disabled={saving}>Save task</button>
        {task && (
          <button type="button" className="btn-ghost btn-danger" style={{ marginTop: 8 }} onClick={onRemove}>Remove task</button>
        )}
      </form>
    </Sheet>
  );
}
