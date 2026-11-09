import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, eventUid, foldLine, icsDateTime, type CalendarEvent } from './ics';

const utf8Length = (s: string) => new TextEncoder().encode(s).length;
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

const event: CalendarEvent = {
  uid: 'pet-1-2026-11-13@reptender',
  title: 'Feed Noodle · 1 Pinky mouse',
  start: new Date(Date.UTC(2026, 10, 13, 23, 0)),
  durationMinutes: 15,
};

describe('ics helpers', () => {
  it('writes UTC date-times', () => {
    expect(icsDateTime(new Date(Date.UTC(2026, 10, 13, 23, 0, 5)))).toBe('20261113T230005Z');
  });
  it('builds stable UIDs from an id and the local due day', () => {
    expect(eventUid('pet-1', new Date(2026, 10, 13, 18, 0))).toBe('pet-1-2026-11-13@reptender');
  });
  it('escapes text values', () => {
    expect(escapeText('Mist, then soak; back\\slash\nline 2')).toBe('Mist\\, then soak\\; back\\\\slash\\nline 2');
  });
  it('turns CRLF, a lone CR and LF into an escaped newline', () => {
    expect(escapeText('a\r\nb\rc\nd')).toBe('a\\nb\\nc\\nd');
  });
  it('folds long lines at 75 octets without splitting a character', () => {
    const line = `SUMMARY:${'🦎 Feed Noodle '.repeat(8)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(utf8Length(part)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toBe(line);
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });
});

describe('buildIcs', () => {
  it('writes one single (non-repeating) event with an alert at the start', () => {
    const ics = buildIcs([{ ...event, description: 'Logged in RepTender', location: 'Home, warm side' }], new Date(Date.UTC(2026, 10, 8, 17, 0)));
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.split('\r\n').filter(Boolean)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RepTender//Reminders//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:pet-1-2026-11-13@reptender',
      'DTSTAMP:20261108T170000Z',
      'DTSTART:20261113T230000Z',
      'DTEND:20261113T231500Z',
      'SUMMARY:Feed Noodle · 1 Pinky mouse',
      'DESCRIPTION:Logged in RepTender',
      'LOCATION:Home\\, warm side',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Feed Noodle · 1 Pinky mouse',
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    expect(ics).not.toContain('RRULE');
  });

  it('puts several events in one calendar', () => {
    const ics = buildIcs([event, { ...event, uid: 'task-1-2026-11-09@reptender', title: 'Mist · Ziggy' }], new Date());
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics).toContain('UID:task-1-2026-11-09@reptender');
  });
});
