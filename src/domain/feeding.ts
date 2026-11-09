import { addDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import type { Feeding, Pet } from './types';
import { atTime, DEFAULT_FEED_TIME } from './dates';

export type DueStatus = 'late' | 'today' | 'soon';
export const DEFAULT_PUSH_BACK_DAYS = 10;
/** Upper bound for a push-back; larger counts overflow the Date range and crash rendering. */
export const MAX_PUSH_BACK_DAYS = 365;

export const isValidPushBackDays = (days: number): boolean =>
  Number.isInteger(days) && days >= 1 && days <= MAX_PUSH_BACK_DAYS;

/** Upper bound for a pet's feeding interval, for the same reason as MAX_PUSH_BACK_DAYS. */
export const MAX_FEEDING_INTERVAL_DAYS = 365;

export const isValidFeedingInterval = (days: number): boolean =>
  Number.isInteger(days) && days >= 1 && days <= MAX_FEEDING_INTERVAL_DAYS;

type SchedulePet = Pick<Pet, 'feedingIntervalDays' | 'usualFeedTime' | 'nextFeedingOverride'>;

/** Most recent feeding the pet actually ate. Refusals never count. */
export function lastMeal(feedings: readonly Feeding[]): Feeding | undefined {
  let best: Feeding | undefined;
  for (const f of feedings) {
    if (f.outcome === 'ate' && (!best || Date.parse(f.at) > Date.parse(best.at))) best = f;
  }
  return best;
}

/** Spec §7 rules 2–4. Null means no meals yet ("due now"). */
export function nextFeedingDue(pet: SchedulePet, feedings: readonly Feeding[]): Date | null {
  const meal = lastMeal(feedings);
  const override = pet.nextFeedingOverride ? parseISO(pet.nextFeedingOverride) : undefined;
  if (override && (!meal || override.getTime() > Date.parse(meal.at))) return override;
  if (!meal) return null;
  return atTime(addDays(parseISO(meal.at), pet.feedingIntervalDays), pet.usualFeedTime ?? DEFAULT_FEED_TIME);
}

export function dueStatus(due: Date | null, now: Date): DueStatus {
  if (!due) return 'today';
  if (!isValid(due)) return 'soon'; // an overflowed due date is "far away", never late
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return 'late';
  return days === 0 ? 'today' : 'soon';
}

export function statusLabel(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  if (!isValid(due)) return '—';
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** 0..1 share of the current feeding interval that has passed (drives the card's progress bar). */
export function intervalProgress(meal: Feeding | undefined, due: Date | null, now: Date): number {
  if (!meal || !due) return 1;
  const start = Date.parse(meal.at);
  const end = due.getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function pushBackOverride(
  regurgitatedAt: Date,
  pet: Pick<Pet, 'usualFeedTime'>,
  days: number = DEFAULT_PUSH_BACK_DAYS,
): string {
  return atTime(addDays(regurgitatedAt, days), pet.usualFeedTime ?? DEFAULT_FEED_TIME).toISOString();
}
