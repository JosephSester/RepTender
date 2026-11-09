import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isValid } from 'date-fns';
import type { CareTask } from '../../domain/types';
import { careEvent, careEventStart } from '../../domain/reminders';
import { deliverFile } from '../../lib/deliver';
import { calendarFile, REMINDER_FILE } from '../reminders/calendarFile';
import { formatTimeOfDay } from '../../domain/dates';
import { dueStatus, statusLabel } from '../../domain/feeding';
import { CARE_SUGGESTIONS, careNextDue, completedOn, everyLabel } from '../../domain/care';
import { createCareTask, listCareTasks, listCompletions, toggleCareToday } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import { TONE } from '../pets/PetsHome';
import { PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import CareTaskSheet from './CareTaskSheet';

export default function CareTasksScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const rows = useLiveQuery(async () => {
    if (!petId) return undefined;
    const tasks = await listCareTasks(petId);
    return Promise.all(tasks.map(async (task) => ({ task, completions: await listCompletions(task.id) })));
  }, [petId]);
  const [editing, setEditing] = useState<CareTask | 'new' | null>(null);
  const [error, setError] = useState<string>();
  // Keys of one-tap writes still in flight (a task id, or a suggestion name), so a double tap can't repeat them.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!rows) return null;

  const run = async (key: string, action: () => Promise<unknown>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      inFlight.current.delete(key);
      setBusy(new Set(inFlight.current));
    }
  };
  const names = new Set(rows.map(({ task }) => task.name.toLowerCase()));
  const suggestions = CARE_SUGGESTIONS.filter((s) => !names.has(s.name.toLowerCase()));

  return (
    <>
      <SubScreenHeader pet={pet} title="Care tasks" addLabel="New care task" onAdd={() => setEditing('new')} />
      {error && <div role="alert" className="form-error">{error}</div>}
      <div style={{ marginTop: 12 }} />
      {rows.length === 0 && <p className="muted">No care tasks yet. Add one, or start from a suggestion below.</p>}

      {rows.map(({ task, completions }) => {
        const due = careNextDue(task, completions);
        const done = completedOn(completions, now);
        const time = task.timeOfDay ? formatTimeOfDay(task.timeOfDay) : '';
        return (
          <Card key={task.id} role="article" aria-label={task.name}>
            <div className="row">
              <button
                type="button"
                className="check"
                aria-pressed={done}
                aria-label={`${task.name} done today`}
                disabled={busy.has(task.id)}
                // The timestamp is the moment of the tap, not the last render's clock.
                onClick={() => run(task.id, () => toggleCareToday(task.id, fixedNow ?? new Date()))}
              >
                {done ? '✓' : ''}
              </button>
              <div className="grow">
                <b>{task.name}</b>
                <div className="muted">
                  {[everyLabel(task.intervalDays), time, !task.petId && 'All pets'].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Pill tone={TONE[dueStatus(due, now)]}>{statusLabel(due, now)}</Pill>
              {isValid(due) && careEventStart(task, due).getTime() > now.getTime() && (
                <button
                  type="button"
                  className="btn"
                  aria-label={`Add ${task.name} to Calendar`}
                  disabled={busy.has(`cal-${task.id}`)}
                  // deliverFile runs synchronously inside the tap (iOS needs the gesture for the share sheet).
                  onClick={() =>
                    run(`cal-${task.id}`, async () => {
                      try {
                        await deliverFile(calendarFile([careEvent(task, task.petId ? pet.name : undefined, due)], REMINDER_FILE));
                      } catch {
                        setError("Couldn't create the calendar event.");
                      }
                    })
                  }
                >
                  📅
                </button>
              )}
              <button type="button" className="btn" onClick={() => setEditing(task)}>Edit</button>
            </div>
          </Card>
        );
      })}

      {suggestions.length > 0 && (
        <>
          <div className="label">Starter suggestions</div>
          <div className="chips">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                className="chip"
                disabled={busy.has(s.name)}
                onClick={() => run(s.name, () => createCareTask({ petId: pet.id, name: s.name, intervalDays: s.intervalDays }))}
              >
                {`+ ${s.name} (${everyLabel(s.intervalDays).toLowerCase()})`}
              </button>
            ))}
          </div>
        </>
      )}

      <CareTaskSheet
        pet={pet}
        open={editing !== null}
        task={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
