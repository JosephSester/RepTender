import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VetScreen from './VetScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { createVetVisit } from '../../db/vetVisits';
import { mockShare, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

const renderVet = () =>
  render(
    <MemoryRouter initialEntries={[`/pets/${petId}/vet`]}>
      <Routes>
        <Route path="/pets/:id/vet" element={<VetScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );

it('adds the next appointment to Calendar', async () => {
  const visit = await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', clinic: 'Exotic Animal Clinic',
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
  const { share, file } = mockShare();
  renderVet();
  const card = await screen.findByRole('group', { name: 'Next appointment' });
  await userEvent.click(within(card).getByRole('button', { name: '📅 Add to Calendar' }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Vet · Noodle');
  expect(ics).toContain(`UID:${visit.id}-2027-06-14@reptender`);
  expect(ics).toContain('LOCATION:Exotic Animal Clinic');
  expect(ics).toContain('DESCRIPTION:Follow-up after: Wellness exam');
});

it('offers no button once the appointment time has passed', async () => {
  await createVetVisit({ petId, date: '2026-06-14', nextAppointment: new Date(2026, 10, 8, 8, 0).toISOString() });
  renderVet();
  const card = await screen.findByRole('group', { name: 'Next appointment' }); // still listed today
  expect(within(card).queryByRole('button', { name: '📅 Add to Calendar' })).toBeNull();
});
