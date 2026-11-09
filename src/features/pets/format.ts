import { differenceInCalendarDays, format, isValid } from 'date-fns';
import { isDateKey, parseDateKey } from '../../domain/dates';

export function formatDue(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  if (!isValid(due)) return '—'; // format() throws on an Invalid Date (e.g. an overflowed interval)
  const days = differenceInCalendarDays(due, now);
  const time = format(due, 'h:mm a');
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${format(due, 'EEE, MMM d')} · ${time}`;
}

export function formatDateKey(key?: string): string {
  return key && isDateKey(key) ? format(parseDateKey(key), 'MMM d, yyyy') : '—';
}

/** "$65" for whole amounts, "$85.50" when there are cents. */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'; // an imported value can be anything; never show "$NaN"
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Calendar days back from `now`: "today", "1 day ago", "N days ago". */
export function formatDaysAgo(then: Date, now: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n <= 0) return 'today';
  return `${plural(n, 'day')} ago`;
}
