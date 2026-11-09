import { describe, expect, it } from 'vitest';
import { dueStatus, statusLabel } from './feeding';
import { CARE_SUGGESTIONS, careNextDue, completedOn, everyLabel, lastCompletionAt } from './care';

const iso = (d: number, h = 9, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const task = { createdAt: iso(1, 10), intervalDays: 2, timeOfDay: undefined as string | undefined };
const done = (...days: number[]) => days.map((d) => ({ at: iso(d) }));

describe('careNextDue (spec §7 rule 9)', () => {
  it('counts from the creation date when never done', () => {
    expect(careNextDue(task, []).getTime()).toBe(new Date(2026, 10, 3).getTime());
  });
  it('counts from the last completion', () => {
    expect(careNextDue({ ...task, intervalDays: 1 }, done(7, 5)).getTime()).toBe(new Date(2026, 10, 8).getTime());
    expect(lastCompletionAt(done(5, 7, 6))).toBe(iso(7));
  });
  it('uses the time of day when set', () => {
    expect(careNextDue({ ...task, intervalDays: 1, timeOfDay: '08:00' }, done(7)).getTime()).toBe(
      new Date(2026, 10, 8, 8, 0).getTime(),
    );
  });
  it('has the same statuses as feeding', () => {
    const now = new Date(2026, 10, 8, 9, 0);
    const due = careNextDue({ ...task, intervalDays: 1 }, done(6));
    expect(dueStatus(due, now)).toBe('late');
    expect(statusLabel(due, now)).toBe('1 day late');
  });
});

describe('helpers', () => {
  it('completedOn checks the calendar day', () => {
    expect(completedOn(done(8), new Date(2026, 10, 8, 23, 0))).toBe(true);
    expect(completedOn(done(7), new Date(2026, 10, 8, 0, 30))).toBe(false);
  });
  it('labels the interval', () => {
    expect(everyLabel(1)).toBe('Daily');
    expect(everyLabel(30)).toBe('Every 30 days');
  });
  it('has the starter suggestions from the spec', () => {
    expect(CARE_SUGGESTIONS).toEqual([
      { name: 'Spot clean', intervalDays: 1 },
      { name: 'Fresh water', intervalDays: 2 },
      { name: 'Mist', intervalDays: 2 },
      { name: 'Deep clean', intervalDays: 30 },
      { name: 'Replace UVB bulb', intervalDays: 180 },
    ]);
  });
});
