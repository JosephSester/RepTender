import { addDays, differenceInCalendarDays, format, isValid } from 'date-fns';
import type { Pet } from '../../domain/types';
import { atTime, DEFAULT_FEED_TIME } from '../../domain/dates';
import { isValidPushBackDays, pushBackOverride } from '../../domain/feeding';

export type LogOutcome = 'ate' | 'refused' | 'regurgitated';

/** What the next feeding will be after saving this entry (spec §5.3 footer). */
export function previewNextDue(args: {
  pet: Pick<Pet, 'feedingIntervalDays' | 'usualFeedTime'>;
  outcome: LogOutcome;
  at: Date;
  foundAt: Date;
  pushBack: boolean;
  pushBackDays: number;
  currentDue: Date | null;
}): Date | null {
  const { pet, outcome, at, foundAt, pushBack, pushBackDays, currentDue } = args;
  if (outcome === 'refused') return currentDue;
  if (outcome === 'regurgitated' && pushBack) {
    // pushBackOverride throws on an invalid date, and on a day count that overflows the Date range.
    if (!isValid(foundAt) || !isValidPushBackDays(pushBackDays)) return null;
    return new Date(pushBackOverride(foundAt, pet, pushBackDays));
  }
  return atTime(addDays(at, pet.feedingIntervalDays), pet.usualFeedTime ?? DEFAULT_FEED_TIME);
}

export function formatDay(d: Date | null, now: Date): string {
  if (!d || !isValid(d)) return '—';
  const days = differenceInCalendarDays(d, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}
