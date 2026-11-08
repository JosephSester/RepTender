import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Feeding, FeedingOutcome } from '../../domain/types';
import { atTime, dateKey, parseDateKey } from '../../domain/dates';
import { updateFeeding } from '../../db/feedings';
import { listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { Segmented } from '../../ui/Segmented';

const OUTCOMES = [
  { value: 'ate', label: 'Ate it' },
  { value: 'refused', label: 'Refused' },
] as const;

export default function EditFeedingSheet({ feeding, onClose }: { feeding: Feeding; onClose: () => void }) {
  const at = parseISO(feeding.at);
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [date, setDate] = useState(dateKey(at));
  const [time, setTime] = useState(format(at, 'HH:mm'));
  const [foodItem, setFoodItem] = useState(feeding.foodItem);
  const [quantity, setQuantity] = useState(feeding.quantity);
  const [outcome, setOutcome] = useState<FeedingOutcome>(feeding.outcome);
  const [notes, setNotes] = useState(feeding.notes ?? '');
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await updateFeeding(feeding.id, {
        at: atTime(parseDateKey(date), time).toISOString(),
        foodItem, quantity, outcome, notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
    }
  }

  const foodNames = foods?.map((f) => f.name) ?? [];
  if (!foodNames.includes(feeding.foodItem)) foodNames.unshift(feeding.foodItem);

  return (
    <Sheet open onClose={onClose} title="Edit feeding">
      <form onSubmit={onSubmit} noValidate>
        <div className="rounded" style={{ fontSize: 18, marginBottom: 8 }}>Edit feeding</div>
        {error && <div role="alert" className="form-error">{error}</div>}
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field">
          <span>Food</span>
          <select value={foodItem} onChange={(e) => setFoodItem(e.target.value)}>
            {foodNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="field"><span>Quantity</span><Stepper label="quantity" value={quantity} onChange={setQuantity} /></div>
        <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
        <label className="field stack" style={{ marginTop: 10 }}>
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">Save changes</button>
      </form>
    </Sheet>
  );
}
