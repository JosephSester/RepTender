import { describe, expect, it } from 'vitest';
import type { VetVisit } from '../../domain/types';
import { clinicInfo, telHref, upcomingAppointment } from './vetModel';

let n = 0;
const visit = (date: string, extra: Partial<VetVisit> = {}): VetVisit => ({
  id: `v${++n}`, petId: 'p1', date, photoIds: [], createdAt: '', updatedAt: '', ...extra,
});

describe('vetModel', () => {
  it('takes the clinic card from the latest visit that has details', () => {
    const visits = [
      visit('2026-04-20', { clinic: 'Old Clinic' }),
      visit('2026-06-14', { clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel', phone: '(555) 201-4470' }),
      visit('2026-07-01'),
    ];
    expect(clinicInfo(visits)).toEqual({ clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel', phone: '(555) 201-4470' });
    expect(clinicInfo([visit('2026-07-01')])).toBeUndefined();
  });

  it('finds the earliest appointment from today on', () => {
    const now = new Date(2026, 10, 8, 15, 0);
    const later = visit('2026-06-14', { nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString() });
    const soon = visit('2026-10-01', { nextAppointment: new Date(2026, 10, 20, 9, 0).toISOString() });
    const past = visit('2026-01-01', { nextAppointment: new Date(2026, 10, 1, 9, 0).toISOString() });
    const earlierToday = visit('2026-02-01', { nextAppointment: new Date(2026, 10, 8, 9, 0).toISOString() });
    expect(upcomingAppointment([later, soon, past], now)!.visit).toBe(soon);
    expect(upcomingAppointment([later, earlierToday], now)!.visit).toBe(earlierToday);
    expect(upcomingAppointment([past], now)).toBeUndefined();
  });

  it('builds a tap-to-call link', () => {
    expect(telHref('(555) 201-4470')).toBe('tel:5552014470');
    expect(telHref('+44 20 7946 0958')).toBe('tel:+442079460958');
  });
});
