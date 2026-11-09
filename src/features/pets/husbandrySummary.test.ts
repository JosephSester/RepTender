import { describe, expect, it } from 'vitest';
import type { CareTask } from '../../domain/types';
import { tempToC } from '../../domain/units';
import { husbandryTiles, sizeStats, type HusbandryData } from './husbandrySummary';

const now = new Date(2026, 10, 8, 9, 0);
const units = { temp: 'F', weight: 'g', length: 'in' } as const;
const base = { petId: 'p1', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '' };
const iso = (m: number, d: number, h = 9) => new Date(2026, m, d, h, 0).toISOString();
const empty: HusbandryData = { sheds: [], poops: [], measurements: [], readings: [], tasks: [], completions: [], visits: [], notes: [] };
const task = (id: string, name: string, intervalDays: number): CareTask => ({ ...base, id, name, intervalDays });

describe('husbandryTiles', () => {
  it('summarizes each area', () => {
    const tiles = husbandryTiles(
      {
        sheds: [
          { ...base, id: 's1', date: '2026-09-18', quality: 'complete' },
          { ...base, id: 's2', date: '2026-10-21', quality: 'complete' },
        ],
        poops: [{ ...base, id: 'p1', at: iso(10, 6, 8), kind: 'normal' }],
        measurements: [
          { ...base, id: 'm1', date: '2026-10-01', weightG: 39 },
          { ...base, id: 'm2', date: '2026-11-01', weightG: 42, lengthMm: 457.2 },
        ],
        readings: [{ ...base, id: 'r1', at: iso(10, 8, 8), warmC: tempToC(88, 'F'), humidityPct: 52 }],
        tasks: [task('t1', 'Spot clean', 1), task('t2', 'Mist', 2), task('t3', 'Deep clean', 30)],
        completions: [
          { ...base, id: 'c1', taskId: 't1', at: iso(10, 7) }, // due today
          { ...base, id: 'c2', taskId: 't2', at: iso(10, 5) }, // due Nov 7: late
          { ...base, id: 'c3', taskId: 't3', at: iso(10, 1) },
        ],
        visits: [{ ...base, id: 'v1', date: '2026-06-14', reason: 'Wellness exam', photoIds: [] }],
        notes: [1, 2, 3].map((n) => ({ ...base, id: `n${n}`, at: iso(10, n), text: 'x' })),
      },
      units,
      now,
    );
    expect(tiles).toEqual({
      sheds: 'Last: Oct 21 · complete',
      poop: 'Last: Nov 6 · normal',
      weight: '42 g · ↑ 3 g',
      habitat: '88°F · 52% RH',
      care: '1 late · 1 due today',
      vet: 'Jun 14 · Wellness exam',
      notes: '3 notes',
    });
  });

  it('has friendly empty lines', () => {
    expect(husbandryTiles(empty, units, now)).toEqual({
      sheds: 'No sheds yet',
      poop: 'None logged',
      weight: 'No entries yet',
      habitat: 'No readings yet',
      care: 'No tasks yet',
      vet: 'No visits yet',
      notes: 'No notes yet',
    });
  });

  it('says when every care task is done', () => {
    const tiles = husbandryTiles(
      { ...empty, tasks: [task('t1', 'Spot clean', 1)], completions: [{ ...base, id: 'c1', taskId: 't1', at: iso(10, 8, 7) }] },
      units,
      now,
    );
    expect(tiles.care).toBe('All caught up');
  });
});

describe('sizeStats', () => {
  it('shows the latest length and weight, or a dash', () => {
    expect(sizeStats([{ ...base, id: 'm1', date: '2026-11-01', weightG: 42, lengthMm: 457.2 }], units)).toEqual({
      length: '18 in', weight: '42 g',
    });
    expect(sizeStats([], units)).toEqual({ length: '—', weight: '—' });
  });
});
