import { parseISO, startOfDay } from 'date-fns';
import type { VetVisit } from '../../domain/types';

export interface ClinicInfo {
  clinic?: string;
  vet?: string;
  phone?: string;
}

/** Spec §5.11 clinic card: the most recent visit that has a clinic, vet or phone. */
export function clinicInfo(visits: readonly VetVisit[]): ClinicInfo | undefined {
  const v = [...visits]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .find((x) => x.clinic || x.vet || x.phone);
  return v ? { clinic: v.clinic, vet: v.vet, phone: v.phone } : undefined;
}

/** The earliest next appointment from the start of today on. */
export function upcomingAppointment(visits: readonly VetVisit[], now: Date): { at: Date; visit: VetVisit } | undefined {
  const from = startOfDay(now).getTime();
  let best: { at: Date; visit: VetVisit } | undefined;
  for (const visit of visits) {
    if (!visit.nextAppointment) continue;
    const at = parseISO(visit.nextAppointment);
    if (at.getTime() >= from && (!best || at.getTime() < best.at.getTime())) best = { at, visit };
  }
  return best;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
