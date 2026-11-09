import { addMinutes } from 'date-fns';
import { dateKey } from './dates';

/** One single (non-repeating) calendar event. Spec §8. */
export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  durationMinutes: number;
  description?: string;
  location?: string;
}

/** Spec §8 stable UID: `<petId|taskId>-<dueDate>@reptender`, the due date as the local yyyy-MM-dd. */
export const eventUid = (id: string, day: Date): string => `${id}-${dateKey(day)}@reptender`;

/** UTC form, e.g. 20261113T230000Z. */
export const icsDateTime = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 §3.3.11 TEXT escaping. */
export const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

/** RFC 5545 §3.1: at most 75 octets per line; continuation lines start with one space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // the leading space of a continuation counts
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function eventLines(e: CalendarEvent, stamp: Date): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDateTime(stamp)}`,
    `DTSTART:${icsDateTime(e.start)}`,
    `DTEND:${icsDateTime(addMinutes(e.start, e.durationMinutes))}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    // Spec §8: an alert at the start time.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(e.title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** One VCALENDAR holding every event, CRLF line endings, folded lines. */
export function buildIcs(events: readonly CalendarEvent[], stamp: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RepTender//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((e) => eventLines(e, stamp)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
