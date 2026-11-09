import { differenceInCalendarDays, format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';

export function formatDue(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  const days = differenceInCalendarDays(due, now);
  const time = format(due, 'h:mm a');
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${format(due, 'EEE, MMM d')} · ${time}`;
}

export function formatDateKey(key?: string): string {
  return key ? format(parseDateKey(key), 'MMM d, yyyy') : '—';
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Calendar days back from `now`: "today", "1 day ago", "N days ago". */
export function formatDaysAgo(then: Date, now: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n <= 0) return 'today';
  return `${plural(n, 'day')} ago`;
}
