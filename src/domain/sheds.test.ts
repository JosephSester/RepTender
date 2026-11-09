import { describe, expect, it } from 'vitest';
import { dateKey } from './dates';
import { predictNextShed, shedEtaLabel } from './sheds';

const shed = (date: string) => ({ date });

describe('predictNextShed (spec §7 rule 8)', () => {
  it('needs 2 or more sheds', () => {
    expect(predictNextShed([])).toBeNull();
    expect(predictNextShed([shed('2026-10-21')])).toBeNull();
  });

  it('is the last shed + the average gap', () => {
    const p = predictNextShed([shed('2026-10-21'), shed('2026-09-18'), shed('2026-08-16')])!;
    expect(p.averageDays).toBe(33);
    expect(dateKey(p.date)).toBe('2026-11-23');
  });

  it('averages only the most recent 5 gaps', () => {
    // A 100-day gap at the start, then five 30-day gaps (input out of order on purpose).
    const dates = ['2026-06-10', '2026-01-01', '2026-09-08', '2026-04-11', '2026-08-09', '2026-05-11', '2026-07-10'];
    const p = predictNextShed(dates.map(shed))!;
    expect(p.averageDays).toBe(30);
    expect(dateKey(p.date)).toBe('2026-10-08');
  });
});

describe('shedEtaLabel', () => {
  const now = new Date(2026, 10, 8, 9, 0);
  it('counts calendar days', () => {
    expect(shedEtaLabel(new Date(2026, 10, 23), now)).toBe('In 15 days');
    expect(shedEtaLabel(new Date(2026, 10, 9), now)).toBe('Tomorrow');
    expect(shedEtaLabel(new Date(2026, 10, 8), now)).toBe('Today');
    expect(shedEtaLabel(new Date(2026, 10, 7), now)).toBe('1 day overdue');
    expect(shedEtaLabel(new Date(2026, 10, 5), now)).toBe('3 days overdue');
  });
});
