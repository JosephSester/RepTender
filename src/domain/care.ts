import { addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
import type { CareCompletion, CareTask } from './types';
import { atTime } from './dates';

/** Upper bound for a repeat interval; larger counts overflow the Date range and crash rendering. */
export const MAX_CARE_INTERVAL_DAYS = 3650;

/** Spec §5.10 starter suggestions (one tap to add). */
export const CARE_SUGGESTIONS: readonly { name: string; intervalDays: number }[] = [
  { name: 'Spot clean', intervalDays: 1 },
  { name: 'Fresh water', intervalDays: 2 },
  { name: 'Mist', intervalDays: 2 },
  { name: 'Deep clean', intervalDays: 30 },
  { name: 'Replace UVB bulb', intervalDays: 180 },
];

export function lastCompletionAt(completions: readonly Pick<CareCompletion, 'at'>[]): string | undefined {
  let best: string | undefined;
  for (const c of completions) if (!best || Date.parse(c.at) > Date.parse(best)) best = c.at;
  return best;
}

/**
 * Spec §7 rule 9: last completion (or the task's creation date) + intervalDays, on that calendar day,
 * at timeOfDay when set. Statuses come from dueStatus()/statusLabel(), the same as feedings.
 */
export function careNextDue(
  task: Pick<CareTask, 'createdAt' | 'intervalDays' | 'timeOfDay'>,
  completions: readonly Pick<CareCompletion, 'at'>[],
): Date {
  const base = parseISO(lastCompletionAt(completions) ?? task.createdAt);
  const day = addDays(startOfDay(base), task.intervalDays);
  return task.timeOfDay ? atTime(day, task.timeOfDay) : day;
}

export function completedOn(completions: readonly Pick<CareCompletion, 'at'>[], day: Date): boolean {
  return completions.some((c) => isSameDay(parseISO(c.at), day));
}

export function everyLabel(intervalDays: number): string {
  return intervalDays === 1 ? 'Daily' : `Every ${intervalDays} days`;
}
