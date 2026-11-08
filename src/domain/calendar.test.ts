import { describe, it, expect } from 'vitest';
import type { Feeding, FeedingOutcome, Regurgitation } from './types';
import { buildMonthMarks, monthCells } from './calendar';

const feeding = (id: string, at: Date, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id, petId: 'p1', at: at.toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome,
  createdAt: at.toISOString(), updatedAt: at.toISOString(),
});

describe('monthCells', () => {
  it('November 2026 starts on Sunday and has 30 days', () => {
    const cells = monthCells(2026, 10);
    expect(cells).toHaveLength(30);
    expect(cells[0]!.getDate()).toBe(1);
  });
  it('October 2026 is padded with 4 leading blanks (starts Thursday)', () => {
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells).toHaveLength(35);
  });
});

describe('buildMonthMarks', () => {
  const base = {
    year: 2026,
    month: 10,
    regurgitations: [] as Regurgitation[],
    nextDue: new Date(2026, 10, 8, 18, 0) as Date | null,
    intervalDays: 5,
    now: new Date(2026, 10, 8, 9, 0),
  };

  it('marks ate, refused, next due, planned and today', () => {
    const marks = buildMonthMarks({
      ...base,
      feedings: [
        feeding('a', new Date(2026, 10, 3, 18, 5)),
        feeding('r', new Date(2026, 10, 2, 18, 0), 'refused'),
      ],
    });
    expect([...marks.get('2026-11-02')!]).toEqual(['refused']);
    expect([...marks.get('2026-11-03')!]).toEqual(['ate']);
    expect(marks.get('2026-11-08')).toEqual(new Set(['nextDue', 'today']));
    expect(marks.get('2026-11-13')).toEqual(new Set(['planned']));
    expect(marks.get('2026-11-18')).toEqual(new Set(['planned']));
    expect(marks.get('2026-11-23')).toEqual(new Set(['planned']));
    expect(marks.has('2026-11-28')).toBe(false); // only 3 planned by default
  });

  it('shows a regurgitated meal as regurgitated instead of ate', () => {
    const meal = feeding('a', new Date(2026, 10, 3, 18, 5));
    const regurg: Regurgitation = {
      id: 'g', petId: 'p1', feedingId: 'a', at: new Date(2026, 10, 4, 7, 30).toISOString(),
      createdAt: '', updatedAt: '',
    };
    const marks = buildMonthMarks({ ...base, feedings: [meal], regurgitations: [regurg] });
    expect([...marks.get('2026-11-03')!]).toEqual(['regurgitated']);
  });

  it('ignores days outside the month', () => {
    const marks = buildMonthMarks({
      ...base,
      feedings: [feeding('o', new Date(2026, 9, 29, 18, 0))],
      nextDue: new Date(2026, 10, 28, 18, 0),
    });
    expect([...marks.keys()].every((k) => k.startsWith('2026-11'))).toBe(true);
    expect(marks.get('2026-11-28')).toEqual(new Set(['nextDue']));
  });

  it('handles no next due date', () => {
    const marks = buildMonthMarks({ ...base, feedings: [], nextDue: null });
    expect([...marks.entries()]).toEqual([['2026-11-08', new Set(['today'])]]);
  });
});
