import { useState, type FormEvent } from 'react';
import type { CareTask, Pet } from '../../domain/types';
import { archiveCareTask, createCareTask, updateCareTask } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { MAX_CARE_INTERVAL_DAYS } from '../../domain/care';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { ClearButton, Field } from '../../ui/Field';
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
  const interval = Number(intervalDays);
  const intervalOk = Number.isInteger(interval) && interval >= 1 && interval <= MAX_CARE_INTERVAL_DAYS;
  const title = task ? 'Edit care task' : 'New care task';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!intervalOk) return;
    setError(undefined);
    setSaving(true);
    const input = {
      petId: scope === 'pet' ? pet.id : undefined,
      name,
      intervalDays: interval,
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
          <input type="number" inputMode="numeric" min={1} max={MAX_CARE_INTERVAL_DAYS} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
        </Field>
        {!intervalOk && <div className="form-error">{`Repeat every must be a whole number from 1 to ${MAX_CARE_INTERVAL_DAYS} days.`}</div>}
        <Field label="Time of day">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {time !== '' && <ClearButton label="Clear time" onClick={() => setTime('')} />}
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Optional. Leave it empty for any time.</div>
        <div className="label">For</div>
        <Segmented<Scope>
          label="For"
          options={[{ value: 'pet', label: pet.name }, { value: 'all', label: 'All pets' }]}
          value={scope}
          onChange={setScope}
        />
        <button type="submit" className="btn-primary" style={{ marginTop: 12 }} disabled={saving || !intervalOk}>Save task</button>
        {task && (
          <button type="button" className="btn-ghost btn-danger" style={{ marginTop: 8 }} onClick={onRemove}>Remove task</button>
        )}
      </form>
    </Sheet>
  );
}
