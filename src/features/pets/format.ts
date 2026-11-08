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
