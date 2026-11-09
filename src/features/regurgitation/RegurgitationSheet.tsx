import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { DEFAULT_PUSH_BACK_DAYS, isValidPushBackDays, MAX_PUSH_BACK_DAYS, nextFeedingDue, pushBackOverride } from '../../domain/feeding';
import { listFeedings, listRegurgitations, logRegurgitation } from '../../db/feedings';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { foodIcon } from '../feedings/foodIcon';
import { formatDay } from '../feedings/logModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

const mealWhen = (at: string) => format(parseISO(at), 'MMM d · h:mm a');

/** Spec §5.5: a regurgitation found after the meal was already logged. */
export default function RegurgitationSheet(props: Props) {
  // Remount the form each time the sheet opens so it starts from fresh defaults.
  if (!props.open) return null;
  return <RegurgitationForm {...props} />;
}

function RegurgitationForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const data = useLiveQuery(
    async () => ({ feedings: await listFeedings(pet.id), regurgitations: await listRegurgitations(pet.id) }),
    [pet.id],
  );
  const [picked, setPicked] = useState<string>();
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [pushBack, setPushBack] = useState(true);
  const [pushBackDays, setPushBackDays] = useState(String(DEFAULT_PUSH_BACK_DAYS));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const feedings = data?.feedings ?? [];
  const alreadyLogged = new Set(data?.regurgitations.map((r) => r.feedingId));
  // listFeedings is oldest first: the last 5 eaten meals, most recent first.
  const meals = feedings.filter((f) => f.outcome === 'ate').reverse().slice(0, 5);
  const selected = meals.find((m) => m.id === picked) ?? meals[0];
  const foundAt = combineDateTime(date, time);
  const days = Number(pushBackDays);
  const daysValid = !pushBack || isValidPushBackDays(days);
  const beforeMeal = !!foundAt && !!selected && foundAt.getTime() < Date.parse(selected.at);
  const canSave = !!selected && !!foundAt && daysValid && !beforeMeal && !saving;
  let preview: Date | null = null;
  if (foundAt && daysValid) {
    preview = pushBack ? new Date(pushBackOverride(foundAt, pet, days)) : nextFeedingDue(pet, feedings);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !selected || !foundAt) return;
    setError(undefined);
    setSaving(true);
    try {
      await logRegurgitation({
        petId: pet.id,
        feedingId: selected.id,
        at: foundAt.toISOString(),
        pushBackDays: pushBack ? days : null,
        notes,
      });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log regurgitation">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Regurgitation" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}

        <div className="label">Which meal came back up?</div>
        {data && meals.length === 0 && (
          <p className="muted">No eaten meals logged yet. Log the feeding first.</p>
        )}
        <div className="pick-list">
          {meals.map((m) => {
            const on = m.id === selected?.id;
            return (
              <button
                key={m.id}
                type="button"
                className="pick"
                aria-pressed={on}
                aria-label={`${mealWhen(m.at)}, ${m.quantity} ${m.foodItem}`}
                onClick={() => setPicked(m.id)}
              >
                <span className="pick-check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="grow">
                  <b>{mealWhen(m.at)}</b>
                  <span className="muted">
                    {`${foodIcon(m.foodItem)} ${m.quantity} ${m.foodItem}`}
                    {alreadyLogged.has(m.id) ? ' · already logged' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="label">When was it found?</div>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} dateLabel="Found date" timeLabel="Found time" />
        {beforeMeal && <div className="form-error">Found time is before that meal.</div>}
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <Field label="Push next feeding back?">
          <input type="checkbox" className="switch" checked={pushBack} onChange={(e) => setPushBack(e.target.checked)} />
        </Field>
        {pushBack && (
          <Field label="Push back (days)">
            <input type="number" inputMode="numeric" min={1} max={MAX_PUSH_BACK_DAYS} value={pushBackDays} onChange={(e) => setPushBackDays(e.target.value)} />
          </Field>
        )}
        {!daysValid && <div className="form-error">{`Push back must be a whole number from 1 to ${MAX_PUSH_BACK_DAYS} days.`}</div>}
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Keepers usually wait 10–14 days, then offer a smaller meal.
        </div>

        <button type="submit" className="btn-primary" disabled={!canSave}>Save regurgitation</button>
        <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {`Next feeding → ${formatDay(preview, now)}`}
        </div>
      </form>
    </Sheet>
  );
}
