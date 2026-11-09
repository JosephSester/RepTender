import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';
import { lastMeal, statusLabel } from '../../domain/feeding';
import { comingUp, todayItems, type ScheduleItem } from '../../domain/schedule';
import { toggleCareToday } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { formatDay } from '../feedings/logModel';
import { TONE } from '../pets/PetsHome';
import { RemindersButton } from '../reminders/RemindersButton';
import { useScheduleSources } from './scheduleSources';

type FeedingItem = Extract<ScheduleItem, { kind: 'feeding' }>;

function checkLabel(item: ScheduleItem): string {
  if (item.kind === 'care') return `${item.title} done today`;
  return item.done ? `Fed ${item.pet.name} today` : `Log feeding for ${item.pet.name}`;
}

export default function ScheduleScreen({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const data = useScheduleSources();
  const [feeding, setFeeding] = useState<FeedingItem | null>(null);
  const [error, setError] = useState<string>();
  // Task ids with a one-tap write in flight, so a double tap can't toggle twice.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  if (!data) return null;
  const today = todayItems(data.feedings, data.care, now);
  const upcoming = comingUp(data.feedings, data.care, now);
  const doneCount = today.filter((i) => i.done).length;

  const onCheck = async (item: ScheduleItem) => {
    if (item.kind === 'feeding') {
      if (!item.done) setFeeding(item);
      return;
    }
    const id = item.task.id;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setBusy(new Set(inFlight.current));
    setError(undefined);
    try {
      // The timestamp is the moment of the tap, not the last render's clock.
      await toggleCareToday(id, fixedNow ?? new Date());
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      inFlight.current.delete(id);
      setBusy(new Set(inFlight.current));
    }
  };

  return (
    <>
      <h1>Today</h1>
      <div className="muted">{`${format(now, 'EEEE, MMM d')} · ${doneCount} of ${today.length} done`}</div>
      {error && <div role="alert" className="form-error">{error}</div>}

      <Card role="region" aria-label="Today's checklist" style={{ marginTop: 12 }}>
        {today.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing due today.</p>}
        {today.map((item) => (
          <div key={item.key} className="entry" role="group" aria-label={item.title}>
            <button
              type="button"
              className="check"
              aria-pressed={item.done}
              aria-label={checkLabel(item)}
              disabled={item.kind === 'feeding' ? item.done : busy.has(item.task.id)}
              onClick={() => onCheck(item)}
            >
              {item.done ? '✓' : ''}
            </button>
            <div className="grow">
              <b>{item.title}</b>
              <div className="muted">{item.detail}</div>
            </div>
            {!item.done && <Pill tone={TONE[item.status]}>{statusLabel(item.due, now)}</Pill>}
          </div>
        ))}
      </Card>

      <section aria-label="Coming up">
        <div className="label">Coming up</div>
        {upcoming.length === 0 && <p className="muted">Nothing in the next 7 days.</p>}
        {upcoming.map((g) => {
          const day = formatDay(parseDateKey(g.day), now);
          return (
            <Card key={g.day} role="group" aria-label={day}>
              <b>{day}</b>
              {g.items.map((i) => (
                <div key={i.key} className="muted">{`${i.title} · ${i.detail}`}</div>
              ))}
            </Card>
          );
        })}
      </section>

      <div style={{ marginTop: 12 }}>
        <RemindersButton sources={data} label="📅 Add all reminders to Calendar" now={fixedNow} />
      </div>

      {feeding && (
        <LogFeedingSheet
          open
          pet={feeding.pet}
          lastMealAt={lastMeal(feeding.feedings)?.at}
          currentDue={feeding.due}
          now={now}
          onClose={() => setFeeding(null)}
        />
      )}
    </>
  );
}
