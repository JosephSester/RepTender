import { buildIcs, type CalendarEvent } from '../../domain/ics';

export const REMINDER_FILE = 'reptender-reminder.ics';
export const ALL_REMINDERS_FILE = 'reptender-reminders.ics';

/** The .ics file handed to Calendar (spec §8). Built synchronously so it can be shared inside a tap. */
export function calendarFile(events: readonly CalendarEvent[], name: string, stamp: Date = new Date()): File {
  return new File([buildIcs(events, stamp)], name, { type: 'text/calendar' });
}
