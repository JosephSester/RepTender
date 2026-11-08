import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { Pet } from '../../domain/types';
import { atTime, dateKey, parseDateKey } from '../../domain/dates';
import { DEFAULT_PUSH_BACK_DAYS } from '../../domain/feeding';
import { logFeeding } from '../../db/feedings';
import { addFoodItem, listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { Segmented } from '../../ui/Segmented';
import { PetAvatar } from '../../ui/PetAvatar';
import { formatDay, previewNextDue, type LogOutcome } from './logModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  lastMealAt?: string;
  currentDue: Date | null;
  now?: Date;
}

function daysAgo(now: Date, then: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n === 0) return 'today';
  return `${n} day${n === 1 ? '' : 's'} ago`;
}

const OUTCOMES = [
  { value: 'ate', label: 'Ate it' },
  { value: 'refused', label: 'Refused' },
  { value: 'regurgitated', label: 'Regurgitated' },
] as const;

export default function LogFeedingSheet(props: Props) {
  // Remount the form each time the sheet opens so it starts from fresh defaults.
  if (!props.open) return null;
  return <LogFeedingForm {...props} />;
}

function LogFeedingForm({ pet, open, onClose, lastMealAt, currentDue, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [foodItem, setFoodItem] = useState(pet.usualFoodItem ?? '');
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherFood, setOtherFood] = useState('');
  const [quantity, setQuantity] = useState(pet.usualQuantity);
  const [outcome, setOutcome] = useState<LogOutcome>('ate');
  const [foundDate, setFoundDate] = useState(dateKey(now));
  const [foundTime, setFoundTime] = useState(format(now, 'HH:mm'));
  const [pushBack, setPushBack] = useState(true);
  const [pushBackDays, setPushBackDays] = useState(String(DEFAULT_PUSH_BACK_DAYS));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!foodItem && foods?.length) setFoodItem(foods[0]!.name);
  }, [foods, foodItem]);

  const at = atTime(parseDateKey(date), time);
  const foundAt = atTime(parseDateKey(foundDate), foundTime);
  const datesValid = isValid(at) && (outcome !== 'regurgitated' || isValid(foundAt));
  const preview = previewNextDue({
    pet, outcome, at, foundAt, pushBack, pushBackDays: Number(pushBackDays), currentDue,
  });
  const lastMeal = lastMealAt ? parseISO(lastMealAt) : undefined;
  const ordered = foods
    ? [...foods].sort((a, b) => Number(b.name === pet.usualFoodItem) - Number(a.name === pet.usualFoodItem))
    : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!datesValid) return;
    setError(undefined);
    setSaving(true);
    try {
      const food = otherOpen ? (await addFoodItem(otherFood)).name : foodItem;
      await logFeeding({
        petId: pet.id,
        at: at.toISOString(),
        foodItem: food,
        quantity,
        outcome: outcome === 'refused' ? 'refused' : 'ate',
        notes,
        regurgitated:
          outcome === 'regurgitated'
            ? { foundAt: foundAt.toISOString(), pushBackDays: pushBack ? Number(pushBackDays) : null }
            : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Feed ${pet.name}`}>
      <form onSubmit={onSubmit} noValidate>
        <div className="row">
          <PetAvatar photoId={pet.photoId} species={pet.species} size={40} />
          <div>
            <div className="rounded" style={{ fontSize: 18 }}>{`Feed ${pet.name}`}</div>
            <div className="muted">
              {lastMeal ? `Last fed ${format(lastMeal, 'MMM d')} · ${daysAgo(now, lastMeal)}` : 'No meals logged yet'}
            </div>
          </div>
        </div>

        {error && <div role="alert" className="form-error">{error}</div>}

        <div className="label">When</div>
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>

        <div className="label">What did it eat?</div>
        <div className="chips">
          {ordered.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${!otherOpen && foodItem === f.name ? 'on' : ''}`}
              aria-pressed={!otherOpen && foodItem === f.name}
              onClick={() => { setFoodItem(f.name); setOtherOpen(false); }}
            >
              {f.name}
            </button>
          ))}
          <button type="button" className={`chip ${otherOpen ? 'on' : ''}`} aria-pressed={otherOpen} onClick={() => setOtherOpen(true)}>
            + Other
          </button>
        </div>
        {otherOpen && (
          <label className="field" style={{ marginTop: 8 }}>
            <span>Other food</span>
            <input value={otherFood} onChange={(e) => setOtherFood(e.target.value)} autoFocus />
          </label>
        )}

        <div className="label">How many?</div>
        <div className="field"><span>Quantity</span><Stepper label="quantity" value={quantity} onChange={setQuantity} /></div>

        <div className="label">How did it go?</div>
        <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />

        {outcome === 'regurgitated' && (
          <div style={{ marginTop: 10 }}>
            <label className="field"><span>Found date</span><input type="date" value={foundDate} onChange={(e) => setFoundDate(e.target.value)} /></label>
            <label className="field"><span>Found time</span><input type="time" value={foundTime} onChange={(e) => setFoundTime(e.target.value)} /></label>
            <label className="field">
              <span>Push next feeding back?</span>
              <input type="checkbox" className="switch" checked={pushBack} onChange={(e) => setPushBack(e.target.checked)} />
            </label>
            {pushBack && (
              <label className="field">
                <span>Push back (days)</span>
                <input type="number" inputMode="numeric" min={1} value={pushBackDays} onChange={(e) => setPushBackDays(e.target.value)} />
              </label>
            )}
            <div className="muted" style={{ fontSize: 13 }}>Keepers usually wait 10–14 days, then offer a smaller meal.</div>
          </div>
        )}

        <label className="field stack" style={{ marginTop: 10 }}>
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button type="submit" className="btn-primary" disabled={saving || !datesValid}>Save feeding</button>
        <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {`Next feeding → ${formatDay(preview, now)}`}
        </div>
      </form>
    </Sheet>
  );
}
