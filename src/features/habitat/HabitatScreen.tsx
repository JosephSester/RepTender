import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import {
  checkRange, formatTargetRange, gauge, lastDays, latestValue, targetRange, weekSummary, type Metric,
} from '../../domain/habitat';
import { formatHumidity, formatTemp, tempFromC } from '../../domain/units';
import { listHabitatReadings } from '../../db/habitat';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { LineChart } from '../../ui/LineChart';
import { useNow } from '../../ui/useNow';
import { formatDay } from '../feedings/logModel';
import { PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { useUnits } from '../settings/useUnits';
import LogHabitatSheet from './LogHabitatSheet';
import HabitatSetupSheet from './HabitatSetupSheet';

const METRICS: { metric: Metric; icon: string; name: string }[] = [
  { metric: 'warm', icon: '🔥', name: 'Warm side' },
  { metric: 'cool', icon: '❄️', name: 'Cool side' },
  { metric: 'humidity', icon: '💧', name: 'Humidity' },
];

export default function HabitatScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const units = useUnits();
  const petId = pet?.id;
  const readings = useLiveQuery(() => (petId ? listHabitatReadings(petId) : undefined), [petId]);
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!readings || !units) return null;

  const targets = pet.habitatTargets ?? {};
  const last = readings[readings.length - 1];
  const show = (metric: Metric, v: number) => (metric === 'humidity' ? formatHumidity(v) : formatTemp(v, units.temp));
  const subtitle = [
    pet.enclosureLabel ?? 'No enclosure label',
    last ? `last reading ${formatDay(parseISO(last.at), now)}, ${format(parseISO(last.at), 'h:mm a')}` : 'no readings yet',
  ].join(' · ');
  const warmRange = targetRange(targets, 'warm');
  const week = lastDays(readings, 'warm', now);
  const band =
    warmRange.min !== undefined && warmRange.max !== undefined
      ? { min: tempFromC(warmRange.min, units.temp), max: tempFromC(warmRange.max, units.temp) }
      : undefined;

  return (
    <>
      <SubScreenHeader pet={pet} title="Habitat" subtitle={subtitle} addLabel="Log a reading" onAdd={() => setLogging(true)} />
      <button type="button" className="btn" style={{ margin: '8px 0' }} onClick={() => setEditing(true)}>
        Edit enclosure & targets
      </button>

      {METRICS.map(({ metric, icon, name }) => {
        const latest = latestValue(readings, metric);
        const range = targetRange(targets, metric);
        const check = latest ? checkRange(latest.value, range) : 'unset';
        const g = latest ? gauge(latest.value, range) : undefined;
        return (
          <Card key={metric} role="group" aria-label={name}>
            <div className="row">
              <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>
              <div className="grow">
                <b>{name}</b>
                <div className="muted">{formatTargetRange(metric, range, units.temp)}</div>
              </div>
              {check === 'low' && <Pill tone="late">Too low</Pill>}
              {check === 'high' && <Pill tone="late">Too high</Pill>}
              <div className="big-number" style={{ fontSize: 22 }}>{latest ? show(metric, latest.value) : '—'}</div>
            </div>
            {g && (
              <div className="gauge" aria-hidden="true">
                {g.band && <i className="gauge-band" style={{ left: `${g.band.start}%`, width: `${g.band.end - g.band.start}%` }} />}
                <i className="gauge-mark" style={{ left: `${g.marker}%` }} />
              </div>
            )}
          </Card>
        );
      })}

      <div className="label">Last 7 days · warm side</div>
      <Card>
        <LineChart
          points={week.map((r) => ({ x: Date.parse(r.at), y: tempFromC(r.warmC!, units.temp) }))}
          label={`Warm side, last 7 days, ${week.length} readings`}
          band={band}
          emptyText="No warm-side readings this week"
        />
        {week.length > 0 && <div className="muted" style={{ marginTop: 6 }}>{weekSummary(week.map((r) => r.warmC!), warmRange)}</div>}
      </Card>

      <button type="button" className="btn-primary" onClick={() => setLogging(true)}>
        <span aria-hidden="true">＋ </span>Log a new reading
      </button>

      <LogHabitatSheet pet={pet} open={logging} onClose={() => setLogging(false)} now={now} />
      <HabitatSetupSheet pet={pet} open={editing} onClose={() => setEditing(false)} now={now} />
    </>
  );
}
