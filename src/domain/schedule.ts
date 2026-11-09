import { differenceInCalendarDays, isSameDay, isValid, parseISO } from 'date-fns';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { dateKey } from './dates';
import { dueStatus, nextFeedingDue, type DueStatus } from './feeding';
import { careNextDue, completedOn, everyLabel } from './care';

export interface FeedingSource {
  pet: Pet;
  feedings: readonly Feeding[];
}

export interface CareSource {
  task: CareTask;
  /** Undefined for an All-pets task. */
  pet?: Pet;
  completions: readonly CareCompletion[];
}

interface ItemBase {
  key: string;
  title: string;
  detail: string;
  due: Date | null;
  status: DueStatus;
  /** Fed (ate) today, or the care task was completed today. */
  done: boolean;
}

export type ScheduleItem =
  | (ItemBase & { kind: 'feeding'; pet: Pet; feedings: readonly Feeding[] })
  | (ItemBase & { kind: 'care'; task: CareTask; pet?: Pet; completions: readonly CareCompletion[] });

function feedingItem({ pet, feedings }: FeedingSource, now: Date): ScheduleItem {
  const due = nextFeedingDue(pet, feedings);
  return {
    kind: 'feeding', key: `feed-${pet.id}`, pet, feedings,
    title: `Feed ${pet.name}`,
    detail: pet.usualFoodItem ? `${pet.usualQuantity} ${pet.usualFoodItem}` : 'Feeding',
    due, status: dueStatus(due, now),
    done: feedings.some((f) => f.outcome === 'ate' && isSameDay(parseISO(f.at), now)),
  };
}

function careItem({ task, pet, completions }: CareSource, now: Date): ScheduleItem {
  const due = careNextDue(task, completions);
  return {
    kind: 'care', key: `care-${task.id}`, task, pet, completions,
    title: task.name,
    detail: `${pet?.name ?? 'All pets'} · ${everyLabel(task.intervalDays).toLowerCase()}`,
    due, status: dueStatus(due, now),
    done: completedOn(completions, now),
  };
}

const RANK: Record<DueStatus, number> = { late: 0, today: 1, soon: 2 };

function byUrgency(a: ScheduleItem, b: ScheduleItem): number {
  return (
    Number(a.done) - Number(b.done) ||
    RANK[a.status] - RANK[b.status] ||
    (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0) ||
    a.title.localeCompare(b.title)
  );
}

function allItems(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): ScheduleItem[] {
  return [...feedings.map((f) => feedingItem(f, now)), ...care.map((c) => careItem(c, now))];
}

/** Spec §5.13 "Today": due or late (not done yet), plus whatever was done today. */
export function todayItems(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): ScheduleItem[] {
  return allItems(feedings, care, now)
    .filter((i) => i.done || i.status !== 'soon')
    .sort(byUrgency);
}

/** Spec §8 app badge: the late or due-today items still open on today's checklist. */
export function badgeCount(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): number {
  return todayItems(feedings, care, now).filter((i) => !i.done).length;
}

export interface DayGroup {
  day: string; // yyyy-MM-dd
  items: ScheduleItem[];
}

/** Spec §5.13 "Coming up": each item's next occurrence in the next `days` days, grouped by day. */
export function comingUp(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date, days = 7): DayGroup[] {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of allItems(feedings, care, now)) {
    if (!item.due || !isValid(item.due)) continue; // an out-of-range stored interval must not crash Schedule
    const inDays = differenceInCalendarDays(item.due, now);
    if (inDays < 1 || inDays > days) continue;
    const key = dateKey(item.due);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items: items.sort(byUrgency) }));
}
