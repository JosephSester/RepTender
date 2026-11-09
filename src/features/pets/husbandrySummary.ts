import { format, parseISO } from 'date-fns';
import type {
  CareCompletion, CareTask, HabitatReading, Measurement, Note, Poop, Shed, VetVisit,
} from '../../domain/types';
import { parseDateKey } from '../../domain/dates';
import { dueStatus } from '../../domain/feeding';
import { careNextDue } from '../../domain/care';
import { formatChange, latestWith, weightChange } from '../../domain/growth';
import { latestValue } from '../../domain/habitat';
import { poopKindLabel } from '../../domain/poop';
import { shedQualityLabel } from '../../domain/sheds';
import { formatHumidity, formatLength, formatTemp, formatWeight, type Units } from '../../domain/units';
import { plural } from './format';

export interface HusbandryData {
  sheds: Shed[];
  poops: Poop[];
  measurements: Measurement[];
  readings: HabitatReading[];
  tasks: CareTask[];
  completions: CareCompletion[];
  visits: VetVisit[];
  notes: Note[];
}

export type TileKey = 'sheds' | 'poop' | 'weight' | 'habitat' | 'care' | 'vet' | 'notes';

function latestBy<T>(items: readonly T[], key: (item: T) => string): T | undefined {
  return [...items].sort((a, b) => key(a).localeCompare(key(b))).at(-1);
}

const shortDay = (key: string) => format(parseDateKey(key), 'MMM d');

/** The summary line under each Husbandry tile on the profile (mockup ①). */
export function husbandryTiles(d: HusbandryData, units: Units, now: Date): Record<TileKey, string> {
  const shed = latestBy(d.sheds, (s) => s.date);
  const poop = latestBy(d.poops, (p) => p.at);
  const weight = latestWith(d.measurements, 'weightG');
  const length = latestWith(d.measurements, 'lengthMm');
  const change = weightChange(d.measurements, now);
  const warm = latestValue(d.readings, 'warm');
  const humidity = latestValue(d.readings, 'humidity');
  const visit = latestBy(d.visits, (v) => v.date);

  let late = 0;
  let dueToday = 0;
  for (const t of d.tasks) {
    const status = dueStatus(careNextDue(t, d.completions.filter((c) => c.taskId === t.id)), now);
    if (status === 'late') late++;
    else if (status === 'today') dueToday++;
  }

  let weightLine = 'No entries yet';
  if (weight) {
    weightLine = [formatWeight(weight.weightG!, units.weight), change !== null && formatChange(change, units.weight)]
      .filter(Boolean)
      .join(' · ');
  } else if (length) {
    weightLine = formatLength(length.lengthMm!, units.length);
  }
  const habitat = [warm && formatTemp(warm.value, units.temp), humidity && `${formatHumidity(humidity.value)} RH`].filter(Boolean);
  let care = 'No tasks yet';
  if (d.tasks.length > 0) {
    care = late || dueToday
      ? [late && `${late} late`, dueToday && `${dueToday} due today`].filter(Boolean).join(' · ')
      : 'All caught up';
  }

  return {
    sheds: shed ? `Last: ${shortDay(shed.date)} · ${shedQualityLabel(shed.quality).toLowerCase()}` : 'No sheds yet',
    poop: poop ? `Last: ${format(parseISO(poop.at), 'MMM d')} · ${poopKindLabel(poop.kind).toLowerCase()}` : 'None logged',
    weight: weightLine,
    habitat: habitat.length > 0 ? habitat.join(' · ') : 'No readings yet',
    care,
    vet: visit ? [shortDay(visit.date), visit.reason].filter(Boolean).join(' · ') : 'No visits yet',
    notes: d.notes.length > 0 ? plural(d.notes.length, 'note') : 'No notes yet',
  };
}

/** Spec §5.2 item 7: length and weight in the stats grid come from the latest measurement. */
export function sizeStats(ms: readonly Measurement[], units: Units): { length: string; weight: string } {
  const weight = latestWith(ms, 'weightG');
  const length = latestWith(ms, 'lengthMm');
  return {
    length: length ? formatLength(length.lengthMm!, units.length) : '—',
    weight: weight ? formatWeight(weight.weightG!, units.weight) : '—',
  };
}
