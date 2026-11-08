import { format, parse, set, startOfDay } from 'date-fns';

export const DEFAULT_FEED_TIME = '18:00';

export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseDateKey(key: string): Date {
  return parse(key, 'yyyy-MM-dd', new Date());
}

export function atTime(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return set(startOfDay(day), { hours, minutes });
}
