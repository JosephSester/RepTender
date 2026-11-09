import { format, isValid, parse, set, startOfDay } from 'date-fns';

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

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for a real calendar date in yyyy-MM-dd form (what <input type="date"> gives). */
export function isDateKey(s: string): boolean {
  return DATE_KEY.test(s) && isValid(parseDateKey(s));
}

/** True for HH:mm (what <input type="time"> gives). */
export function isTimeOfDay(s: string): boolean {
  return TIME_OF_DAY.test(s);
}

/**
 * Date + time inputs → a local Date, or null when either is blank or invalid.
 * Forms disable Save on null instead of calling format()/toISOString() on an Invalid Date.
 */
export function combineDateTime(date: string, time: string): Date | null {
  if (!isDateKey(date) || !isTimeOfDay(time)) return null;
  return atTime(parseDateKey(date), time);
}

/** '18:00' → '6:00 PM'. Returns '' for anything that isn't HH:mm. */
export function formatTimeOfDay(hhmm: string): string {
  if (!isTimeOfDay(hhmm)) return '';
  return format(atTime(new Date(2000, 0, 1), hhmm), 'h:mm a');
}
