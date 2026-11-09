import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';
import { chartSeries, formatChange, latestWith, weightChange, type ChartRange } from '../../domain/growth';
import { formatLength, formatWeight, weightFromG } from '../../domain/units';
import { deleteMeasurement, listMeasurements } from '../../db/measurements';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { LineChart } from '../../ui/LineChart';
import { useNow } from '../../ui/useNow';
import { formatDateKey } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { useUnits } from '../settings/useUnits';
import LogMeasurementSheet from './LogMeasurementSheet';

const RANGES = [
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
] as const;

export default function WeightScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const units = useUnits();
  const petId = pet?.id;
  const ms = useLiveQuery(() => (petId ? listMeasurements(petId) : undefined), [petId]);
  const [range, setRange] = useState<ChartRange>('6M');
  const [adding, setAdding] = useState(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!ms || !units) return null;

  const weight = latestWith(ms, 'weightG');
  const length = latestWith(ms, 'lengthMm');
  const change = weightChange(ms, now);
  const series = chartSeries(ms, 'weightG', range, now);
  const points = series.map((m) => ({ x: parseDateKey(m.date).getTime(), y: weightFromG(m.weightG!, units.weight) }));
  const history = [...ms].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Weight & length" addLabel="Log weight or length" onAdd={() => setAdding(true)} />

      <Card style={{ marginTop: 12 }}>
        {weight || length ? (
          <div className="row">
            <div className="grow">
              {weight && <div className="big-number">{formatWeight(weight.weightG!, units.weight)}</div>}
              {weight && (
                <div className="muted">
                  {[format(parseDateKey(weight.date), 'MMM d'), change !== null && `${formatChange(change, units.weight)} in 30 days`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            {length && (
              <div style={{ textAlign: 'right' }}>
                <b>{formatLength(length.lengthMm!, units.length)}</b>
                <div className="muted">length</div>
              </div>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No weight or length logged yet.</p>
        )}
      </Card>

      <Card>
        <LineChart points={points} label={`Weight chart, ${points.length} entries`} emptyText="No weights in this range" />
        {series.length > 0 && (
          <div className="row chart-axis">
            <span className="grow">{format(parseDateKey(series[0]!.date), 'MMM d, yyyy')}</span>
            <span>{format(parseDateKey(series[series.length - 1]!.date), 'MMM d, yyyy')}</span>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
        </div>
      </Card>

      <div className="label">Entries</div>
      {history.length === 0 && <p className="muted">Nothing logged yet.</p>}
      {history.map((m) => (
        <Card key={m.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{formatDateKey(m.date)}</b>
              <div className="muted">
                {[
                  m.weightG !== undefined && formatWeight(m.weightG, units.weight),
                  m.lengthMm !== undefined && formatLength(m.lengthMm, units.length),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('entry', () => deleteMeasurement(m.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <LogMeasurementSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={now} />
    </>
  );
}
