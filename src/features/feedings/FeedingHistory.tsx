import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Feeding } from '../../domain/types';
import { buildMonthMarks } from '../../domain/calendar';
import { dateKey, parseDateKey } from '../../domain/dates';
import { nextFeedingDue } from '../../domain/feeding';
import { deleteFeeding } from '../../db/feedings';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { useNow } from '../../ui/useNow';
import { usePetDetail } from '../pets/usePetDetail';
import EditFeedingSheet from './EditFeedingSheet';
import { foodIcon } from './foodIcon';

export default function FeedingHistory({ now: fixedNow }: { now?: Date }) {
  const { id } = useParams();
  const now = useNow(fixedNow);
  const detail = usePetDetail(id);
  const [month, setMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const [selectedKey, setSelectedKey] = useState<string>();
  const [editing, setEditing] = useState<Feeding | null>(null);

  if (!detail) return null;
  const { pet, feedings, regurgitations } = detail;
  if (!pet) return <Card><h2>Pet not found</h2><Link to="/">Back to My Reptiles</Link></Card>;

  const regurgitated = new Set(regurgitations.map((r) => r.feedingId));
  const marks = buildMonthMarks({
    ...month, feedings, regurgitations,
    nextDue: nextFeedingDue(pet, feedings), intervalDays: pet.feedingIntervalDays, now,
  });
  const byDay = new Map<string, Feeding[]>();
  for (const f of feedings) {
    const key = dateKey(parseISO(f.at));
    byDay.set(key, [...(byDay.get(key) ?? []), f]);
  }
  const shown = feedings
    .filter((f) => {
      const d = parseISO(f.at);
      return selectedKey
        ? dateKey(d) === selectedKey
        : d.getFullYear() === month.year && d.getMonth() === month.month;
    })
    .reverse();
  const shift = (delta: number) => {
    setSelectedKey(undefined);
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const outcomeText = (f: Feeding) =>
    f.outcome === 'refused' ? 'Refused' : regurgitated.has(f.id) ? 'Regurgitated' : 'Ate it';

  async function onDelete(f: Feeding) {
    if (!window.confirm('Delete this feeding? This can’t be undone.')) return;
    await deleteFeeding(f.id);
  }

  return (
    <>
      <div className="topbar"><Link to={`/pets/${pet.id}`}>‹ {pet.name}</Link></div>
      <h1>Feedings</h1>
      <Card>
        <MonthCalendar
          {...month}
          size="large"
          marks={marks}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          selectedKey={selectedKey}
          onSelectDay={(key) => setSelectedKey((k) => (k === key ? undefined : key))}
          dayIcon={(key) => {
            const meal = byDay.get(key)?.find((f) => f.outcome === 'ate');
            return meal ? foodIcon(meal.foodItem) : undefined;
          }}
        />
        <CalendarLegend />
      </Card>

      <div className="label">
        {selectedKey ? format(parseDateKey(selectedKey), 'EEE, MMM d') : `All in ${format(new Date(month.year, month.month, 1), 'MMMM')}`}
      </div>
      {shown.length === 0 && <p className="muted">No feedings logged.</p>}
      {shown.map((f) => (
        <Card key={f.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{format(parseISO(f.at), 'EEE, MMM d · h:mm a')}</b>
              <div className="muted">{`${foodIcon(f.foodItem)} ${f.quantity} ${f.foodItem} · ${outcomeText(f)}`}</div>
              {f.notes && <div style={{ marginTop: 4 }}>{f.notes}</div>}
            </div>
            <Pill tone={outcomeText(f) === 'Ate it' ? 'ok' : 'late'}>{outcomeText(f)}</Pill>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(f)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(f)}>Delete</button>
          </div>
        </Card>
      ))}

      {editing && <EditFeedingSheet feeding={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
