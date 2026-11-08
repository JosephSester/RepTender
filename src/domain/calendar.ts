import { addDays, getDay, getDaysInMonth, parseISO } from 'date-fns';
import type { Feeding, Regurgitation } from './types';
import { dateKey } from './dates';

export type DayMark = 'ate' | 'refused' | 'regurgitated' | 'nextDue' | 'planned' | 'today';

/** Days of the month, padded at the start with nulls so index 0 is a Sunday. */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const cells: (Date | null)[] = Array.from({ length: getDay(first) }, () => null);
  for (let day = 1; day <= getDaysInMonth(first); day++) cells.push(new Date(year, month, day));
  return cells;
}

export interface MonthMarkInput {
  year: number;
  month: number;
  feedings: readonly Feeding[];
  regurgitations: readonly Regurgitation[];
  nextDue: Date | null;
  intervalDays: number;
  now: Date;
  plannedCount?: number;
}

/** Spec §7 rule 6. */
export function buildMonthMarks(input: MonthMarkInput): Map<string, Set<DayMark>> {
  const { year, month, feedings, regurgitations, nextDue, intervalDays, now, plannedCount = 3 } = input;
  const marks = new Map<string, Set<DayMark>>();
  const add = (d: Date, mark: DayMark) => {
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = dateKey(d);
    let set = marks.get(key);
    if (!set) marks.set(key, (set = new Set()));
    set.add(mark);
  };

  const regurgitated = new Set(regurgitations.map((r) => r.feedingId));
  for (const f of feedings) {
    const mark: DayMark =
      f.outcome === 'refused' ? 'refused' : regurgitated.has(f.id) ? 'regurgitated' : 'ate';
    add(parseISO(f.at), mark);
  }
  if (nextDue) {
    add(nextDue, 'nextDue');
    for (let k = 1; k <= plannedCount; k++) add(addDays(nextDue, k * intervalDays), 'planned');
  }
  add(now, 'today');
  return marks;
}
